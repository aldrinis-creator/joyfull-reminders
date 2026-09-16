import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BellRing,
  Check,
  Clock,
  Copy,
  Gift,
  IndianRupee,
  MapPin,
  Phone,
  SkipForward,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { dialNumber } from "@/components/RecipientActions";
import {
  amountIsVariable,
  buildGpayLink,
  buildUpiLink,
  paymentTarget,
} from "@/lib/pay-link";
import {
  formatDate,
  normalizeCategory,
  turningAge,
  type FamilyMember,
  type Reminder,
} from "@/lib/ereminder";
import { useT } from "@/hooks/useLanguage";
import { SNOOZE_CAP } from "@/lib/snooze";
import { alarmIntervalMs, isAudioUnlocked, playAlarm, unlockAudio, vibrateAlarm } from "@/lib/alarm-sound";

const RING_MS = 60_000;
const SNOOZE_MINUTES = 10;

function clockTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

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

type AlarmAction = {
  key: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  external?: boolean;
  to?: string;
  onClick?: () => void;
};

/** Opens Google Pay first, then whichever UPI app is registered. */
function openUpi(reminder: Reminder) {
  const gpay = buildGpayLink(reminder);
  const upi = buildUpiLink(reminder);
  const start = Date.now();
  if (gpay) window.location.href = gpay;
  window.setTimeout(() => {
    if (upi && Date.now() - start < 2500 && !document.hidden) window.location.href = upi;
  }, 1200);
}

