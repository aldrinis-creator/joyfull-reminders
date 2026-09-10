import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/queries";
import { preloadCustomAlarm, setAlarmSettings, type AlarmToneId } from "@/lib/alarm-sound";

const VALID: AlarmToneId[] = ["siren", "beeps", "bell", "chime", "custom"];

export function normalizeTone(value: string | null | undefined): AlarmToneId {
  return VALID.includes(value as AlarmToneId) ? (value as AlarmToneId) : "siren";
}

/** Signed playback URL for a stored custom alarm file (private bucket). */
export async function signedAlarmUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("alarm-sounds").createSignedUrl(path, 60 * 60 * 6);
  return data?.signedUrl ?? null;
}

/**
 * Keeps the shared alarm engine in sync with the saved profile preferences so
 * a due reminder rings with the chosen sound and volume.
 */
export function useAlarmSettings() {
  const { data: profile } = useProfile();
  const tone = normalizeTone(profile?.alarm_sound);
  const volume = Number(profile?.alarm_volume ?? 1);
  const path = profile?.alarm_sound_path ?? null;

  useEffect(() => {
    setAlarmSettings({ tone, volume });
  }, [tone, volume]);

  useEffect(() => {
    let cancelled = false;
    if (!path) {
      void preloadCustomAlarm(null);
      return;
    }
    void signedAlarmUrl(path).then((url) => {
      if (!cancelled) void preloadCustomAlarm(url);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return { tone, volume, path };
}
