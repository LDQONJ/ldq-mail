import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { cleanPreview } from '@/lib/utils';
import { MAX_ACCOUNT_SLOTS } from '@/lib/account-utils';
import { readStalwartAuthContextFromStore } from '@/lib/stalwart/auth-context';
import {
  getStalwartCredentials,
  type StalwartCredentials,
} from '@/lib/stalwart/credentials';
import { fetchJmapServer, isTrustedJmapServerUrl } from '@/lib/stalwart/server-fetch';
import { rebaseApiUrl } from '@/lib/stalwart/jmap-api';
import { forwardedClientHeaders, loginClientAddress } from '@/lib/auth/client-address';
import { DisallowedUrlError } from '@/lib/security/url-guard';
import { UPSTREAM_JSON_MAX_BYTES, UpstreamBodyTooLargeError, readJsonCapped } from '@/lib/security/capped-body';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ResolvedTarget {
  authHeader: string;
  apiUrl: string;
  accountId: string;
  /** See StalwartCredentials.trusted - false routes through the guarded fetch. */
  trusted: boolean;
  /**
   * Cookie slot of the login that owns the account. Handed back so a click
   * on the notification opens the message in that login: the worker knows
   * only the JMAP account id, which can repeat across servers.
   */
  slot?: number;
}

interface ResolveTargetOptions {
  accountId?: string | null;
  accountLabel?: string | null;
  serverUrl?: string | null;
  emailId?: string | null;
  forwarded: Record<string, string>;
}

interface ProbeResult extends ResolvedTarget {
  hasTargetEmail?: boolean;
  own: boolean;
}