export function AlarmOverlay({
  reminder,
  occurrence,
  snoozeCount = 0,
  onDismiss,
  onSkip,
  onSnooze,
  onClose,
  recipients = [],
}: {
  reminder: Reminder;
  occurrence?: Date;
  snoozeCount?: number;
  onDismiss: () => void;
  onSkip?: () => void;
  onSnooze: (minutes: number) => void;
  onClose?: () => void;
  recipients?: FamilyMember[];
}) {
  const t = useT();
  const [phase, setPhase] = useState<"ringing" | "snoozed" | "done">("ringing");
  const [ringing, setRinging] = useState(true);
  const { blocked, retry } = useChime(ringing && phase === "ringing");

  useEffect(() => {
    if (phase !== "ringing") return;
    const timer = setTimeout(() => setRinging(false), RING_MS);
    vibrateAlarm();
    return () => clearTimeout(timer);
  }, [phase]);

  // The snooze confirmation is a reassurance, not a wall — it steps aside.
  useEffect(() => {
    if (phase !== "snoozed") return;
    const timer = setTimeout(() => onClose?.(), 4000);
    return () => clearTimeout(timer);
  }, [phase, onClose]);

  const due = occurrence ?? new Date(reminder.due_at);
  const category = normalizeCategory(reminder.category);
  const member = recipients[0];
  const name = member?.full_name?.split(" ")[0] ?? "";
  const age =
    category === "personal_family" && member?.birth_date
      ? turningAge(member.birth_date, due)
      : null;
  const target = paymentTarget(reminder);
  const amount = reminder.payment_amount;
  const showAmount = !amountIsVariable(reminder) && amount !== null && Number(amount) > 0;
  const number = member ? dialNumber(member) : null;
  const snoozesLeft = Math.max(0, SNOOZE_CAP - snoozeCount);

  const headline =
    age && name ? t("home.alarmTurns", { name: member!.full_name, age }) : reminder.title;

  const consequenceKey =
    category === "personal_family"
      ? "home.alarmWhyFamily"
      : category === "finance_tax" || category === "household"
        ? "home.alarmWhyBill"
        : category === "automotive"
          ? "home.alarmWhyVehicle"
          : category === "health"
            ? "home.alarmWhyHealth"
            : "home.alarmWhyDefault";
  const consequence = t(consequenceKey, { name: name || reminder.title });

  const openAction: AlarmAction = {
    key: "open",
    label: t("home.alarmOpen"),
    icon: <ArrowRight className="size-5" aria-hidden />,
    to: "edit",
  };

  let primary: AlarmAction = openAction;
  let secondary: AlarmAction | null = null;

  if (category === "personal_family") {
    primary = number
      ? {
          key: "call",
          label: t("home.alarmCall", { name: name || member!.full_name }),
          icon: <Phone className="size-5" aria-hidden />,
          href: `tel:+${number}`,
        }
      : openAction;
    secondary = {
      key: "gift",
      label: t("home.sendGift"),
      icon: <Gift className="size-5" aria-hidden />,
      to: "market",
    };
  } else if (category === "finance_tax" || category === "household") {
    primary = target
      ? {
          key: "pay",
          label: showAmount
            ? t("home.alarmPayAmount", { amount: Number(amount).toFixed(0) })
            : t("home.payNow"),
          icon: <IndianRupee className="size-5" aria-hidden />,
          onClick: () => {
            if (target.kind === "upi") openUpi(reminder);
            else window.open(target.href, "_blank", "noopener,noreferrer");
          },
        }
      : openAction;
    if (target && reminder.upi_id?.trim()) {
      const upiId = reminder.upi_id.trim();
      secondary = {
        key: "copy-upi",
        label: t("home.copyUpi"),
        icon: <Copy className="size-5" aria-hidden />,
        onClick: () => {
          void navigator.clipboard
            .writeText(upiId)
            .then(() => toast.success(t("home.upiCopied")))
            .catch(() => toast.error(t("home.upiCopyFailed")));
        },
      };
    }
  } else if (category === "automotive") {
    primary = {
      key: "centre",
      label: t("home.alarmFindCentre"),
      icon: <MapPin className="size-5" aria-hidden />,
      href: `https://www.google.com/maps/search/${encodeURIComponent(t("home.alarmCentreQuery"))}`,
      external: true,
    };
    secondary = {
      key: "renewed",
      label: t("home.alarmMarkRenewed"),
      icon: <Check className="size-5" aria-hidden />,
      onClick: () => {
        onDismiss();
        setPhase("done");
      },
    };
  } else if (category === "health") {
    primary = {
      key: "taken",
      label: t("home.alarmTaken"),
      icon: <Check className="size-5" aria-hidden />,
      onClick: () => {
        onDismiss();
        setPhase("done");
      },
    };
    if (onSkip) {
      secondary = {
        key: "skip",
        label: t("home.alarmSkip"),
        icon: <SkipForward className="size-5" aria-hidden />,
        onClick: () => {
          onSkip();
          setPhase("done");
        },
      };
    }
  }

  const handledLine =
    category === "personal_family"
      ? t("home.alarmHandledFamily", { name: name || reminder.title })
      : category === "finance_tax" || category === "household"
        ? t("home.alarmHandledBill", { title: reminder.title })
        : category === "health"
          ? t("home.alarmHandledHealth")
          : t("home.alarmHandledDefault", { title: reminder.title });
  const nextLine =
    reminder.recurrence && reminder.recurrence !== "once"
      ? ` ${t("home.alarmHandledNext", { date: formatDate(reminder.due_at) })}`
      : "";

  function renderAction(action: AlarmAction, variant: "primary" | "secondary") {
    const className =
      variant === "primary"
        ? "bg-background text-accent-800 hover:bg-accent-100 h-[62px] w-full rounded-full text-lg"
        : "h-[58px] w-full rounded-full border-[1.5px] border-white/60 bg-transparent text-base text-[color:var(--primary-foreground)] hover:bg-white/10";

    if (action.to === "edit") {
      return (
        <Button asChild key={action.key} className={className} variant={variant === "primary" ? "default" : "outline"}>
          <Link to="/reminders/$reminderId/edit" params={{ reminderId: reminder.id }}>
            {action.icon} {action.label}
          </Link>
        </Button>
      );
    }
    if (action.to === "market") {
      return (
        <Button asChild key={action.key} className={className} variant={variant === "primary" ? "default" : "outline"}>
          <Link to="/market" search={{ pin: member?.pincode ?? undefined, for: member?.id }}>
            {action.icon} {action.label}
          </Link>
        </Button>
      );
    }
    if (action.href) {
      return (
        <Button asChild key={action.key} className={className} variant={variant === "primary" ? "default" : "outline"}>
          <a
            href={action.href}
            {...(action.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {action.icon} {action.label}
          </a>
        </Button>
      );
    }
    return (
      <Button
        key={action.key}
        className={className}
        variant={variant === "primary" ? "default" : "outline"}
        onClick={action.onClick}
      >
        {action.icon} {action.label}
      </Button>
    );
  }

  if (phase === "snoozed") {
    const back = new Date(Date.now() + SNOOZE_MINUTES * 60_000);
    return (
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={t("home.alarmAria", { title: reminder.title })}
        className="bg-background fixed inset-0 z-50 flex flex-col items-center justify-center px-8 text-center"
      >
        <span className="bg-accent-200 text-accent-800 animate-mm-pop flex size-[72px] items-center justify-center rounded-full">
          <Clock className="size-8" aria-hidden />
        </span>
        <h2 className="mt-6 text-[28px]">{t("home.alarmBackAt", { time: clockTime(back) })}</h2>
        <p className="mt-3 max-w-[250px] text-[15px] text-[color:var(--foreground)]/60">
          {t("home.alarmSnoozeBody", { count: snoozesLeft })}
        </p>
        <Button
          variant="outline"
          className="mt-8 h-[52px] rounded-full px-8 text-base"
          onClick={() => {
            setRinging(true);
            setPhase("ringing");
          }}
        >
          {t("home.alarmRingAgain")}
        </Button>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={t("home.alarmAria", { title: reminder.title })}
        className="bg-accent-2-100 fixed inset-0 z-50 flex flex-col items-center justify-center px-8 text-center"
      >
        <span className="bg-accent-2-700 animate-mm-pop flex size-[86px] items-center justify-center rounded-full text-[color:var(--accent-2-100)]">
          <Check className="size-10" aria-hidden />
        </span>
        <h2 className="mt-6 text-[29px] text-[color:var(--accent-2-900)]">
          {t("home.alarmHandled")}
        </h2>
        <p className="mt-3 max-w-[280px] text-[15px] text-[color:var(--accent-2-800)]">
          {handledLine}
          {nextLine}
        </p>
        <Button
          variant="outline"
          className="mt-8 h-[52px] rounded-full border-[color:var(--accent-2-700)] px-8 text-base text-[color:var(--accent-2-900)]"
          onClick={() => onClose?.()}
        >
          {t("home.alarmClose")}
        </Button>
      </div>
    );
  }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={t("home.alarmAria", { title: reminder.title })}
      className="bg-primary text-primary-foreground fixed inset-0 z-50 flex flex-col items-center px-[26px] pt-[30px] pb-[26px] text-center"
    >
      <p className="text-[11px] font-semibold tracking-[0.14em] uppercase opacity-85">
        {t("home.alarmRingingNow", { time: clockTime(due) })}
      </p>

      <div className="relative mt-[34px] flex size-[150px] items-center justify-center">
        {ringing ? (
          <>
            <span
              className="animate-mm-pulse absolute inset-0 rounded-full"
              style={{ background: "rgba(255,255,255,.4)" }}
              aria-hidden
            />
            <span
              className="animate-mm-pulse absolute inset-4 rounded-full"
              style={{ background: "rgba(255,255,255,.35)", animationDelay: "350ms" }}
              aria-hidden
            />
          </>
        ) : null}
        <span className="bg-background text-accent-800 relative flex size-[150px] items-center justify-center overflow-hidden rounded-full text-5xl font-bold">
          {member?.photo_url ? (
            <img
              src={member.photo_url}
              alt=""
              className="washed size-full object-cover"
              loading="lazy"
            />
          ) : member ? (
            member.full_name.slice(0, 1).toUpperCase()
          ) : (
            <BellRing className="size-14" aria-hidden />
          )}
        </span>
      </div>

      <h2 className="mt-8 max-w-md text-[38px] leading-[1.05]">{headline}</h2>
      <p className="mt-3 max-w-sm text-base opacity-92">{consequence}</p>

      <div className="flex-1" />

      <div className="flex w-full max-w-sm flex-col gap-[10px]">
        {ringing && blocked ? (
          <Button
            variant="outline"
            className="h-[54px] w-full rounded-full border-[1.5px] border-white/60 bg-transparent text-base text-[color:var(--primary-foreground)] hover:bg-white/10"
            onClick={() => void retry()}
          >
            <Volume2 className="size-5" aria-hidden /> {t("home.enableAlarmSound")}
          </Button>
        ) : null}

        {renderAction(primary, "primary")}
        {secondary ? renderAction(secondary, "secondary") : null}

        <div className="grid grid-cols-2 gap-[10px]">
          {snoozesLeft > 0 ? (
            <Button
              className="h-[54px] rounded-full bg-white/20 text-base text-[color:var(--primary-foreground)] hover:bg-white/30"
              onClick={() => {
                setRinging(false);
                onSnooze(SNOOZE_MINUTES);
                setPhase("snoozed");
              }}
            >
              <Clock className="size-5" aria-hidden /> {t("home.alarmSnooze10")}
            </Button>
          ) : null}
          <Button
            className={`h-[54px] rounded-full bg-white/20 text-base text-[color:var(--primary-foreground)] hover:bg-white/30 ${
              snoozesLeft > 0 ? "" : "col-span-2"
            }`}
            onClick={() => {
              setRinging(false);
              onDismiss();
              setPhase("done");
            }}
          >
            <Check className="size-5" aria-hidden /> {t("home.alarmDone")}
          </Button>
        </div>
      </div>
    </div>
  );
}
