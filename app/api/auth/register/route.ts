import { NextRequest, NextResponse } from 'next/server';
import { verifyInviteCode, consumeInviteCode } from '@/lib/admin/invite-manager';
import { getClientIP } from '@/lib/admin/session';
import { configManager } from '@/lib/admin/config-manager';
import { parseJmapServers } from '@/lib/admin/jmap-servers';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { inviteCode, username, domain, password, displayName } = body;

    // 1. Basic validation
    if (!inviteCode || typeof inviteCode !== 'string' || !inviteCode.trim()) {
      return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
    }
    if (!username || typeof username !== 'string' || !username.trim()) {
      return NextResponse.json({ error: 'Username prefix is required' }, { status: 400 });
    }
    if (!domain || typeof domain !== 'string' || !domain.trim()) {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanDomain = domain.trim().toLowerCase();
    const userDisplayName = (typeof displayName === 'string' && displayName.trim())
      ? displayName.trim()
      : cleanUsername;

    // Validate username characters
    if (!/^[a-z0-9._-]+$/i.test(cleanUsername)) {
      return NextResponse.json({ error: 'Username contains invalid characters (letters, numbers, dot, dash, underscore only)' }, { status: 400 });
    }

    // 2. Verify Invite Code
    const inviteCheck = await verifyInviteCode(inviteCode);
    if (!inviteCheck.valid || !inviteCheck.invite) {
      return NextResponse.json({ error: inviteCheck.error || 'Invalid invite code' }, { status: 400 });
    }

    const targetEmail = `${cleanUsername}@${cleanDomain}`;
    const clientIp = getClientIP(request);

    // 3. Resolve Stalwart Admin JMAP URL & Token for the requested domain
    await configManager.ensureLoaded();
    const rawServers = configManager.get('jmapServers', []) || process.env.JMAP_SERVERS;
    const servers = parseJmapServers(rawServers);

    // Match server whose domains list contains cleanDomain
    const matchedServer = servers.find((s) =>
      (s.domains ?? []).some((d) => d.toLowerCase() === cleanDomain)
    );

    let serverBaseUrl = '';
    let adminToken = '';

    if (matchedServer) {
      serverBaseUrl = matchedServer.url;
      adminToken = matchedServer.adminToken || process.env.STALWART_ADMIN_TOKEN || configManager.get<string>('stalwartAdminToken', '') || '';
    } else {
      // Fallback to global config or STALWART_ADMIN_URL / JMAP_SERVER_URL
      serverBaseUrl = process.env.STALWART_ADMIN_URL || configManager.get<string>('stalwartAdminUrl', '') || configManager.get<string>('jmapServerUrl', '') || process.env.JMAP_SERVER_URL || '';
      adminToken = process.env.STALWART_ADMIN_TOKEN || configManager.get<string>('stalwartAdminToken', '') || '';
    }

    let jmapEndpoint = '';
    if (serverBaseUrl) {
      const cleanBase = serverBaseUrl.replace(/\/+$/, '');
      jmapEndpoint = cleanBase.endsWith('/jmap') ? cleanBase : `${cleanBase}/jmap`;
    }

    if (!jmapEndpoint) {
      return NextResponse.json({
        error: `Stalwart API is not configured for domain @${cleanDomain}. Please contact administrator.`,
      }, { status: 500 });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (adminToken) {
      headers['Authorization'] = adminToken.startsWith('Bearer ') || adminToken.startsWith('Basic ')
        ? adminToken
        : `Bearer ${adminToken}`;
    }

    // 4. Step A: Query Stalwart domains (x:Domain/get) to find the internal domainId for cleanDomain
    let matchedDomainId: any = null;

    try {
      const domainQueryPayload = {
        using: ['urn:ietf:params:jmap:core', 'urn:stalwart:jmap'],
        methodCalls: [
          ['x:Domain/get', { ids: null }, 'd1'],
        ],
      };

      const domainRes = await fetch(jmapEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(domainQueryPayload),
      });

      if (domainRes.ok) {
        const domainData = await domainRes.json().catch(() => ({}));
        const domainList = domainData.methodResponses?.[0]?.[1]?.list;
        if (Array.isArray(domainList)) {
          const found = domainList.find((d: any) => d?.name?.toLowerCase() === cleanDomain);
          if (found) {
            matchedDomainId = found.id;
          }
        }
      }
    } catch (err) {
      logger.warn('Failed to query Stalwart domains list via JMAP', { error: err });
    }

    // If domainId was not found via x:Domain/get, attempt cleanDomain
    if (matchedDomainId === null || matchedDomainId === undefined) {
      matchedDomainId = cleanDomain;
    }

    // 4. Step B: Call Stalwart JMAP API (x:Account/set) to create user account
    let accountCreated = false;
    let createErrorMsg = '';

    try {
      // Stalwart JMAP x:Account/set:
      // - name: local part (e.g. "alice")
      // - domainId: matched domain ID or string
      // - description: used as user's Display Name in Stalwart
      // - credentials: Object with numeric string key ("0"): { "0": { "@type": "Password", "secret": "..." } }
      const jmapPayload = {
        using: [
          'urn:ietf:params:jmap:core',
          'urn:stalwart:jmap',
        ],
        methodCalls: [
          [
            'x:Account/set',
            {
              create: {
                acc1: {
                  '@type': 'User',
                  name: cleanUsername,
                  domainId: matchedDomainId,
                  description: userDisplayName,
                  credentials: {
                    '0': {
                      '@type': 'Password',
                      secret: password,
                    },
                  },
                },
              },
            },
            'call1',
          ],
        ],
      };

      const res = await fetch(jmapEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(jmapPayload),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const responseMethod = data.methodResponses?.[0];
        const result = responseMethod?.[1];

        if (result?.created?.acc1) {
          accountCreated = true;
        } else if (result?.notCreated?.acc1) {
          const failure = result.notCreated.acc1;
          logger.error('Stalwart account creation JMAP notCreated', { failure });
          if (failure.type === 'alreadyExists' || (failure.description && failure.description.toLowerCase().includes('already exists'))) {
            createErrorMsg = 'An account with this email address already exists';
          } else {
            createErrorMsg = `Account creation failed: ${failure.description || failure.type || 'Unknown error'}`;
          }
        } else {
          // If response status is 200 OK and no notCreated error
          accountCreated = true;
        }
      } else if (res.status === 401 || res.status === 403) {
        createErrorMsg = 'Stalwart Admin authentication failed (401/403). Please verify STALWART_ADMIN_TOKEN / credentials.';
      } else {
        const errText = await res.text().catch(() => '');
        logger.error('Stalwart JMAP account creation failed', { status: res.status, body: errText });
        createErrorMsg = `Stalwart JMAP API error (${res.status}): ${errText || 'Failed to create user account'}`;
      }
    } catch (fetchErr) {
      logger.error('Failed to connect to Stalwart JMAP API', { error: fetchErr });
      createErrorMsg = `Cannot connect to Stalwart API at ${jmapEndpoint}. Please check network or configuration.`;
    }

    if (!accountCreated) {
      return NextResponse.json({ error: createErrorMsg }, { status: 400 });
    }

    // 5. Consume the invite code upon successful registration
    await consumeInviteCode(inviteCode, targetEmail, clientIp);

    logger.info('User successfully registered with invite code', { email: targetEmail, code: inviteCode, ip: clientIp });

    return NextResponse.json({
      success: true,
      email: targetEmail,
      message: 'Account registered successfully!',
    });
  } catch (error) {
    logger.error('Registration processing error', { error: error instanceof Error ? error.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error during registration' }, { status: 500 });
  }
}
