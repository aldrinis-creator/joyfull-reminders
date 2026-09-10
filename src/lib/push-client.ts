/**
 * Browser-side push registration (Firebase Cloud Messaging web push).
 *
 * Must be called from a click handler: browsers ignore permission requests
 * without a user gesture, and refuse them entirely inside a cross-origin
 * iframe (the Lovable preview), so that case gets its own status.
 */

const appId = import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID"] as
  | string
  | undefined;
const vapidKey = import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY"] as
  | string
  | undefined;

const firebaseConfig = {
  apiKey: import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY"] as
    | string
    | undefined,
  projectId: import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID"] as
    | string
    | undefined,
  appId,
  messagingSenderId: appId?.split(":")[1] ?? "",
};

export type PushStatus =
  | "registered"
  | "not-configured"
  | "unsupported"
  | "open-in-new-tab"
  | "needs-install"
  | "denied";

export type PushResult = { status: PushStatus; token?: string };

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone === true;
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function pushPermission(): NotificationPermission | "unavailable" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unavailable";
  return Notification.permission;
}

export async function enablePush(): Promise<PushResult> {
  if (
    !firebaseConfig.apiKey ||
    !firebaseConfig.projectId ||
    !appId ||
    !vapidKey ||
    !firebaseConfig.messagingSenderId
  ) {
    return { status: "not-configured" };
  }

  const { isSupported, getMessaging, getToken } = await import("firebase/messaging");
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !(await isSupported())) {
    // iOS only exposes notifications once the app sits on the home screen.
    if (isIos() && !isStandalone()) return { status: "needs-install" };
    return { status: "unsupported" };
  }
  if (window.top !== window.self) return { status: "open-in-new-tab" };
  if (isIos() && !isStandalone()) return { status: "needs-install" };

  const permission =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return { status: "denied" };

  const query = new URLSearchParams({
    apiKey: firebaseConfig.apiKey,
    projectId: firebaseConfig.projectId,
    appId,
    messagingSenderId: firebaseConfig.messagingSenderId,
  }).toString();
  const serviceWorkerRegistration = await navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?${query}`,
  );

  const { initializeApp, getApps, getApp } = await import("firebase/app");
  const options = {
    apiKey: firebaseConfig.apiKey,
    projectId: firebaseConfig.projectId,
    appId,
    messagingSenderId: firebaseConfig.messagingSenderId,
  };
  const app = getApps().length ? getApp() : initializeApp(options);
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration });
  return token ? { status: "registered", token } : { status: "denied" };
}
