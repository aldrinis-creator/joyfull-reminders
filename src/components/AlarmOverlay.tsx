import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BellRing, Clock, Check, Gift, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PayNowButtons } from "@/components/PayNowButtons";
import { CallButtons, isWishingReminder } from "@/components/RecipientActions";
import {
  categoryMeta,
  categoryShortLabel,
  formatDateTime,
  type FamilyMember,
  type Reminder,
} from "@/lib/ereminder";
import { useT } from "@/hooks/useLanguage";
import { alarmIntervalMs, isAudioUnlocked, playAlarm, unlockAudio, vibrateAlarm } from "@/lib/alarm-sound";


const RING_MS = 60_000;

/**
 * Looping alarm on the shared, pre-unlocked audio context. Reports `blocked`
 * when the browser is still refusing sound, so the overlay can offer a tap.
 */
function useChime(active: boolean) {
  const [blocked, setBlocked] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    let stopped = false;

    const ping = () => {
      if (stopped) return;
      const played = playAlarm();
      setBlocked(!played);
    };

    void unlockAudio().then((ok) => {
      if (stopped) return;
      setBlocked(!ok);
      if (ok) ping();
    });
    timerRef.current = setInterval(ping, alarmIntervalMs());

    return () => {
      stopped = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [active]);

  const retry = useCallback(async () => {
    const ok = await unlockAudio();
    setBlocked(!ok);
    if (ok) playAlarm();
  }, []);

  return { blocked: blocked && !isAudioUnlocked(), retry };
}

export function AlarmOverlay({
  reminder,
  onDismiss,
  onSnooze,
  recipients = [],
}: {
  reminder: Reminder;
  onDismiss: () => void;
  onSnooze: (minutes: number) => void;
  recipients?: FamilyMember[];
}) {
  const t = useT();
  const [ringing, setRinging] = useState(true);
  const { blocked, retry } = useChime(ringing);

  useEffect(() => {
    const t = setTimeout(() => setRinging(false), RING_MS);
    vibrateAlarm();
    return () => clearTimeout(t);
  }, []);

  const meta = categoryMeta(reminder.category);
  const isCelebration = reminder.category === "personal_family";

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={t("home.alarmAria", { title: reminder.title })}
      className="bg-indigo/95 fixed inset-0 z-50 flex flex-col items-center justify-center px-6 py-10 backdrop-blur-sm"
    >
      <div className="relative mb-8 flex size-28 items-center justify-center">
        {ringing ? (
          <span className="bg-primary animate-ring-pulse absolute inset-0 rounded-full" aria-hidden />
        ) : null}
        <span className="bg-primary text-primary-foreground relative flex size-24 items-center justify-center rounded-full">
          <BellRing className="size-11" aria-hidden />
        </span>
      </div>

      <p className="text-indigo-foreground/80 text-sm font-bold tracking-widest uppercase">
        {meta.emoji} {t("home.alarmKicker", { category: categoryShortLabel(reminder.category) })}
      </p>
      <h2 className="text-indigo-foreground mt-3 max-w-md text-center text-4xl">
        {reminder.title}
      </h2>
      <p className="text-indigo-foreground/85 mt-3 text-center text-lg">
        {formatDateTime(reminder.due_at)}
      </p>
      {reminder.description ? (
        <p className="text-indigo-foreground/75 mt-2 max-w-sm text-center text-base">
          {reminder.description}
        </p>
      ) : null}

      <div className="mt-10 w-full max-w-sm space-y-3">
        {ringing && blocked ? (
          <Button
            size="lg"
            variant="secondary"
            className="h-14 w-full text-base"
            onClick={() => void retry()}
          >
            <Volume2 className="size-5" aria-hidden /> {t("home.enableAlarmSound")}
          </Button>
        ) : null}

        <Button
          size="lg"
          className="h-16 w-full text-lg"
          onClick={() => {
            setRinging(false);
            onDismiss();
          }}
        >
          <Check className="size-6" aria-hidden /> {t("home.dismissDone")}
        </Button>

        <div className="flex flex-wrap gap-2 [&>button]:flex-1">
          <PayNowButtons shortcut={{ ...reminder, title: reminder.title }} tone="onDark" size="lg" />
        </div>


        <Button
          asChild
          size="lg"
          variant="secondary"
          className="bg-accent text-accent-foreground hover:bg-accent/90 h-14 w-full text-base"
        >
          <Link to="/market">
            <Gift className="size-5" aria-hidden />
            {isCelebration ? t("home.orderCake") : t("home.takeAction")}
          </Link>
        </Button>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t("home.snooze15"), minutes: 15 },
            { label: t("home.snooze60"), minutes: 60 },
            { label: t("home.snoozeTomorrow"), minutes: 1440 },
          ].map((s) => (
            <Button
              key={s.minutes}
              variant="outline"
              className="text-indigo-foreground h-14 border-white/40 bg-transparent text-sm hover:bg-white/10"
              onClick={() => {
                setRinging(false);
                onSnooze(s.minutes);
              }}
            >
              <Clock className="size-4" aria-hidden /> {s.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
