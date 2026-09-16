import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GreetingComposer } from "@/components/GreetingComposer";
import { supabase } from "@/integrations/supabase/client";
import { cancelScheduledGreeting } from "@/lib/greetings.functions";
import { formatDateTime, type FamilyMember } from "@/lib/ereminder";
import { useFamilyMembers } from "@/lib/queries";
import { useT } from "@/hooks/useLanguage";
import type { GreetingChannel } from "@/lib/greetings";

type EditingState = {
  id: string;
  scheduledFor: string;
  message: string;
  cardStyle: string;
  channel: GreetingChannel;
  occasion: string;
};

/** Upcoming scheduled greetings across every reminder / family member. */
export function ScheduledGreetingsList() {
  const t = useT();
  const queryClient = useQueryClient();
  const cancel = useServerFn(cancelScheduledGreeting);
  const { data: members } = useFamilyMembers();
  const [editing, setEditing] = useState<null | { state: EditingState; member: FamilyMember }>(
    null,
  );

  const { data } = useQuery({
    queryKey: ["greetings", "scheduled-upcoming"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("greetings")
        .select(
          "id, occasion, message, card_style, channel, scheduled_for, family_member_id, family_members(full_name)",
        )
        .eq("status", "scheduled")
        .gt("scheduled_for", new Date().toISOString())
        .order("scheduled_for", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function handleCancel(id: string) {
    const result = await cancel({ data: { greetingId: id } });
    if (result.ok) {
      toast.success(t("family.scheduleCancelled"));
      void queryClient.invalidateQueries({ queryKey: ["greetings"] });
    } else {
      toast.error(t("family.cancelFailed"));
    }
  }

  const rows = data ?? [];

  if (!rows.length) {
    return (
      <p className="text-muted-foreground bg-card shadow-card rounded-3xl px-6 py-10 text-center">
        {t("reminders.noScheduledGreetings")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((g) => {
        const name =
          (g.family_members as { full_name: string } | null)?.full_name ?? t("family.someone");
        const member = (members ?? []).find((m) => m.id === g.family_member_id);
        return (
          <article key={g.id} className="bg-card shadow-card rounded-3xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-xl">{name}</h3>
                <p className="text-muted-foreground text-sm font-semibold">{g.occasion}</p>
                <p className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                  <CalendarClock className="size-4" aria-hidden />
                  {formatDateTime(new Date(g.scheduled_for!))}
                </p>
              </div>
              <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs font-bold">
                {g.channel === "email" ? (
                  <>
                    <Mail className="size-4" aria-hidden /> {t("reminders.channelEmail")}
                  </>
                ) : (
                  <>
                    <MessageCircle className="size-4" aria-hidden /> {t("reminders.channelWhatsapp")}
                  </>
                )}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {member ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-11"
                  onClick={() =>
                    setEditing({
                      member,
                      state: {
                        id: g.id,
                        scheduledFor: g.scheduled_for!,
                        message: g.message,
                        cardStyle: g.card_style,
                        channel: g.channel,
                        occasion: g.occasion,
                      },
                    })
                  }
                >
                  {t("family.editSchedule")}
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                className="text-destructive h-11"
                onClick={() => void handleCancel(g.id)}
              >
                {t("family.cancelSchedule")}
              </Button>
            </div>
          </article>
        );
      })}

      {editing ? (
        <GreetingComposer
          member={editing.member}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          editing={editing.state}
        />
      ) : null}
    </div>
  );
}
