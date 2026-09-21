/* Firebase Cloud Messaging background worker. Config arrives in the query
   string because service workers cannot read import.meta.env. */
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

/* Take over immediately. Push events go to the ACTIVE worker, so without these
   a fixed worker would sit in "waiting" until every tab is closed, and the old
   buggy one would keep handling notifications. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

firebase.initializeApp(Object.fromEntries(new URL(self.location).searchParams));
const messaging = firebase.messaging();


/* Show the notification ourselves instead of trusting the SDK default: if the
   payload's notification block is incomplete the default quietly shows nothing. */
messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {};
  const d = payload.data || {};
  const title = n.title || d.title || "Reminder";

  /* ---- TEMPORARY DIAGNOSTIC BRANCH — remove once iOS silent-push cause found ---- */
  if (d.testVariant) {
    const base = { body: n.body || d.body || "", icon: "/icons/icon-192.png" };
    const variants = {
      v1: base,
      v2: { ...base, tag: `mitr-test-${d.alertSeq || "0"}`, renotify: true },
      v3: { ...base, requireInteraction: true },
      v4: { ...base, actions: [{ action: "dismiss", title: "Dismiss" }] },
      v5: {
        ...base,
        badge: "/icons/icon-192.png",
        tag: `mitr-test-${d.alertSeq || "0"}`,
        renotify: true,
        requireInteraction: true,
        actions: [{ action: "dismiss", title: "Dismiss" }],
      },
    };
    return self.registration.showNotification(title, variants[d.testVariant] || base);
  }
  /* ---- END TEMPORARY DIAGNOSTIC BRANCH ---- */

  // The tag must be unique per reminder, per occurrence, per attempt: a repeated
  // tag replaces the earlier notification, and (without renotify) does so
  // silently — no sound. renotify is a second line of defence if tags ever clash.
  const tagParts = [d.reminderId, d.occurrenceAt, d.alertSeq].filter(Boolean);
  const options = {
    body: n.body || d.body || "",
    icon: n.icon || "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: tagParts.length ? `mitr-${tagParts.join("-")}` : `mitr-${Date.now()}-${Math.random()}`,
    renotify: true,
    requireInteraction: true,
    data: d,
  };

  if (d.dismissToken) options.actions = [{ action: "dismiss", title: "Dismiss" }];
  return self.registration.showNotification(title, options);
});


/** The payload can arrive either directly or wrapped by the FCM SDK. */
function readData(notification) {
  const data = (notification && notification.data) || {};
  const fcm = data["FCM_MSG"];
  return Object.assign({}, (fcm && fcm.data) || {}, data);
}

self.addEventListener("notificationclick", (event) => {
  const data = readData(event.notification);
  event.notification.close();

  // "Dismiss" acknowledges the reminder without ever opening the app.
  if (event.action === "dismiss") {
    if (!data.dismissToken) return;
    event.waitUntil(
      fetch("/api/public/reminders/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: data.dismissToken }),
      }).catch(() => undefined),
    );
    return;
  }

  const path = data.path || "/home";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(path);
          return client.focus();
        }
      }
      return self.clients.openWindow(path);
    }),
  );
});