// When the SW passes ?serverUrl=, ?accountId=, or ?accountLabel=, we need the slot whose
// JMAP session owns that account - not just "the first signed-in slot", which is
// what getStalwartCredentials() defaults to. Probe candidate sessions in
// parallel and return the best match.
async function resolveTargetForAccount(
  options: ResolveTargetOptions,
): Promise<ResolvedTarget | 'ambiguous' | null> {
  const { accountId, accountLabel, serverUrl, emailId, forwarded } = options;
  const cookieStore = await cookies();
  const probes: Promise<ProbeResult | null>[] = [];

  logger.info('push-preview: resolveTargetForAccount', {
    accountId, accountLabel, serverUrl, emailId,
  });

  for (let slot = 0; slot < MAX_ACCOUNT_SLOTS; slot++) {
    const ctx = readStalwartAuthContextFromStore(cookieStore, slot);
    if (!ctx) {
      if (slot < 5) logger.info('push-preview: slot empty', { slot });
      continue;
    }

    logger.info('push-preview: slot found', {
      slot,
      ctxServerUrl: ctx.serverUrl,
      ctxUsername: ctx.username,
    });

    const ctxServerUrl = ctx.serverUrl.replace(/\/+$/, '');
    const ctxUsername = ctx.username.toLowerCase().trim();

    // 1. Match by serverUrl if provided (highest precision across separate Stalwart instances)
    if (serverUrl) {
      const normalizedServer = serverUrl.replace(/\/+$/, '').toLowerCase();
      let serverMatch = ctxServerUrl.toLowerCase() === normalizedServer;
      if (!serverMatch) {
        try {
          const u1 = new URL(ctxServerUrl).hostname.toLowerCase();
          const u2 = new URL(normalizedServer.startsWith('http') ? normalizedServer : `https://${normalizedServer}`).hostname.toLowerCase();
          serverMatch = u1 === u2;
        } catch {
          // ignore
        }
      }
      if (!serverMatch) continue;
    }

    // 2. If accountLabel is provided, match by accountLabel domain or full username
    if (accountLabel) {
      const normalizedLabel = accountLabel.toLowerCase().trim();
      const labelUser = normalizedLabel.includes('@') ? normalizedLabel.split('@')[0] : normalizedLabel;
      const labelDomain = normalizedLabel.includes('@') ? normalizedLabel.split('@')[1] : '';

      const ctxUser = ctxUsername.includes('@') ? ctxUsername.split('@')[0] : ctxUsername;
      const ctxDomain = ctxUsername.includes('@') ? ctxUsername.split('@')[1] : '';
      let ctxServerHostname = '';
      try {
        ctxServerHostname = new URL(ctxServerUrl).hostname.toLowerCase();
      } catch {
        ctxServerHostname = ctxServerUrl.toLowerCase();
      }

      if (labelDomain) {
        // Domain was specified: it MUST match either the context domain or server hostname
        const domainMatches = (ctxDomain && ctxDomain === labelDomain) || ctxServerHostname.includes(labelDomain);
        if (!domainMatches) continue;
      } else if (!serverUrl) {
        // No domain in accountLabel AND no serverUrl from relay → legacy registration.
        // Cannot safely distinguish between slots that share the same username (e.g. "admin"
        // on ldqmail.com vs lidaqian.com). Skip ALL slots to avoid cross-account leaks.
        // The SW will show a safe generic "New mail" notification instead.
        logger.info('push-preview: skipping slot (ambiguous legacy label)', {
          slot, labelUser, ctxServerUrl,
        });
        continue;
      }

      // Username part must match
      if (labelUser && labelUser !== ctxUser && ctxUsername !== normalizedLabel) {
        continue;
      }
    }

    probes.push(
      (async (): Promise<ProbeResult | null> => {
        try {
          const trusted = await isTrustedJmapServerUrl(ctxServerUrl);
          const res = await fetchJmapServer(`${ctxServerUrl}/.well-known/jmap`, {
            headers: { Authorization: ctx.authHeader, ...forwarded },
          }, trusted);

          if (!res.ok) {
            logger.warn('push-preview: probe well-known failed', { slot, ctxServerUrl, status: res.status });
            return null;
          }
          const session = (await readJsonCapped(res, UPSTREAM_JSON_MAX_BYTES)) as {
            apiUrl?: string;
            primaryAccounts?: Record<string, string>;
            accounts?: Record<string, unknown>;
          };
          const mailAccountId = session.primaryAccounts?.['urn:ietf:params:jmap:mail'];
          if (!mailAccountId) {
            logger.warn('push-preview: probe no mail account in session', { slot, ctxServerUrl });
            return null;
          }

          // Shared and group mailboxes are never the primary mail account -
          // they only appear in session.accounts. Accept those too, or the
          // SW falls back to a generic "New mail" notification for them. (#839)
          const isSharedAccount =
            Boolean(accountId && accountId !== mailAccountId &&
            Object.prototype.hasOwnProperty.call(session.accounts ?? {}, accountId));
          if (accountId && mailAccountId !== accountId && !isSharedAccount) {
            return null;
          }
          const targetAccountId: string = (isSharedAccount && accountId) ? accountId : mailAccountId;

          const absoluteApiUrl = rebaseApiUrl(session, ctxServerUrl)
            ?? (session.apiUrl?.startsWith('http') ? session.apiUrl : `${ctxServerUrl}/jmap`);
          if (!absoluteApiUrl) {
            logger.warn('push-preview: probe no absolute api url', { slot, ctxServerUrl });
            return null;
          }

          let hasTargetEmail = false;
          if (emailId) {
            try {
              const checkRes = await fetchJmapServer(absoluteApiUrl, {
                method: 'POST',
                headers: { Authorization: ctx.authHeader, 'Content-Type': 'application/json', ...forwarded },
                body: JSON.stringify({
                  using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
                  methodCalls: [
                    ['Email/get', { accountId: targetAccountId, ids: [emailId], properties: ['id'] }, '0'],
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

          logger.info('push-preview: probe success', { slot, ctxServerUrl, hasTargetEmail, trusted });
          return {
            authHeader: ctx.authHeader,
            apiUrl: absoluteApiUrl,
            accountId: targetAccountId,
            trusted,
            slot,
            hasTargetEmail,
            own: mailAccountId === targetAccountId,
          };
        } catch (err) {
          logger.warn('push-preview: probe exception', { slot, ctxServerUrl, err: String(err) });
          return null;
        }
      })(),
    );
  }

  const results = await Promise.all(probes);
  const valid = results.filter((r): r is ProbeResult => r !== null);
  if (valid.length === 0) return null;
  const foundWithEmail = valid.find((r) => r.hasTargetEmail);
  if (foundWithEmail) return foundWithEmail;
  const owners = valid.filter((r) => r.own);
  if (owners.length === 1) return owners[0];
  if (valid.length === 1) return valid[0];
  return valid.length > 1 ? 'ambiguous' : null;
}

async function resolveDefaultTarget(creds: StalwartCredentials, forwarded: Record<string, string>): Promise<ResolvedTarget | null> {
  const sessionRes = await fetchJmapServer(`${creds.serverUrl}/.well-known/jmap`, {
    headers: { Authorization: creds.authHeader, ...forwarded },
  }, creds.trusted);
  if (!sessionRes.ok) return null;
  const session = (await readJsonCapped(sessionRes, UPSTREAM_JSON_MAX_BYTES)) as {
    apiUrl?: string;
    primaryAccounts?: Record<string, string>;
  };
  const apiUrl = rebaseApiUrl(session, creds.serverUrl)
    ?? (session.apiUrl?.startsWith('http') ? session.apiUrl : `${creds.serverUrl}/jmap`);
  const accountId = session.primaryAccounts?.['urn:ietf:params:jmap:mail'];
  if (!apiUrl || !accountId) return null;
  return { authHeader: creds.authHeader, apiUrl, accountId, trusted: creds.trusted };
}

/**
 * GET /api/push/preview
 *
 * Called from the service worker when a Web Push wake-up arrives. Fetches the
 * latest unread email so the SW can build an enriched system notification
 * (sender, subject, avatar) without ever exposing JMAP credentials to the
 * SW context.
 *
 * The relay's push payload is intentionally minimal (just a state-change
 * ping), so this is what makes "From: Alice / Subject: …" appear instead of
 * a generic "New mail" string.
 */
export async function GET(request: NextRequest) {
  try {
    // SW passes ?accountId=<jmap-account-id>, ?accountLabel=<user@domain>, and ?serverUrl=<url>
    // derived from the push payload so multi-account/multi-server browsers fetch
    // from the right slot.
    const requestedAccountId = request.nextUrl.searchParams.get('accountId');
    const requestedAccountLabel = request.nextUrl.searchParams.get('accountLabel');
    const requestedServerUrl = request.nextUrl.searchParams.get('serverUrl');
    // With a server-side delivery filter (draft-ietf-jmap-emailpush) the push
    // carries the id of the message that was actually delivered, so the SW
    // asks for that one instead of guessing "newest unread in the Inbox" -
    // which is wrong whenever Sieve filed the new message into a folder.
    const requestedEmailId = request.nextUrl.searchParams.get('emailId');
    const forwarded = forwardedClientHeaders(loginClientAddress(request));

    let target: ResolvedTarget | null = null;
    let authHeader: string;
    if (requestedAccountId || requestedAccountLabel || requestedServerUrl) {
      const resolved = await resolveTargetForAccount({
        accountId: requestedAccountId,
        accountLabel: requestedAccountLabel,
        serverUrl: requestedServerUrl,
        emailId: requestedEmailId,
        forwarded,
      });
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
      authHeader = target.authHeader;
    } else {
      const creds = await getStalwartCredentials(request);
      if (!creds) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
      target = await resolveDefaultTarget(creds, forwarded);
      if (!target) {
        return NextResponse.json({ error: 'JMAP session failed' }, { status: 502 });
      }
      authHeader = creds.authHeader;
    }

    const { apiUrl, accountId, trusted } = target;

    const inboxRes = await fetchJmapServer(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        ...forwarded,
      },
      body: JSON.stringify({
        using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
        methodCalls: [
          [
            'Mailbox/query',
            { accountId, filter: { role: 'inbox' }, limit: 1 },
            'mb',
          ],
        ],
      }),
    }, trusted);

    if (!inboxRes.ok) {
      return NextResponse.json({ error: 'JMAP mailbox query failed' }, { status: 502 });
    }

    const inboxData = (await readJsonCapped(inboxRes, UPSTREAM_JSON_MAX_BYTES)) as {
      methodResponses: [string, Record<string, unknown>, string][];
    };

    const inboxBody = inboxData.methodResponses.find(
      ([method, , callId]) => method === 'Mailbox/query' && callId === 'mb',
    )?.[1] as { ids?: string[] } | undefined;

    // A method-level JMAP error still has HTTP 200. Do not turn it into
    // an empty Inbox: the service worker would silently discard the push.
    if (!Array.isArray(inboxBody?.ids)) {
      return NextResponse.json({ error: 'JMAP mailbox query failed' }, { status: 502 });
    }

    const inboxId = inboxBody.ids[0];
    const emailProperties = ['id', 'threadId', 'from', 'subject', 'preview', 'receivedAt'];

    if (!inboxId && !requestedEmailId) {
      return NextResponse.json({
        email: null,
        unreadTotal: 0,
      }, {
        headers: {
          'Cache-Control': 'no-store',
        },
      });
    }

    // Pull the most recent unread message from the resolved Inbox mailbox
    // (and its unread total for the "+N more" line). When the SW named the
    // delivered message, fetch that one too and prefer it.
    const methodCalls: unknown[] = [];
    if (inboxId) {
      methodCalls.push(
        [
          'Email/query',
          {
            accountId,
            filter: {
              operator: 'AND',
              conditions: [
                { inMailbox: inboxId },
                { notKeyword: '$seen' },
              ],
            },
            sort: [{ property: 'receivedAt', isAscending: false }],
            limit: 1,
            calculateTotal: true,
          },
          'eq',
        ],
        [
          'Email/get',
          {
            accountId,
            '#ids': { resultOf: 'eq', name: 'Email/query', path: '/ids' },
            properties: emailProperties,
          },
          'eg',
        ],
      );
    }
    if (requestedEmailId) {
      methodCalls.push([
        'Email/get',
        { accountId, ids: [requestedEmailId], properties: emailProperties },
        'delivered',
      ]);
    }
    const requestBody = {
      using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
      methodCalls,
    };

    const emailRes = await fetchJmapServer(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        ...forwarded,
      },
      body: JSON.stringify(requestBody),
    }, trusted);

    if (!emailRes.ok) {
      return NextResponse.json({ error: 'JMAP email query failed' }, { status: 502 });
    }

    const emailData = (await readJsonCapped(emailRes, UPSTREAM_JSON_MAX_BYTES)) as {
      methodResponses: [string, Record<string, unknown>, string][];
    };

    const unreadTotal = (emailData.methodResponses.find(
      ([method, , callId]) => method === 'Email/query' && callId === 'eq',
    )?.[1] as { total?: number } | undefined)?.total ?? 0;

    const deliveredEmail = (emailData.methodResponses.find(
      ([method, , callId]) => method === 'Email/get' && callId === 'delivered',
    )?.[1] as { list?: Record<string, unknown>[] } | undefined)?.list?.[0];

    const fallbackEmail = (emailData.methodResponses.find(
      ([method, , callId]) => method === 'Email/get' && callId === 'eg',
    )?.[1] as { list?: Record<string, unknown>[] } | undefined)?.list?.[0];

    const rawEmail = deliveredEmail ?? fallbackEmail ?? null;

    const email = rawEmail ? {
      id: rawEmail.id,
      threadId: rawEmail.threadId,
      from: rawEmail.from,
      subject: rawEmail.subject,
      preview: typeof rawEmail.preview === 'string' ? cleanPreview(rawEmail.preview) : '',
      receivedAt: rawEmail.receivedAt,
    } : null;

    return NextResponse.json({
      email,
      unreadTotal,
      slot: target.slot,
    }, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof DisallowedUrlError || error instanceof UpstreamBodyTooLargeError) {
      return NextResponse.json({ error: 'Upstream request blocked' }, { status: 502 });
    }
    logger.error('push-preview: unexpected error', { error: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
