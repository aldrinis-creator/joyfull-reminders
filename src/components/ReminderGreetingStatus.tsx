import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GreetingComposer } from "@/components/GreetingComposer";
import { supabase } from "@/integrations/supabase/client";
import { cancelScheduledGreeting } from "@/lib/greetings.functions";
import { formatDateTime, type FamilyMember } from "@/lib/ereminder";
import { useT } from "@/hooks/useLanguage";
import type { GreetingChannel } from "@/lib/greetings";

/**
 * Shows the greeting state for a reminder: a pending scheduled greeting
 * (with edit / cancel) or the greeting that already went out.
 */
export function ReminderGreetingStatus({
  reminderId,
  member,
}: {
  reminderId: string;
  member: FamilyMember;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const cancel = useServerFn(cancelScheduledGreeting);
  const [editing, setEditing] = useState<null | {
    id: string;
    scheduledFor: string;
    message: string;
    cardStyle: string;
    channel: GreetingChannel;
    occasion: string;
  }>(null);

  const { data } = useQuery({
    queryKey: ["greetings", reminderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("greetings")
        .select("id, status, scheduled_for, sent_at, message, card_style, channel, occasion")
        .eq("reminder_id", reminderId)
        .in("status", ["scheduled", "sent"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const scheduled = (data ?? []).find((g) => g.status === "scheduled" && g.scheduled_for);
  const sent = (data ?? []).find((g) => g.status === "sent");

  async function handleCancel(id: string) {
    const result = await cancel({ data: { greetingId: id } });
    if (result.ok) {
      toast.success(t("family.scheduleCancelled"));
      queryClient.invalidateQueries({ queryKey: ["greetings"] });
    } else {
      toast.error(t("family.cancelFailed"));
    }
  }

  if (!scheduled && !sent) return null;

  return (
    <>
      {scheduled ? (
        <div className="bg-muted mt-3 flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2">
          <CalendarClock className="size-4 shrink-0" aria-hidden />
          <p className="text-sm font-semibold">
            {t("family.scheduledFor", { when: formatDateTime(new Date(scheduled.scheduled_for!)) })}
          </p>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-10"
              onClick={() =>
                setEditing({
                  id: scheduled.id,
                  scheduledFor: scheduled.scheduled_for!,
                  message: scheduled.message,
                  cardStyle: scheduled.card_style,
                  channel: scheduled.channel,
                  occasion: scheduled.occasion,
                })
              }
            >
              {t("family.editSchedule")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive h-10"
              onClick={() => handleCancel(scheduled.id)}
            >
              {t("family.cancelSchedule")}
            </Button>
          </div>
        </div>
      ) : null}

      {!scheduled && sent ? (
        <p className="text-muted-foreground mt-3 flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="size-4" aria-hidden />
          {t("family.greetingSent", {
            when: formatDateTime(new Date(sent.sent_at ?? Date.now())),
          })}
        </p>
      ) : null}

      {editing ? (
        <GreetingComposer
          member={member}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          reminderId={reminderId}
          editing={editing}
        />
      ) : null}
    </>
  );
}
