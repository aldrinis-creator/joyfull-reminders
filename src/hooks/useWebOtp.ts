import { useEffect, useRef } from "react";

/**
 * Listens for an SMS one-time code via the WebOTP API (Chrome on Android).
 * Where unsupported it silently does nothing — manual entry is unchanged.
 * Aborts the pending request whenever `active` flips off or the component unmounts.
 */
export function useWebOtp(active: boolean, onCode: (code: string) => void) {
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  useEffect(() => {
    if (!active) return;
    if (typeof window === "undefined" || !("OTPCredential" in window)) return;

    const controller = new AbortController();
    navigator.credentials
      .get({ otp: { transport: ["sms"] }, signal: controller.signal } as CredentialRequestOptions)
      .then((credential) => {
        const code = (credential as { code?: string } | null)?.code;
        if (code) onCodeRef.current(code.replace(/\D/g, "").slice(0, 8));
      })
      .catch(() => {
        /* aborted or unavailable — manual entry stays as-is */
      });

    return () => controller.abort();
  }, [active]);
}
