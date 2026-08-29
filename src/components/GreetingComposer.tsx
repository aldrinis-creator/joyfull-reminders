import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Send, Share2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
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
import { sendGreeting } from "@/lib/greetings.functions";
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

export function GreetingComposer({
  member,
  open,
  onOpenChange,
  occasion: initialOccasion = "birthday",
  reminderId = null,
  senderName,
}: {
  member: Pick<FamilyMember, "id" | "full_name" | "email" | "whatsapp_phone" | "likes">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  occasion?: string;
  reminderId?: string | null;
  senderName?: string | null | undefined;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const send = useServerFn(sendGreeting);

  const [occasion, setOccasion] = useState(initialOccasion);
  const [style, setStyle] = useState("confetti");
  const [channel, setChannel] = useState<GreetingChannel>(
    member.whatsapp_phone ? "whatsapp" : member.email ? "email" : "share",
  );
  const [message, setMessage] = useState(() =>
    defaultMessage({ name: member.full_name, occasion: initialOccasion, senderName }),
  );
  const [busy, setBusy] = useState(false);

  const styleMeta = CARD_STYLES.find((s) => s.value === style) ?? CARD_STYLES[0]!;

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return greetingShareUrl({
      origin: window.location.origin,
      name: member.full_name,
      message,
      style,
      occasion,
    });
  }, [member.full_name, message, style, occasion]);

  function regenerate(nextOccasion: string) {
    setOccasion(nextOccasion);
    setMessage(defaultMessage({ name: member.full_name, occasion: nextOccasion, senderName }));
  }

  async function handleSend() {
    setBusy(true);
    try {
      const result = await send({
        data: {
          familyMemberId: member.id,
          reminderId,
          occasion,
          occasionKey: occasionKey(occasion),
          channel,
          cardStyle: style,
          message,
        },
      });
      if (result.ok) {
        toast.success(
          channel === "share" ? t("family.greetSavedShare") : t("family.greetSent"),
        );
        queryClient.invalidateQueries({ queryKey: ["greetings"] });
        if (channel === "share") {
          await shareCard();
        }
        onOpenChange(false);
      } else {
        toast.error(result.detail);
        if (result.reason === "not_configured" && channel === "whatsapp") {
          window.open(whatsappDeepLink(member.whatsapp_phone, `${message}\n\n${shareUrl}`), "_blank");
        }
      }
    } catch {
      toast.error(t("family.greetFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function shareCard() {
    const text = `${message}\n\n${shareUrl}`;
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
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t("family.greetTitle", { name: member.full_name })}</DialogTitle>
        </DialogHeader>

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
                  (c.value === "whatsapp" && !member.whatsapp_phone) ||
                  (c.value === "email" && !member.email);
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

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" className="h-13" onClick={shareCard}>
            {typeof navigator !== "undefined" && "share" in navigator ? (
              <Share2 className="size-5" aria-hidden />
            ) : (
              <Copy className="size-5" aria-hidden />
            )}
            {t("family.channel.share")}
          </Button>
          <Button className="h-13 flex-1 text-base" disabled={busy} onClick={handleSend}>
            <Send className="size-5" aria-hidden /> {busy ? t("family.sending") : t("home.sendGreeting")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
