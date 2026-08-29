import { createFileRoute } from "@tanstack/react-router";
import { buildIcs, type IcsEvent } from "@/lib/ics";
import { categoryMeta } from "@/lib/ereminder";
import type { Database } from "@/integrations/supabase/types";

/**
 * Private ICS subscription feed.
 *
 * Calendar apps cannot sign in or send bearer tokens, so — exactly like the
 * pincode share link — the unguessable per-profile token IS the access
 * control. It can be rotated from the Profile page to revoke a shared URL.
 */

type ReminderCategory = Database["public"]["Enums"]["reminder_category"];

const MAX_EVENTS = 500;

export const Route = createFileRoute("/api/public/calendar/$token.ics")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = params.token?.trim();
        if (!token || token.length < 16 || !/^[a-f0-9]+$/i.test(token)) {
          return new Response("Not found", { status: 404 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name")
          .eq("calendar_token", token)
          .maybeSingle();

        if (!profile) return new Response("Not found", { status: 404 });

        const { data: reminders } = await supabaseAdmin
          .from("reminders")
          .select("id, title, description, category, due_at, recurrence, completed")
          .eq("user_id", profile.id)
          .order("due_at", { ascending: true })
          .limit(MAX_EVENTS);

        const active = (reminders ?? []).filter(
          (r) => r.recurrence !== "once" || !r.completed,
        );

        const alertsByReminder = new Map<string, number>();
        if (active.length) {
          const { data: alerts } = await supabaseAdmin
            .from("reminder_alerts")
            .select("reminder_id, offset_minutes")
            .in(
              "reminder_id",
              active.map((r) => r.id),
            );
          for (const alert of alerts ?? []) {
            const current = alertsByReminder.get(alert.reminder_id) ?? -1;
            if (alert.offset_minutes > current) {
              alertsByReminder.set(alert.reminder_id, alert.offset_minutes);
            }
          }
        }

        const events: IcsEvent[] = active.map((r) => {
          const meta = categoryMeta(r.category as ReminderCategory);
          const description = [meta.label, r.description].filter(Boolean).join(" — ");
          const largest = alertsByReminder.get(r.id);
          return {
            uid: `reminder-${r.id}@ereminder`,
            start: new Date(r.due_at),
            durationMinutes: 30,
            summary: `${meta.emoji} ${r.title}`,
            description,
            ...(largest === undefined ? {} : { alarms: [{ minutesBefore: largest }] }),
          };
        });

        const body = buildIcs({
          name: profile.full_name ? `${profile.full_name} — e-Reminder` : "e-Reminder",
          description: "Your reminders from e-Reminder",
          refreshHours: 1,
          events,
        });

        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Cache-Control": "no-store, max-age=0",
            "Content-Disposition": 'inline; filename="ereminder.ics"',
          },
        });
      },
    },
  },
});
