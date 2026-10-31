import { NextRequest, NextResponse } from 'next/server';
import { isNoThirdPartyTrafficOn, thirdPartyRefusal } from '@/lib/admin/third-party-mode';
import { getRootDomain } from '@/lib/root-domain';

// In-memory LRU cache: domain -> { data, contentType, fetchedAt }
const CACHE_MAX_SIZE = 1000;
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 2 weeks
/** Concurrent upstream icon fetches across all callers (see GET). */
const MAX_UPSTREAM_IN_FLIGHT = 16;
let upstreamInFlight = 0;

interface CacheEntry {
  data: ArrayBuffer;
  contentType: string;
  fetchedAt: number;
}

interface NegativeCacheEntry {
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const negativeCache = new Map<string, NegativeCacheEntry>();
const NEGATIVE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day
const NEGATIVE_CACHE_MAX_SIZE = 2000;
// A refresh request (?v=<ms>) refetches a domain at most this often, so the
// unauthenticated route can't be used to hammer the upstream icon service.
const MIN_REFRESH_INTERVAL_MS = 60 * 1000;

// Set of specified domains that prioritize direct fetching mail.{rootDomain} favicon
const PRIORITY_DIRECT_DOMAINS = new Set<string>([
  'lidaqian.com',
]);

// 1x1 transparent PNG. Returned with HTTP 200 (instead of 404) when no
// favicon exists for a domain, so the browser's <img> tag loads it cleanly
// without spamming the DevTools console with red 404 errors. Avatar.tsx
// checks `naturalWidth <= 1` in onLoad and falls back to initials.
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=',
  'base64',
);
const MISSING_FAVICON_HEADERS = {
  'Content-Type': 'image/png',
  'Cache-Control': 'public, max-age=86400', // 1 day
  'X-Bulwark-Favicon': 'missing',
};

// Strict domain validation to prevent SSRF
const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

function isValidDomain(domain: string): boolean {
  if (domain.length > 253) return false;
  if (!DOMAIN_RE.test(domain)) return false;
  // Block internal/private hostnames
  const lower = domain.toLowerCase();
  if (
    lower === 'localhost' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower.endsWith('.arpa')
  ) {
    return false;
  }
  return true;
}

function evictOldest() {
  if (cache.size < CACHE_MAX_SIZE) return;
  let oldestKey: string | null = null;
  let oldestTime = Infinity;
  for (const [key, entry] of cache) {
    if (entry.fetchedAt < oldestTime) {
      oldestTime = entry.fetchedAt;
      oldestKey = key;
    }
  }
  if (oldestKey) cache.delete(oldestKey);
}

const RASTER_FAVICON_TYPES = new Set([
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/png',
  'image/gif',
  'image/jpeg',
  'image/webp',
  'image/bmp',
]);

/** The upstream type when it is a raster image, else null. */
function rasterFaviconType(header: string | null): string | null {
  const type = (header ?? 'image/x-icon').split(';')[0].trim().toLowerCase();
  return RASTER_FAVICON_TYPES.has(type) ? type : null;
}

function faviconHeaders(contentType: string, cacheHeader?: string): Record<string, string> {
  return {
    'Content-Type': contentType,
    'Cache-Control': cacheHeader || 'public, max-age=1209600', // 2 weeks
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  };
}

function evictNegativeOldest() {
  if (negativeCache.size < NEGATIVE_CACHE_MAX_SIZE) return;
  let oldestKey: string | null = null;
  let oldestTime = Infinity;
  for (const [key, entry] of negativeCache) {
    if (entry.fetchedAt < oldestTime) {
      oldestTime = entry.fetchedAt;
      oldestKey = key;
    }
  }
  if (oldestKey) negativeCache.delete(oldestKey);
}

/**
 * The time from a ?v= refresh stamp, or null. Avatars send the moment the
 * user asked for fresh sender icons (#960); a stamp in the future is clamped
 * to now so it can't keep a domain permanently uncached.
 */
function parseRefreshAfter(value: string | null): number | null {
  if (!value || !/^\d{1,15}$/.test(value)) return null;
  return Math.min(Number(value), Date.now());
}

/** Whether a cache entry predates the refresh the client asked for. */
function isStale(fetchedAt: number, refreshAfter: number | null): boolean {
  if (refreshAfter === null || fetchedAt >= refreshAfter) return false;
  return Date.now() - fetchedAt >= MIN_REFRESH_INTERVAL_MS;
}

// 1. Direct fetch from target server (preserves 32-bit RGBA transparent background!)
async function fetchDirectFavicon(targetDomain: string): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  const paths = ['/favicon.ico', '/favicon.png'];

  for (const pathStr of paths) {
    try {
      const url = `https://${targetDomain}${pathStr}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(3000), // 3s timeout
      });

      if (res.ok) {
        const rawType = res.headers.get('content-type') || (pathStr.endsWith('.png') ? 'image/png' : 'image/x-icon');
        const contentType = rasterFaviconType(rawType);
        if (!contentType) continue;

        const data = await res.arrayBuffer();
        if (data.byteLength >= 10) {
          return { data, contentType };
        }
      }
    } catch {
      // Continue to next path
    }
  }
  return null;
}

// 2. DuckDuckGo fetch with in-flight concurrency limiter
async function fetchDuckDuckGoFavicon(targetDomain: string): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  if (upstreamInFlight >= MAX_UPSTREAM_IN_FLIGHT) {
    return null;
  }
  upstreamInFlight++;
  try {
    const upstream = await fetch(
      `https://icons.duckduckgo.com/ip3/${encodeURIComponent(targetDomain)}.ico`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!upstream.ok) return null;

    const contentType = rasterFaviconType(upstream.headers.get('content-type'));
    if (!contentType) return null;

    const data = await upstream.arrayBuffer();
    if (data.byteLength < 10) return null;

    return { data, contentType };
  } catch {
    return null;
  } finally {
    upstreamInFlight--;
  }
}

