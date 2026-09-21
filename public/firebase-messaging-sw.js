/* Firebase Cloud Messaging background worker. Config arrives in the query
   string because service workers cannot read import.meta.env. */
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp(Object.fromEntries(new URL(self.location).searchParams));
const messaging = firebase.messaging();

/* Show the notification ourselves instead of trusting the SDK default: if the
   payload's notification block is incomplete the default quietly shows nothing. */
messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {};
  const d = payload.data || {};
  const title = n.title || d.title || "Reminder";
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
