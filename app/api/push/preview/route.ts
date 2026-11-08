import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { cleanPreview } from '@/lib/utils';
import { MAX_ACCOUNT_SLOTS } from '@/lib/account-utils';
import { readPushAuthContext } from '@/lib/stalwart/push-auth-context';
import { renewPushAuthHeader } from '@/lib/stalwart/push-token-renewal';
import type { StalwartAuthContext } from '@/lib/stalwart/auth-context';
import {
  getStalwartCredentials,
  type StalwartCredentials,
} from '@/lib/stalwart/credentials';
import { fetchJmapServer, isTrustedJmapServerUrl } from '@/lib/stalwart/server-fetch';
import { rebaseApiUrl } from '@/lib/stalwart/jmap-api';
import { forwardedClientHeaders, loginClientAddress } from '@/lib/auth/client-address';
import { DisallowedUrlError } from '@/lib/security/url-guard';
import { UPSTREAM_JSON_MAX_BYTES, UpstreamBodyTooLargeError, readJsonCapped } from '@/lib/security/capped-body';
import { serverDevicePolicy } from '@/lib/admin/server-device-policy';
import { loginFingerprint } from '@/lib/pwa-notify/login-fingerprint';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ResolvedTarget {
  authHeader: string;
  apiUrl: string;
  accountId: string;
  /** See StalwartCredentials.trusted - false routes through the guarded fetch. */
  trusted: boolean;
  /** The login, for its device policy. */
  serverUrl: string;
  username: string;
  accountName?: string;
  /**
   * Cookie slot of the login that owns the account. Handed back so a click
   * on the notification opens the message in that login: the worker knows
   * only the JMAP account id, which can repeat across servers.
   */
  slot?: number;
}

type CookieStore = Awaited<ReturnType<typeof cookies>>;

/**
 * The login's JMAP session, and the Authorization header that opened it. A
 * token sign-in's access token expires within the hour, and with no tab open
 * nothing renews it: the mail server turns it away and the push gets the
 * worker's generic notification (#1509). Renewed here then, once, when
 * `mayRenew` says this is the login the push is for.
 */
async function openSession(
  cookieStore: CookieStore,
  slot: number,
  ctx: StalwartAuthContext,
  serverUrl: string,
  trusted: boolean,
  forwarded: Record<string, string>,
  basePath: string | undefined,
  mayRenew: boolean,
): Promise<{ res: Response; authHeader: string }> {
  const get = (authHeader: string) => fetchJmapServer(`${serverUrl}/.well-known/jmap`, {
    headers: { Authorization: authHeader, ...forwarded },
  }, trusted);
  const res = await get(ctx.authHeader);
  if (res.status !== 401 || !mayRenew) return { res, authHeader: ctx.authHeader };
  const renewed = await renewPushAuthHeader(cookieStore, slot, ctx, basePath);
  if (!renewed) return { res, authHeader: ctx.authHeader };
  return { res: await get(renewed), authHeader: renewed };
}

interface ProbeResult {
  target: ResolvedTarget;
  own: boolean;
  hasTargetEmail?: boolean;
}

