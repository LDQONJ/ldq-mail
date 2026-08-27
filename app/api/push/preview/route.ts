import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { MAX_ACCOUNT_SLOTS } from '@/lib/account-utils';
import { readStalwartAuthContextFromStore } from '@/lib/stalwart/auth-context';
import {
  getStalwartCredentials,
  type StalwartCredentials,
} from '@/lib/stalwart/credentials';
import { fetchJmapServer, isTrustedJmapServerUrl } from '@/lib/stalwart/server-fetch';
import { rebaseApiUrl } from '@/lib/stalwart/jmap-api';
import { DisallowedUrlError } from '@/lib/security/url-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ResolvedTarget {
  authHeader: string;
  apiUrl: string;
  accountId: string;
  /** See StalwartCredentials.trusted - false routes through the guarded fetch. */
  trusted: boolean;
}

interface ResolveTargetOptions {
  accountId?: string | null;
  accountLabel?: string | null;
  serverUrl?: string | null;
  emailId?: string | null;
}

interface ProbeResult extends ResolvedTarget {
  hasTargetEmail?: boolean;
}

// When the SW passes ?serverUrl=, ?accountId=, or ?accountLabel=, we need the slot whose
// JMAP session owns that account - not just "the first signed-in slot", which is
// what getStalwartCredentials() defaults to. Probe candidate sessions in
// parallel and return the best match.
async function resolveTargetForAccount(
  options: ResolveTargetOptions,
): Promise<ResolvedTarget | null> {
  const { accountId, accountLabel, serverUrl, emailId } = options;
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
            headers: { Authorization: ctx.authHeader },
          }, trusted);
          
          if (!res.ok) {
            logger.warn('push-preview: probe well-known failed', { slot, ctxServerUrl, status: res.status });
            return null;
          }
          const session = (await res.json()) as {
            apiUrl?: string;
            primaryAccounts?: Record<string, string>;
          };
          const mailAccountId = session.primaryAccounts?.['urn:ietf:params:jmap:mail'];
          if (!mailAccountId) {
            logger.warn('push-preview: probe no mail account in session', { slot, ctxServerUrl });
            return null;
          }

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
                headers: { Authorization: ctx.authHeader, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
                  methodCalls: [
                    ['Email/get', { accountId: mailAccountId, ids: [emailId], properties: ['id'] }, '0'],
                  ],
                }),
              }, trusted);
              if (checkRes.ok) {
                const checkData = (await checkRes.json()) as {
                  methodResponses?: [string, { list?: unknown[] }, string][];
                };
                hasTargetEmail = ((checkData?.methodResponses?.[0]?.[1] as { list?: unknown[] })?.list?.length ?? 0) > 0;
              }
            } catch (err) {
              logger.warn('push-preview: probe target email check failed', { slot, err: String(err) });
            }
          }

          logger.info('push-preview: probe success', { slot, ctxServerUrl, hasTargetEmail, trusted });
          return { authHeader: ctx.authHeader, apiUrl: absoluteApiUrl, accountId: mailAccountId, trusted, hasTargetEmail };
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
  return foundWithEmail ?? valid[0] ?? null;
}

async function resolveDefaultTarget(creds: StalwartCredentials): Promise<ResolvedTarget | null> {
  const sessionRes = await fetchJmapServer(`${creds.serverUrl}/.well-known/jmap`, {
    headers: { Authorization: creds.authHeader },
  }, creds.trusted);
  if (!sessionRes.ok) return null;
  const session = (await sessionRes.json()) as {
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

    let target: ResolvedTarget | null = null;
    let authHeader: string;
    if (requestedAccountId || requestedAccountLabel || requestedServerUrl) {
      target = await resolveTargetForAccount({
        accountId: requestedAccountId,
        accountLabel: requestedAccountLabel,
        serverUrl: requestedServerUrl,
        emailId: requestedEmailId,
      });
      if (!target) {
        // Return 401 so the service worker knows the account is not authenticated,
        // which triggers the safe fallback notification ("You have new mail") instead
        // of falsely dropping the notification.
        return NextResponse.json({ error: 'Account not authenticated' }, { status: 401 });
      }
      authHeader = target.authHeader;
    } else {
      const creds = await getStalwartCredentials(request);
      if (!creds) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
      target = await resolveDefaultTarget(creds);
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

    const inboxData = (await inboxRes.json()) as {
      methodResponses: [string, Record<string, unknown>, string][];
    };

    const inboxBody = inboxData.methodResponses.find(
      ([method]) => method === 'Mailbox/query',
    )?.[1] as { ids?: string[] } | undefined;

    const inboxId = inboxBody?.ids?.[0];
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

    const jmapRes = await fetchJmapServer(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }, trusted);
    if (!jmapRes.ok) {
      return NextResponse.json({ error: 'JMAP request failed' }, { status: 502 });
    }
    const data = (await jmapRes.json()) as {
      methodResponses: [string, Record<string, unknown>, string][];
    };

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
        unreadTotal = ((body as { total?: number }).total) ?? 0;
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
      email = null;
    }

    return NextResponse.json({
      email,
      unreadTotal,
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
    // `fetch failed` from undici is too generic to debug - the real reason
    // (ENOTFOUND, ECONNREFUSED, TLS error, …) is on `error.cause`.
    const err = error as Error & { cause?: { code?: string; message?: string } };
    logger.error('push preview failed', {
      error: err?.message ?? 'Unknown error',
      causeCode: err?.cause?.code,
      causeMessage: err?.cause?.message,
    });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
