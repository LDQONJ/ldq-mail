/* eslint-disable no-undef */

// Bulwark service worker.
//
// This SW does two jobs:
//   1. Satisfy the PWA installability requirement (network-only fetch handler,
//      no caching - so we never serve stale chunks after a deployment).
//   2. Receive Web Push wake-up pings from the relay and turn them into
//      enriched system notifications. Mirrors the React Native FCM headless
//      task: relay sends only a state-change ping, the client fetches the
//      newest unread email itself so the relay never sees mail content.

// When the app is mounted at a subpath (Next.js basePath, e.g. /webmail), the
// SW is served at /webmail/sw.js and registered with scope /webmail/. Derive
// the prefix from the SW's own URL so push fetches and notification clicks
// land on the right path - service workers can't read process.env.
function getBasePath() {
  const path = new URL(self.location.href).pathname;
  // self.location is .../sw.js; strip the trailing filename to get the dir,
  // then strip the trailing slash so it concatenates cleanly with `/foo`.
  const dir = path.replace(/[^/]*$/, "");
  return dir.replace(/\/+$/, "");
}

const BASE_PATH = getBasePath();
const MAILTO_CLIENTS = new Map();

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  event.waitUntil(handlePush(event));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(handleNotificationClick(event));
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "mailto-client-ready") {
    if (event.source && event.source.id) {
      MAILTO_CLIENTS.set(event.source.id, {
        path: typeof data.path === "string" ? data.path : "",
        standalone: data.standalone === true,
        clientId: typeof data.clientId === "string" ? data.clientId : "",
        focusNotificationTitle: typeof data.focusNotificationTitle === "string" ? data.focusNotificationTitle : "",
        focusNotificationBody: typeof data.focusNotificationBody === "string" ? data.focusNotificationBody : "",
      });
    }
    return;
  }

  if (data.type === "mailto-client-gone") {
    if (event.source && event.source.id) {
      const current = MAILTO_CLIENTS.get(event.source.id);
      if (!current
        || (typeof data.clientId === "string" && current.clientId === data.clientId)
        || (typeof data.clientId !== "string" && typeof data.path === "string" && current.path === data.path)) {
        MAILTO_CLIENTS.delete(event.source.id);
      }
    }
    return;
  }

  if (data.type === "open-mailto-in-client") {
    event.waitUntil(handleOpenMailtoInClient(event));
    return;
  }

  if (data.type === "focus-existing-mailto-client") {
    event.waitUntil(focusExistingWindowClient(event.source && event.source.id, true));
    return;
  }

  if (data.type !== "focus-existing-client") return;

  event.waitUntil(focusExistingWindowClient(event.source && event.source.id));
});

