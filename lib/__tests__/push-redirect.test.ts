import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toRouterPath } from '@/lib/browser-navigation';

describe('push-redirect URL cleaning and routing', () => {
  function cleanDestination(targetUrl: string | null) {
    const raw = targetUrl || '/';
    try {
      const parsed = new URL(raw, 'http://localhost');
      parsed.searchParams.delete('slot');
      parsed.searchParams.delete('owner');
      const path = parsed.pathname + (parsed.search ? parsed.search : '') + parsed.hash;
      return toRouterPath(path);
    } catch {
      return toRouterPath(raw.replace(/[?&](slot|owner)=[^&#]*/g, ''));
    }
  }

  it('strips slot and owner query parameters from message URL', () => {
    const target = '/mail/message/msg_123?slot=0&owner=0';
    const cleaned = cleanDestination(target);
    expect(cleaned).toBe('/mail/message/msg_123');
  });

  it('preserves other query parameters while removing slot and owner', () => {
    const target = '/mail/message/msg_123?view=fullscreen&slot=1&owner=acc_1&custom=test';
    const cleaned = cleanDestination(target);
    expect(cleaned).toBe('/mail/message/msg_123?view=fullscreen&custom=test');
  });

  it('handles folder URLs with slot parameter', () => {
    const target = '/mail/folder/inbox?slot=1';
    const cleaned = cleanDestination(target);
    expect(cleaned).toBe('/mail/folder/inbox');
  });

  it('handles null or empty target gracefully', () => {
    expect(cleanDestination(null)).toBe('/');
    expect(cleanDestination('')).toBe('/');
  });
});

describe('push-redirect account matching logic', () => {
  interface MockAccount {
    id: string;
    username: string;
    serverUrl: string;
    cookieSlot: number;
    serverIdentifiers?: string[];
  }

  const accounts: MockAccount[] = [
    {
      id: 'admin@ldqmail.com@stalwart.ldqmail.com',
      username: 'admin@ldqmail.com',
      serverUrl: 'https://stalwart.ldqmail.com',
      cookieSlot: 0,
      serverIdentifiers: ['0', 'u123'],
    },
    {
      id: 'admin@lidaqian.com@stalwart.lidaqian.com',
      username: 'admin@lidaqian.com',
      serverUrl: 'https://stalwart.lidaqian.com',
      cookieSlot: 1,
      serverIdentifiers: ['0', 'u456'],
    },
    {
      id: 'testuser@ldqmail.com@stalwart.ldqmail.com',
      username: 'testuser',
      serverUrl: 'https://stalwart.ldqmail.com',
      cookieSlot: 2,
    },
  ];

  function matchAccount(params: {
    accountLabel?: string | null;
    serverUrl?: string | null;
    slotParam?: string | null;
    accountIdParam?: string | null;
  }) {
    const { accountLabel, serverUrl, slotParam, accountIdParam } = params;
    let targetAccountId: string | null = null;

    if (serverUrl || accountLabel) {
      for (const account of accounts) {
        let serverMatch = true;
        if (serverUrl) {
          const normalizedTargetServer = serverUrl.replace(/\/+$/, '').toLowerCase();
          const normalizedAccServer = account.serverUrl.replace(/\/+$/, '').toLowerCase();
          try {
            const targetHost = new URL(normalizedTargetServer).hostname;
            const accHost = new URL(normalizedAccServer).hostname;
            if (targetHost !== accHost) serverMatch = false;
          } catch {
            if (normalizedTargetServer !== normalizedAccServer) serverMatch = false;
          }
        }

        let labelMatch = true;
        if (accountLabel && serverMatch) {
          const normalizedLabel = accountLabel.toLowerCase().trim();
          const labelUser = normalizedLabel.split('@')[0];
          const labelDomain = normalizedLabel.split('@')[1];

          const ctxUsername = account.username.toLowerCase().trim();
          const ctxUser = ctxUsername.split('@')[0];
          const ctxDomain = ctxUsername.split('@')[1];

          let ctxServerHostname = '';
          try {
            ctxServerHostname = new URL(account.serverUrl).hostname.toLowerCase();
          } catch {}

          if (labelDomain) {
            const domainMatches = (ctxDomain && ctxDomain === labelDomain) || ctxServerHostname.includes(labelDomain);
            if (!domainMatches) labelMatch = false;
          }
          if (labelUser && labelUser !== ctxUser && ctxUsername !== normalizedLabel) {
            labelMatch = false;
          }
        }

        if (serverMatch && labelMatch) {
          targetAccountId = account.id;
          break;
        }
      }
    }

    if (!targetAccountId && slotParam !== null && slotParam !== undefined && slotParam !== '') {
      const slotNum = Number(slotParam);
      if (Number.isInteger(slotNum)) {
        const matched = accounts.find((a) => a.cookieSlot === slotNum);
        if (matched) targetAccountId = matched.id;
      }
    }

    if (!targetAccountId && accountIdParam) {
      const matched = accounts.find(
        (a) => a.id === accountIdParam || a.serverIdentifiers?.includes(accountIdParam),
      );
      if (matched) targetAccountId = matched.id;
    }

    return targetAccountId;
  }

  it('matches secondary account by serverUrl and accountLabel', () => {
    const matched = matchAccount({
      accountLabel: 'admin@lidaqian.com',
      serverUrl: 'https://stalwart.lidaqian.com',
    });
    expect(matched).toBe('admin@lidaqian.com@stalwart.lidaqian.com');
  });

  it('matches primary account by serverUrl and accountLabel', () => {
    const matched = matchAccount({
      accountLabel: 'admin@ldqmail.com',
      serverUrl: 'https://stalwart.ldqmail.com',
    });
    expect(matched).toBe('admin@ldqmail.com@stalwart.ldqmail.com');
  });

  it('falls back to cookieSlot when label and serverUrl are absent', () => {
    const matched = matchAccount({
      slotParam: '1',
    });
    expect(matched).toBe('admin@lidaqian.com@stalwart.lidaqian.com');
  });

  it('matches username without domain when domain is part of server URL', () => {
    const matched = matchAccount({
      accountLabel: 'testuser@ldqmail.com',
      serverUrl: 'https://stalwart.ldqmail.com',
    });
    expect(matched).toBe('testuser@ldqmail.com@stalwart.ldqmail.com');
  });
});
