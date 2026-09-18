/* Firebase Cloud Messaging background worker. Config arrives in the query
   string because service workers cannot read import.meta.env. */
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp(Object.fromEntries(new URL(self.location).searchParams));
firebase.messaging();

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