// When the SW passes ?serverUrl=, ?accountId=, or ?login=/?accountLabel=, we need the slot whose
// JMAP session owns that account - not just "the first signed-in slot", which is what
// getStalwartCredentials() defaults to. Probe candidate sessions in parallel and return the best match.
async function resolveTargetForAccount(
  accountId: string,
  login: string | null,
  forwarded: Record<string, string>,
  basePath: string | undefined,
  serverUrlParam?: string | null,
  requestedEmailId?: string | null,
): Promise<ResolvedTarget | 'ambiguous' | null> {
  const cookieStore = await cookies();
  const contexts: { slot: number; ctx: StalwartAuthContext }[] = [];
  for (let slot = 0; slot < MAX_ACCOUNT_SLOTS; slot++) {
    const ctx = await readPushAuthContext(cookieStore, slot);
    if (ctx) contexts.push({ slot, ctx });
  }

  const named = login?.toLowerCase().trim();
  const normalizedServerParam = serverUrlParam ? serverUrlParam.replace(/\/+$/, '').toLowerCase() : null;

  // Filter candidate contexts by serverUrl if provided (multi-server support)
  const candidateContexts = contexts.filter(({ ctx }) => {
    if (!normalizedServerParam) return true;
    const ctxServer = ctx.serverUrl.replace(/\/+$/, '').toLowerCase();
    if (ctxServer === normalizedServerParam) return true;
    try {
      const u1 = new URL(ctxServer).hostname.toLowerCase();
      const u2 = new URL(normalizedServerParam.startsWith('http') ? normalizedServerParam : `https://${normalizedServerParam}`).hostname.toLowerCase();
      return u1 === u2;
    } catch {
      return false;
    }
  });

  const mayRenew = (ctx: StalwartAuthContext) => (named
    ? ctx.username.toLowerCase() === named || ctx.accountName?.toLowerCase() === named || (named.includes('@') && named.split('@')[0] === ctx.username.toLowerCase())
    : candidateContexts.length === 1);

  const probes: Promise<ProbeResult | null>[] = [];
  for (const { slot, ctx } of candidateContexts) {
    const serverUrl = ctx.serverUrl.replace(/\/+$/, '');
    probes.push(
      (async (): Promise<ProbeResult | null> => {
        try {
          const trusted = await isTrustedJmapServerUrl(serverUrl);
          const { res, authHeader } = await openSession(cookieStore, slot, ctx, serverUrl, trusted, forwarded, basePath, mayRenew(ctx));
          if (!res.ok) return null;
          const session = (await readJsonCapped(res, UPSTREAM_JSON_MAX_BYTES)) as {
            apiUrl?: string;
            primaryAccounts?: Record<string, string>;
            accounts?: Record<string, unknown>;
          };
          const mailAccountId = session.primaryAccounts?.['urn:ietf:params:jmap:mail'];
          if (!mailAccountId) return null;
          const isSharedAccount = Boolean(accountId && accountId !== mailAccountId && Object.prototype.hasOwnProperty.call(session.accounts ?? {}, accountId));
          if (accountId && mailAccountId !== accountId && !isSharedAccount) return null;
          const targetAccountId: string = (isSharedAccount && accountId) ? accountId : mailAccountId;
          const apiUrl = rebaseApiUrl(session, serverUrl)
            ?? (session.apiUrl?.startsWith('http') ? session.apiUrl : `${serverUrl}/jmap`);
          if (!apiUrl) return null;

          let hasTargetEmail = false;
          if (requestedEmailId) {
            try {
              const checkRes = await fetchJmapServer(apiUrl, {
                method: 'POST',
                headers: { Authorization: authHeader, 'Content-Type': 'application/json', ...forwarded },
                body: JSON.stringify({
                  using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
                  methodCalls: [
                    ['Email/get', { accountId: targetAccountId, ids: [requestedEmailId], properties: ['id'] }, '0'],
                  ],
                }),
              }, trusted);
              if (checkRes.ok) {
                const checkData = (await readJsonCapped(checkRes, UPSTREAM_JSON_MAX_BYTES)) as {
                  methodResponses?: [string, { list?: unknown[] }, string][];
                };
                hasTargetEmail = ((checkData?.methodResponses?.[0]?.[1] as { list?: unknown[] })?.list?.length ?? 0) > 0;
              }
            } catch (err) {
              logger.warn('push-preview: probe target email check failed', { slot, err: String(err) });
            }
          }

          return {
            target: { authHeader, apiUrl, accountId: targetAccountId, trusted, slot, serverUrl, username: ctx.username, accountName: ctx.accountName },
            own: mailAccountId === targetAccountId,
            hasTargetEmail,
          };
        } catch {
          return null;
        }
      })()
    );
  }

  const results = (await Promise.all(probes)).filter((r): r is ProbeResult => r !== null);
  if (requestedEmailId) {
    const withEmail = results.find((r) => r.hasTargetEmail);
    if (withEmail) return withEmail.target;
  }
  if (named && results.length > 0) {
    const namedMatches = results.filter((r) => {
      const u = r.target.username.toLowerCase();
      const a = r.target.accountName?.toLowerCase();
      if (u === named || a === named) return true;
      if (named.includes('@')) {
        const [user, domain] = named.split('@');
        if (u === user && r.target.serverUrl.toLowerCase().includes(domain)) return true;
      }
      return false;
    });
    const servers = new Set(namedMatches.map((r) => r.target.serverUrl));
    if (namedMatches.length === 1 && (!serverUrlParam || servers.size <= 1)) return namedMatches[0].target;
    if (namedMatches.length > 1 && servers.size > 1 && !serverUrlParam) return 'ambiguous';
    if (namedMatches.length === 1) return namedMatches[0].target;
  }
  const owners = results.filter((r) => r.own);
  if (owners.length === 1) return owners[0].target;
  if (results.length === 1) return results[0].target;
  return results.length > 1 ? 'ambiguous' : null;
}