async function handlePush(event) {
  let payload = null;
  try {
    payload = event.data ? event.data.json() : null;
  } catch (_) {
    payload = null;
  }

  console.log("[SW] handlePush payload:", JSON.stringify(payload).slice(0, 500));

  const accountLabel = (payload && typeof payload.accountLabel === "string")
    ? payload.accountLabel
    : "";
  const serverUrl = (payload && typeof payload.serverUrl === "string")
    ? payload.serverUrl
    : "";

  // Two payload shapes reach us from the relay:
  //   - "jmap-email-push": the server evaluated our per-account delivery
  //     filter (draft-ietf-jmap-emailpush) and this is a list of the new
  //     message ids that passed it - spam filed into Junk never gets here.
  //   - "jmap-state-change" (older servers): a bare EmailDelivery ping wrapped
  //     as { changed: { [accountId]: {...} } }, fired for every ingested
  //     message including junk. The relay forwards a single account per push,
  //     so the first key is the one this notification is for.
  const changed = payload && payload.changed && typeof payload.changed === "object"
    ? payload.changed
    : null;
  const accountId = (payload && typeof payload.accountId === "string" && payload.accountId)
    || (changed ? Object.keys(changed)[0] || "" : "");
  const emailIds = payload && Array.isArray(payload.emailIds)
    ? payload.emailIds.filter((id) => typeof id === "string" && id)
    : [];

  // Scoped key for notified cache: prevents account A's message IDs colliding
  // with account B's cache when both accounts share accountId "0".
  const notifiedScope = accountLabel || serverUrl || accountId || "default";
  const notified = await readNotifiedIds(notifiedScope);
  const freshIds = emailIds.filter((id) => !notified.includes(id));
  if (emailIds.length > 0 && freshIds.length === 0) {
    return;
  }

  // Best effort: ask the webmail to look up the email so we can build a useful
  // notification. With ids from the server we ask for exactly the newest of
  // them; otherwise the API falls back to the newest unread Inbox message. If
  // the request fails (offline, session expired, server down) we fall back to
  // a generic "New mail" so the user still sees something.
  let preview = null;
  let previewOk = false;
  try {
    const query = new URLSearchParams();
    if (accountId) query.set("accountId", accountId);
    if (accountLabel) query.set("accountLabel", accountLabel);
    if (serverUrl) query.set("serverUrl", serverUrl);
    if (freshIds.length > 0) query.set("emailId", freshIds[freshIds.length - 1]);
    const qs = query.toString();
    const previewUrl = `${BASE_PATH}/api/push/preview${qs ? `?${qs}` : ""}`;
    console.log("[SW] push-preview fetch:", previewUrl);
    const res = await fetch(previewUrl, {
      credentials: "include",
      cache: "no-store",
    });
    console.log("[SW] push-preview response:", res.status, res.ok);
    if (res.ok) {
      preview = await res.json();
      previewOk = true;
      console.log("[SW] push-preview data:", JSON.stringify(preview).slice(0, 300));
    } else {
      // Non-ok response: still try to parse for debugging
      try {
        const errBody = await res.text();
        console.log("[SW] push-preview error body:", errBody.slice(0, 200));
      } catch (_) { /* ignore */ }
    }
  } catch (err) {
    console.log("[SW] push-preview fetch error:", err);
    preview = null;
  }

  const email = preview && preview.email ? preview.email : null;
  const unreadTotal = preview && typeof preview.unreadTotal === "number"
    ? preview.unreadTotal
    : 0;

  // Push subscription is scoped to EmailDelivery, but stragglers from the
  // older broader-types subscription, marking-as-read races and verification
  // pings can still wake us with no actual unread mail.
  // Only stay silent when there are NO explicit emailIds provided (legacy state-change ping)
  // and preview confirmed 0 unread messages. If emailIds were delivered by emailPush (freshIds > 0),
  // a new message definitely arrived, so always notify (fallback to generic if preview details missing).
  if (emailIds.length === 0 && previewOk && !email && unreadTotal === 0) {
    console.log("[SW] suppressed: previewOk=true, no email, unreadTotal=0");
    return;
  }

  // State-change path only (no ids from the server): the newest unread Inbox
  // message is one we already announced, so whatever woke us was not new
  // Inbox mail - typically a delivery into Junk or a Sieve-filed folder.
  if (emailIds.length === 0 && previewOk && email && notified.includes(email.id)) {
    return;
  }

  // Group per account under one shared tag so a burst of new mail collapses
  // into a single, self-updating notification instead of one toast per message
  // (Android renders one notification per unique tag, which is why 50 arrivals
  // used to stack 50 toasts). The newest message is the headline and a
  // Gmail-style "+N more" line carries the rest, counted from the account's
  // unread total.
  const groupTag = "bulwark-mail:" + (accountLabel || accountId || "default");
  let title;
  let body;
  let data = { kind: "mail-list", accountId, accountLabel, serverUrl };

  if (email) {
    const sender = email.from && email.from[0];
    const senderName = (sender && sender.name) || (sender && sender.email) || "新邮件";
    title = senderName + (accountLabel ? ` (${accountLabel})` : "");
    body = email.subject || email.preview || "(无主题)";
    const more = unreadTotal > 1 ? unreadTotal - 1 : 0;
    if (more > 0) {
      // Several unread: this is a group. Keep the newest as the headline, add
      // the "+N more" count, and open the inbox (not one message) on click.
      body += "\n" + `+${more} 封新邮件`;
    } else {
      // Exactly one unread: deep-link straight to that message on click.
      data = { kind: "email", emailId: email.id, threadId: email.threadId, accountLabel, serverUrl };
    }
  } else {
    title = accountLabel ? `新邮件 (${accountLabel})` : "新邮件";
    body = unreadTotal > 1 ? `${unreadTotal} 封未读邮件` : "您收到了一封新邮件";
  }

  await self.registration.showNotification(title, {
    body,
    // Shared per-account tag: each new push replaces the account's single
    // notification rather than adding another.
    tag: groupTag,
    // Branded app icon via the PWA-icon endpoint (admin-configured, else the
    // built-in default). The static /icon-192x192.png ignored admin branding.
    icon: `${BASE_PATH}/api/pwa-icon/192`,
    badge: `${BASE_PATH}/api/pwa-icon/192`,
    data,
    renotify: true,
  });

  const announced = freshIds.length > 0 ? freshIds : (email ? [email.id] : []);
  if (announced.length > 0) {
    await writeNotifiedIds(notifiedScope, notified.concat(announced));
  }
}

