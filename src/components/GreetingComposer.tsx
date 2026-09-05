import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Copy, Send, Share2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sendGreeting, updateScheduledGreeting } from "@/lib/greetings.functions";
import {
  CARD_STYLES,
  CHANNELS,
  OCCASIONS,
  defaultMessage,
  greetingShareUrl,
  occasionKey,
  whatsappDeepLink,
  type GreetingChannel,
} from "@/lib/greetings";
import type { FamilyMember } from "@/lib/ereminder";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useLanguage";

/** Local (not UTC) date/time parts for the date + time inputs. */
function dateParts(value: Date): { date: string; time: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`,
    time: `${pad(value.getHours())}:${pad(value.getMinutes())}`,
  };
}

export function GreetingComposer({
  member,
  open,
  onOpenChange,
  occasion: initialOccasion = "birthday",
  reminderId = null,
  senderName,
  scheduleDefault,
  editing,
}: {
  member: Pick<FamilyMember, "id" | "full_name" | "email" | "whatsapp_phone" | "likes">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  occasion?: string;
  reminderId?: string | null;
  senderName?: string | null | undefined;
  /** Suggested send moment when scheduling — usually the reminder's date. */
  scheduleDefault?: Date | undefined;
  /** When present the composer edits an existing pending scheduled greeting. */
  editing?:
    | {
        id: string;
        scheduledFor: string;
        message: string;
        cardStyle: string;
        channel: GreetingChannel;
        occasion: string;
      }
    | undefined;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const send = useServerFn(sendGreeting);
  const updateScheduled = useServerFn(updateScheduledGreeting);

  const [occasion, setOccasion] = useState(editing?.occasion ?? initialOccasion);
  const [style, setStyle] = useState(editing?.cardStyle ?? "confetti");
  const [channel, setChannel] = useState<GreetingChannel>(
    editing?.channel ?? (member.whatsapp_phone ? "whatsapp" : member.email ? "email" : "share"),
  );
  const [message, setMessage] = useState(
    () =>
      editing?.message ??
      defaultMessage({ name: member.full_name, occasion: initialOccasion, senderName }),
  );
  const [mode, setMode] = useState<"now" | "schedule">(editing ? "schedule" : "now");
  const initialWhen = useMemo(() => {
    const base = editing
      ? new Date(editing.scheduledFor)
      : (scheduleDefault ?? new Date(Date.now() + 24 * 60 * 60 * 1000));
    return dateParts(base);
  }, [editing, scheduleDefault]);
  const [sendDate, setSendDate] = useState(initialWhen.date);
  const [sendTime, setSendTime] = useState(initialWhen.time);
  const [busy, setBusy] = useState(false);
  const [voiceNote, setVoiceNote] = useState<{ path: string; seconds: number } | null>(null);

  const styleMeta = CARD_STYLES.find((s) => s.value === style) ?? CARD_STYLES[0]!;
  const scheduling = mode === "schedule";

  function cardUrl(greetingId: string): string {
    if (typeof window === "undefined") return "";
    return greetingShareUrl({ origin: window.location.origin, greetingId });
  }

  function regenerate(nextOccasion: string) {
    setOccasion(nextOccasion);
    setMessage(defaultMessage({ name: member.full_name, occasion: nextOccasion, senderName }));
  }

  function scheduledIso(): string | null {
    const when = new Date(`${sendDate}T${sendTime || "09:00"}`);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) return null;
    return when.toISOString();
  }

  async function handleSubmit(overrideChannel?: GreetingChannel) {
    const useChannel = overrideChannel ?? channel;
    const useScheduling = scheduling && useChannel !== "share";
    if (scheduling && useChannel === "share") {
      toast.error(t("family.scheduleShareHint"));
      return;
    }
    const iso = useScheduling ? scheduledIso() : null;
    if (useScheduling && !iso) {
      toast.error(t("family.schedulePast"));
      return;
    }

    setBusy(true);
    try {
      if (editing) {
        const result = await updateScheduled({
          data: { greetingId: editing.id, scheduledFor: iso!, message, cardStyle: style },
        });
        if (result.ok) {
          toast.success(t("family.scheduleUpdated"));
          queryClient.invalidateQueries({ queryKey: ["greetings"] });
          onOpenChange(false);
        } else {
          toast.error(t("family.updateFailed"));
        }
        return;
      }

      const result = await send({
        data: {
          familyMemberId: member.id,
          reminderId,
          occasion,
          occasionKey: occasionKey(occasion, iso ? new Date(iso) : new Date()),
          channel: useChannel,
          cardStyle: style,
          message,
          scheduledFor: iso,
          voiceNotePath: voiceNote?.path ?? null,
          voiceNoteSeconds: voiceNote?.seconds ?? null,
        },
      });
      if (result.ok) {
        toast.success(
          result.scheduled
            ? t("family.scheduleSaved")
            : useChannel === "share"
              ? t("family.greetSavedShare")
              : t("family.greetSent"),
        );
        queryClient.invalidateQueries({ queryKey: ["greetings"] });
        if (!result.scheduled && useChannel === "share") {
          await shareCard(cardUrl(result.greetingId));
        }
        onOpenChange(false);
      } else {
        toast.error(result.detail);
      }
    } catch {
      toast.error(useScheduling ? t("family.scheduleFailed") : t("family.greetFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function shareCard(url: string) {
    const text = `${message}\n\n${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: t("family.greetShareTitle", { name: member.full_name }), text });
        return;
      } catch {
        /* user dismissed */
      }
    }
    await navigator.clipboard.writeText(text);
    toast.success(t("family.greetCopied"));
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {editing
              ? t("family.editScheduleTitle")
              : t("family.greetTitle", { name: member.full_name })}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="g-occasion">{t("family.occasion")}</Label>
            <Select value={occasion} onValueChange={regenerate}>
              <SelectTrigger id="g-occasion" className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OCCASIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.emoji} {t(`family.occ.${o.value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("family.whenToSend")}</Label>
            <div className="flex flex-wrap gap-2">
              {(["now", "schedule"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  disabled={Boolean(editing) && value === "now"}
                  onClick={() => setMode(value)}
                  className={cn(
                    "min-h-11 rounded-full px-4 text-sm font-bold disabled:opacity-40",
                    mode === value ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                  )}
                >
                  {value === "now" ? t("family.sendNow") : t("family.scheduleIt")}
                </button>
              ))}
            </div>
            {scheduling ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="g-date">{t("family.sendDate")}</Label>
                  <Input
                    id="g-date"
                    type="date"
                    className="h-12"
                    value={sendDate}
                    onChange={(e) => setSendDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="g-time">{t("family.sendTime")}</Label>
                  <Input
                    id="g-time"
                    type="time"
                    className="h-12"
                    value={sendTime}
                    onChange={(e) => setSendTime(e.target.value)}
                  />
                </div>
                <p className="text-muted-foreground text-sm sm:col-span-2">
                  {t("family.scheduleHint")}
                </p>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>{t("family.cardStyle")}</Label>
            <div className="flex flex-wrap gap-2">
              {CARD_STYLES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={style === s.value}
                  onClick={() => setStyle(s.value)}
                  className={cn(
                    "min-h-11 rounded-full px-4 text-sm font-bold",
                    style === s.value
                      ? "ring-primary ring-offset-background text-white ring-2 ring-offset-2"
                      : "bg-muted text-foreground",
                  )}
                  style={style === s.value ? { backgroundImage: s.gradient } : undefined}
                >
                  {s.emoji} {t(`family.style.${s.value}`)}
                </button>
              ))}
            </div>
          </div>

          <div
            className="rounded-3xl p-5 text-white"
            style={{ backgroundImage: styleMeta.gradient }}
          >
            <p className="text-sm font-bold tracking-wide uppercase opacity-90">
              {t(`family.occ.${occasion}`)}
            </p>
            <p className="mt-2 text-lg whitespace-pre-line">{message}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="g-message">{t("family.yourMessage")}</Label>
            <Textarea
              id="g-message"
              rows={5}
              maxLength={1200}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              className="h-11"
              onClick={() => regenerate(occasion)}
            >
              <Sparkles className="size-4" aria-hidden /> {t("family.rewrite")}
            </Button>
          </div>

          <div className="space-y-2">
            <Label>{t("family.sendBy")}</Label>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((c) => {
                const disabled =
                  Boolean(editing) ||
                  (c.value === "whatsapp" && !member.whatsapp_phone) ||
                  (c.value === "email" && !member.email) ||
                  (scheduling && c.value === "share");
                return (
                  <button
                    key={c.value}
                    type="button"
                    aria-pressed={channel === c.value}
                    disabled={disabled}
                    onClick={() => setChannel(c.value)}
                    className={cn(
                      "min-h-11 rounded-full px-4 text-sm font-bold disabled:opacity-40",
                      channel === c.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {t(`family.channel.${c.value}`)}
                  </button>
                );
              })}
            </div>
            <p className="text-muted-foreground text-sm">
              {t(`family.channelHint.${channel}`)}
            </p>
          </div>
        </div>

        </DialogBody>
        <DialogFooter className="gap-2">
          {editing ? null : (
            <Button type="button" variant="outline" className="h-13" onClick={shareCard}>
              {typeof navigator !== "undefined" && "share" in navigator ? (
                <Share2 className="size-5" aria-hidden />
              ) : (
                <Copy className="size-5" aria-hidden />
              )}
              {t("family.channel.share")}
            </Button>
          )}
          <Button className="h-13 flex-1 text-base" disabled={busy} onClick={handleSubmit}>
            {scheduling ? (
              <CalendarClock className="size-5" aria-hidden />
            ) : (
              <Send className="size-5" aria-hidden />
            )}
            {busy
              ? t("family.sending")
              : editing
                ? t("family.saveChanges")
                : scheduling
                  ? t("family.scheduleCta")
                  : t("home.sendGreeting")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