export async function GET(request: NextRequest) {
  // Sender icons come from DuckDuckGo: off, before anything else, while the
  // server must not contact outside services (#903).
  if (await isNoThirdPartyTrafficOn()) return thirdPartyRefusal('Sender icons');

  const domain = request.nextUrl.searchParams.get('domain');
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';

  if (!domain || !isValidDomain(domain)) {
    return new NextResponse(null, {
      status: 400,
      headers: { 'Cache-Control': 'public, max-age=86400' },
    });
  }

  const rawDomain = domain.trim().toLowerCase();
  const rootDomain = getRootDomain(rawDomain);
  const refreshAfter = parseRefreshAfter(request.nextUrl.searchParams.get('v'));
  const isPriorityDirectDomain = PRIORITY_DIRECT_DOMAINS.has(rootDomain) || PRIORITY_DIRECT_DOMAINS.has(rawDomain);

  if (forceRefresh) {
    cache.delete(rawDomain);
    cache.delete(rootDomain);
    negativeCache.delete(rawDomain);
    negativeCache.delete(rootDomain);
  } else {
    // Check in-memory cache first
    for (const cand of [rawDomain, rootDomain]) {
      const cached = cache.get(cand);
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS && !isStale(cached.fetchedAt, refreshAfter)) {
        return new NextResponse(cached.data, {
          headers: faviconHeaders(cached.contentType),
        });
      }
    }

    // Check negative cache
    const neg = negativeCache.get(rootDomain) || negativeCache.get(rawDomain);
    if (neg && Date.now() - neg.fetchedAt < NEGATIVE_CACHE_TTL_MS && !isStale(neg.fetchedAt, refreshAfter)) {
      return new NextResponse(TRANSPARENT_PNG, { headers: MISSING_FAVICON_HEADERS });
    }
  }

  const cacheHeader = forceRefresh
    ? 'no-cache, no-store, must-revalidate'
    : undefined;

  // SCENARIO 1: Specified priority domain (e.g. lidaqian.com)
  if (isPriorityDirectDomain) {
    const mailDomain = rootDomain.startsWith('mail.') ? rootDomain : `mail.${rootDomain}`;
    const directCandidates = [mailDomain, rootDomain];

    // Try direct HTTP fetch
    for (const cand of directCandidates) {
      const directResult = await fetchDirectFavicon(cand);
      if (directResult) {
        negativeCache.delete(cand);
        negativeCache.delete(rawDomain);
        negativeCache.delete(rootDomain);
        evictOldest();
        cache.set(cand, { data: directResult.data, contentType: directResult.contentType, fetchedAt: Date.now() });
        cache.set(rawDomain, { data: directResult.data, contentType: directResult.contentType, fetchedAt: Date.now() });
        cache.set(rootDomain, { data: directResult.data, contentType: directResult.contentType, fetchedAt: Date.now() });

        return new NextResponse(directResult.data, {
          headers: faviconHeaders(directResult.contentType, cacheHeader),
        });
      }
    }

    // Fallback to DuckDuckGo if direct fetch fails for priority domain
    for (const cand of directCandidates) {
      const ddgResult = await fetchDuckDuckGoFavicon(cand);
      if (ddgResult) {
        negativeCache.delete(cand);
        negativeCache.delete(rawDomain);
        negativeCache.delete(rootDomain);
        evictOldest();
        cache.set(cand, { data: ddgResult.data, contentType: ddgResult.contentType, fetchedAt: Date.now() });
        cache.set(rawDomain, { data: ddgResult.data, contentType: ddgResult.contentType, fetchedAt: Date.now() });
        cache.set(rootDomain, { data: ddgResult.data, contentType: ddgResult.contentType, fetchedAt: Date.now() });

        return new NextResponse(ddgResult.data, {
          headers: faviconHeaders(ddgResult.contentType, cacheHeader),
        });
      }
    }
  } else {
    // SCENARIO 2: Default general domain (e.g. google.com, github.com, etc.)
    const ddgResult = await fetchDuckDuckGoFavicon(rootDomain);
    if (ddgResult) {
      negativeCache.delete(rawDomain);
      negativeCache.delete(rootDomain);
      evictOldest();
      cache.set(rawDomain, { data: ddgResult.data, contentType: ddgResult.contentType, fetchedAt: Date.now() });
      cache.set(rootDomain, { data: ddgResult.data, contentType: ddgResult.contentType, fetchedAt: Date.now() });

      return new NextResponse(ddgResult.data, {
        headers: faviconHeaders(ddgResult.contentType, cacheHeader),
      });
    }
  }

  // A refresh that can't reach upstream keeps showing the icon we have
  const existingCached = cache.get(rawDomain) || cache.get(rootDomain);
  if (existingCached) {
    return new NextResponse(existingCached.data, { headers: faviconHeaders(existingCached.contentType) });
  }

  // If no favicon could be resolved
  evictNegativeOldest();
  negativeCache.set(rootDomain, { fetchedAt: Date.now() });
  negativeCache.set(rawDomain, { fetchedAt: Date.now() });

  return new NextResponse(TRANSPARENT_PNG, { headers: MISSING_FAVICON_HEADERS });
}