async function resolveDefaultTarget(creds: StalwartCredentials, forwarded: Record<string, string>, basePath: string | undefined): Promise<ResolvedTarget | null> {
  const { res: sessionRes, authHeader } = await openSession(await cookies(), creds.slot, creds, creds.serverUrl, creds.trusted, forwarded, basePath, true);
  if (!sessionRes.ok) return null;
  const session = (await readJsonCapped(sessionRes, UPSTREAM_JSON_MAX_BYTES)) as {
    apiUrl?: string;
    primaryAccounts?: Record<string, string>;
  };
  const apiUrl = rebaseApiUrl(session, creds.serverUrl)
    ?? (session.apiUrl?.startsWith('http') ? session.apiUrl : `${creds.serverUrl}/jmap`);
  const accountId = session.primaryAccounts?.['urn:ietf:params:jmap:mail'];
  if (!apiUrl || !accountId) return null;
  return { authHeader, apiUrl, accountId, trusted: creds.trusted, serverUrl: creds.serverUrl, username: creds.username, accountName: creds.accountName };
}

/**
 * Service worker push notification preview endpoint.
 *
 * The browser's service worker calls this with cookies included to get the
 * sender and preview snippet of the newest unread message when a push event
 * arrives. The SW cannot make JMAP calls itself since credentials are in
 * httpOnly cookies.
 *
 * Never answers 401 on unexpected failure: any unauthenticated response makes
 * the worker post a generic "New mail" notification. Only deliberate denial
 * (no session at all) should make the SW fall back to its offline behavior.
 *
 * If the preview cannot be read (network glitch, JMAP error), the endpoint
 * returns 502 with a descriptive body so the service worker falls back to
 * a generic "New mail" string.
 */