// Per-account list of message ids we have already shown a notification for.
// Service workers have no localStorage; the Cache API is the cheapest durable
// store that survives the worker being killed between pushes. Failures are
// swallowed - dedupe is a nicety, delivering the notification is not.
const PUSH_STATE_CACHE = "bulwark-push-state-v1";
const NOTIFIED_IDS_LIMIT = 200;

function notifiedIdsKey(accountId) {
  return `${self.location.origin}${BASE_PATH}/__push-state/notified/${encodeURIComponent(accountId || "default")}`;
}

async function readNotifiedIds(accountId) {
  try {
    const cache = await caches.open(PUSH_STATE_CACHE);
    const res = await cache.match(notifiedIdsKey(accountId));
    if (!res) return [];
    const data = await res.json();
    return Array.isArray(data.ids) ? data.ids.filter((id) => typeof id === "string") : [];
  } catch (_) {
    return [];
  }
}

async function writeNotifiedIds(accountId, ids) {
  try {
    const cache = await caches.open(PUSH_STATE_CACHE);
    const unique = Array.from(new Set(ids)).slice(-NOTIFIED_IDS_LIMIT);
    await cache.put(
      notifiedIdsKey(accountId),
      new Response(JSON.stringify({ ids: unique }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
  } catch (_) {
    // Best effort only.
  }
}

async function handleNotificationClick(event) {
  const data = event.notification.data || {};
  const tag = event.notification.tag || "";

  if (data.kind === "protocol-mailto-focus") {
    return handleMailtoFocusNotificationClick();
  }

  const targetUrl = buildClickUrl(data);

  const allClients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  // Notify any in-app clients so plugins listening on toastHooks.onNotificationClick fire.
  for (const client of allClients) {
    try {
      client.postMessage({ kind: "notificationclick", tag, data });
    } catch (_) {
      // Closed or detached client - ignore.
    }
  }

  for (const client of allClients) {
    // Reuse an existing tab whenever possible - users on desktop browsers
    // get annoyed when each notification opens a fresh window.
    if (client.frameType === "top-level" && "focus" in client) {
      try {
        const focusedClient = await client.focus();
        if ("navigate" in focusedClient && targetUrl) {
          return focusedClient.navigate(targetUrl);
        }
        return focusedClient;
      } catch (_) {
        // navigate() can reject for cross-origin or detached clients - fall
        // through and open a new window below.
      }
    }
  }

  if (self.clients.openWindow) {
    return self.clients.openWindow(targetUrl || `${BASE_PATH}/`);
  }
}

async function focusExistingWindowClient(sourceClientId, requireMailtoReady) {
  const entry = await findReusableWindowClientEntry(sourceClientId, requireMailtoReady);
  const client = entry && entry.client;
  if (client && "focus" in client) {
    return client.focus();
  }
}

async function handleMailtoFocusNotificationClick() {
  const entry = await findReusableWindowClientEntry(null, true);
  const client = entry && entry.client;
  if (client && "focus" in client) {
    try {
      return await client.focus();
    } catch (_) {
      // Fall through to opening a new app window if activation is still blocked.
    }
  }

  if (self.clients.openWindow) {
    return self.clients.openWindow(`${BASE_PATH}/`);
  }
}

async function handleOpenMailtoInClient(event) {
  const data = event.data || {};
  const responsePort = event.ports && event.ports[0];
  const entry = await findReusableWindowClientEntry(event.source && event.source.id, true);
  const client = entry && entry.client;
  const state = entry && entry.state;

  if (!client || !state || !state.clientId) {
    responsePort && responsePort.postMessage({ delivered: false });
    return;
  }

  try {
    client.postMessage({ type: "mailto-request", id: data.id, clientId: state.clientId, value: data.value });
  } catch (_) {
    responsePort && responsePort.postMessage({ delivered: false });
    return;
  }

  if ("focus" in client) {
    try {
      const focusedClient = await client.focus();
      // Browsers often silently ignore focus requests from background message events.
      // If the client didn't actually come to the foreground, show the notification.
      if (focusedClient && focusedClient.visibilityState !== "visible") {
        await showMailtoFocusNotification(state);
      }
    } catch (_) {
      // Delivery succeeded; focusing can still be blocked by browser policy.
      await showMailtoFocusNotification(state);
    }
  }

  responsePort && responsePort.postMessage({ delivered: true });
}

async function showMailtoFocusNotification(state) {
  try {
    await self.registration.showNotification(state.focusNotificationTitle || "Bulwark", {
      body: state.focusNotificationBody || "The request was opened in Bulwark. Click to bring it to the front.",
      tag: "bulwark-mailto-focus",
      icon: `${BASE_PATH}/api/pwa-icon/192`,
      badge: `${BASE_PATH}/api/pwa-icon/192`,
      data: { kind: "protocol-mailto-focus" },
      renotify: true,
    });
  } catch (_) {
    // Notification permission may be missing; the mailto request was still delivered.
  }
}

async function findReusableWindowClientEntry(sourceClientId, requireMailtoReady) {
  const scopedPath = BASE_PATH ? `${BASE_PATH}/` : "/";
  const allClients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  const candidates = [];

  for (const client of allClients) {
    if (client.id === sourceClientId || client.frameType !== "top-level") continue;
    const state = MAILTO_CLIENTS.get(client.id);
    if (requireMailtoReady && !state) continue;

    try {
      const url = new URL(client.url);
      if (url.origin !== self.location.origin) continue;
      if (!url.pathname.startsWith(scopedPath)) continue;
      if (url.pathname.includes("/protocol/")) continue;

      candidates.push({ client, state, score: getReusableClientScore(state) });
    } catch (_) {
      // Detached clients can disappear while iterating.
    }
  }

  candidates.sort((a, b) => a.score - b.score);
  return candidates[0];
}

/**
 * Whether a client's path is the mail section. Since #733 the mail client
 * keeps a permalink in the address bar, so an open inbox reads as
 * `/mail/folder/inbox` (optionally behind a mount prefix and a locale
 * segment) rather than a bare "/".
 *
 * Deliberately duplicated from lib/deep-links.ts: this file is served raw, not
 * bundled, so it cannot import from the app. The locale segment is matched by
 * shape (two lowercase letters) because the worker has no locale list - and no
 * app route is a bare two-letter segment.
 */
function isMailSectionPath(path) {
  if (!path) return true;
  let rest = path;
  if (BASE_PATH && (rest === BASE_PATH || rest.startsWith(`${BASE_PATH}/`))) {
    rest = rest.slice(BASE_PATH.length);
  }
  const segments = rest.split("/").filter(Boolean);
  if (segments.length > 0 && /^[a-z]{2}$/.test(segments[0])) segments.shift();
  return segments.length === 0 || segments[0] === "mail";
}

function getReusableClientScore(state) {
  if (!state) return 4;

  const isMailSection = isMailSectionPath(state.path);
  if (state.standalone && isMailSection) return 0;
  if (isMailSection) return 1;
  if (state.standalone) return 2;
  return 3;
}

function buildClickUrl(data) {
  const base = !data ? `${BASE_PATH}/` : 
               (data.kind === "email" && data.emailId) ? `${BASE_PATH}/mail/message/${encodeURIComponent(data.emailId)}` :
               `${BASE_PATH}/?openLatestUnread=1`;
  
  if (!data || (!data.accountLabel && !data.serverUrl)) {
    return new URL(base, self.location.origin).href;
  }
  
  const url = new URL(`${BASE_PATH}/push-redirect`, self.location.origin);
  if (data.accountLabel) url.searchParams.set("accountLabel", data.accountLabel);
  if (data.serverUrl) url.searchParams.set("serverUrl", data.serverUrl);
  url.searchParams.set("to", base);
  
  return url.href;
}