export async function GET(request: NextRequest) {
  // The preview may renew a login's token (#1509), which spends its refresh
  // token at the provider. GET passes the same-origin gate of the other auth
  // routes, so a page elsewhere could make the browser do that with a link.
  // The service worker's own fetch is same-origin.
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin') {
    return NextResponse.json({ error: 'Cross-origin request' }, { status: 403 });
  }
  try {
    // SW passes ?accountId=<jmap-account-id>, ?login=<user@domain>, and ?serverUrl=<url>
    // derived from the push payload so multi-account/multi-server browsers fetch
    // from the right slot.
    const requestedAccountId = request.nextUrl.searchParams.get('accountId');
    const requestedAccountLabel = request.nextUrl.searchParams.get('login') || request.nextUrl.searchParams.get('accountLabel');
    const requestedServerUrl = request.nextUrl.searchParams.get('serverUrl');
    // With a server-side delivery filter (draft-ietf-jmap-emailpush) the push
    // carries the id of the message that was actually delivered, so the SW
    // asks for that one instead of guessing "newest unread in the Inbox" -
    // which is wrong whenever Sieve filed the new message into a folder.
    const requestedEmailId = request.nextUrl.searchParams.get('emailId');
    const forwarded = forwardedClientHeaders(loginClientAddress(request));
    const basePath = request.nextUrl.basePath;

    let target: ResolvedTarget | null = null;
    let authHeader: string;
    if (requestedAccountId || requestedAccountLabel || requestedServerUrl) {
      const resolved = await resolveTargetForAccount(
        requestedAccountId || '',
        requestedAccountLabel,
        forwarded,
        basePath,
        requestedServerUrl,
        requestedEmailId,
      );
      if (!resolved) {
        // Return 401 so the service worker knows the account is not authenticated,
        // which triggers the safe fallback notification ("You have new mail") instead
        // of falsely dropping the notification.
        return NextResponse.json({ error: 'Account not authenticated' }, { status: 401 });
      }
      // The service worker shows its generic notification, and a click opens
      // the app without switching login.
      if (resolved === 'ambiguous') {
        return NextResponse.json({ error: 'Account is in more than one signed-in login' }, { status: 409 });
      }
      target = resolved;
      authHeader = resolved.authHeader;
    } else {
      const creds = await getStalwartCredentials(request);
      if (!creds) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
      const defaultTarget = await resolveDefaultTarget(creds, forwarded, basePath);
      if (!defaultTarget) {
        return NextResponse.json({ error: 'Could not resolve default target' }, { status: 502 });
      }
      target = defaultTarget;
      authHeader = defaultTarget.authHeader;
    }

    // Check device policy: if push notification content is redacted, don't query email details
    const policy = await serverDevicePolicy(target);
    const redacted = policy.pushWithoutContent;

    // Fast-path: if content is redacted, we only need the unread count, not email details
    const methodCalls: [string, unknown, string][] = [
      ['Email/query', {
        accountId: target.accountId,
        filter: { inMailboxOtherThan: [], hasKeyword: '$seen', allInThreadHaveKeyword: false },
        calculateTotal: true,
        limit: 0,
      }, '0'],
    ];

    if (!redacted) {
      if (requestedEmailId) {
        methodCalls.push([
          'Email/get',
          {
            accountId: target.accountId,
            ids: [requestedEmailId],
            properties: ['id', 'threadId', 'from', 'subject', 'preview', 'receivedAt'],
          },
          'delivered',
        ]);
      }
      methodCalls.push([
        'Email/query',
        {
          accountId: target.accountId,
          filter: { inMailboxOtherThan: [], hasKeyword: '$seen', allInThreadHaveKeyword: false },
          sort: [{ property: 'receivedAt', isAscending: false }],
          limit: 1,
        },
        '1',
      ]);
      methodCalls.push([
        'Email/get',
        {
          accountId: target.accountId,
          '#ids': {
            resultOf: '1',
            name: 'Email/query',
            path: '/ids',
          },
          properties: ['id', 'threadId', 'from', 'subject', 'preview', 'receivedAt'],
        },
        '2',
      ]);
    }

    const jmapRes = await fetchJmapServer(target.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        ...forwarded,
      },
      body: JSON.stringify({
        using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
        methodCalls,
      }),
    }, target.trusted);

    if (!jmapRes.ok) {
      return NextResponse.json({ error: 'JMAP request failed' }, { status: 502 });
    }
    const data = (await readJsonCapped(jmapRes, UPSTREAM_JSON_MAX_BYTES)) as {
      methodResponses: [string, Record<string, unknown>, string][];
    };

    // Missing/failed method responses are preview failures, not proof that
    // there is no unread mail. A non-2xx response lets the SW show its fallback.
    // The message the server named, once read, is a complete preview on its
    // own, whatever became of the Inbox lookups next to it.
    const resultOf = (name: string, id: string) =>
      data.methodResponses.find(([method, , callId]) => method === name && callId === id)?.[1];
    const failed = (methodCalls as [string, unknown, string][]).some(([name, , id]) => {
      const result = resultOf(name, id);
      return !result || (name === 'Email/query' ? !Array.isArray(result.ids) : !Array.isArray(result.list));
    });
    const deliveredList = resultOf('Email/get', 'delivered')?.list;
    if (failed && !(Array.isArray(deliveredList) && deliveredList.length > 0)) {
      return NextResponse.json({ error: 'JMAP email query failed' }, { status: 502 });
    }

    type EmailLite = {
      id: string;
      threadId: string;
      from?: { name?: string | null; email?: string }[] | null;
      subject?: string | null;
      preview?: string | null;
      receivedAt?: string | null;
    };

    let email: EmailLite | null = null;
    let delivered: EmailLite | null = null;
    let unreadTotal = 0;
    for (const [method, body, callId] of data.methodResponses) {
      if (method === 'Email/query') {
        // A server that leaves out the optional total still lists the ids.
        const query = body as { total?: number; ids?: unknown[] };
        unreadTotal = typeof query.total === 'number' ? query.total : (query.ids?.length ?? 0);
      }
      if (method === 'Email/get') {
        const list = (body as { list?: EmailLite[] }).list ?? [];
        if (callId === 'delivered') delivered = list[0] ?? null;
        else email = list[0] ?? null;
      }
    }
    // The message the server said it delivered beats "newest unread in the
    // Inbox" - it may have been filed elsewhere by Sieve. Keep the Inbox
    // unread total for the group line; count the delivered one if it isn't
    // already in it (unread total is Inbox-scoped).
    if (delivered) {
      if (!email || email.id !== delivered.id) {
        unreadTotal = Math.max(unreadTotal, 1);
      }
      email = delivered;
    } else if (requestedEmailId) {
      // The server named the message that arrived and it could not be read -
      // deleted since, or filed where this login cannot see it. "Newest unread
      // in the Inbox" is then some other message, and announcing it would be
      // confidently wrong. Name no message: the unread total still comes back,
      // so the SW posts its generic toast instead of staying silent.
      email = null;
    }

    // Some servers build the preview from HTML without skipping <style>; a
    // notification that opens on a style sheet says nothing.
    if (email?.preview) email = { ...email, preview: cleanPreview(email.preview) };
    // Whatever the server sent anyway, only what a click needs goes back.
    if (redacted && email) email = { id: email.id, threadId: email.threadId, receivedAt: email.receivedAt ?? null };

    return NextResponse.json({
      email,
      unreadTotal,
      ...(redacted ? { redacted: true } : {}),
      ...(target.slot !== undefined ? { slot: target.slot } : {}),
      // For the notification's buttons, which must not land on whoever signs
      // into this slot later (app/api/push/action).
      ...(target.slot !== undefined && email ? { login: await loginFingerprint(target.serverUrl, target.username) } : {}),
    }, {
      headers: {
        // SW already gates on its own logic - don't let push events get
        // cached and served stale.
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof DisallowedUrlError) {
      logger.warn('push preview refused non-public server address', { error: error.message });
      return NextResponse.json({ error: 'JMAP server address is not allowed' }, { status: 502 });
    }
    if (error instanceof UpstreamBodyTooLargeError) {
      logger.warn('push preview: JMAP response too large', { maxBytes: error.maxBytes });
      return NextResponse.json({ error: 'JMAP server response is too large' }, { status: 502 });
    }
    const err = error as Error & { cause?: { code?: string; message?: string } };
    logger.error('push preview failed', {
      error: err?.message ?? 'Unknown error',
      causeCode: err?.cause?.code,
      causeMessage: err?.cause?.message,
    });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
