/**
 * Missed-dose escalation.
 *
 * Runs inside the existing 10-minute reminder dispatch cron. When a daily
 * health reminder's dose time passed more than two hours ago and nothing was
 * recorded for it today, the family member the user picked gets a WhatsApp
 * through the same MSG91 path the rest of the app uses.
 */

const LATE_AFTER_MS = 2 * 60 * 60 * 1000;
const BATCH_LIMIT = 200;

type AdminClient = {
  from: (table: string) => any;
};

function istDayBounds(now: Date): { start: Date; end: Date } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

async function sendMissedDoseWhatsapp(
  phone: string,
  title: string,
  when: string,
): Promise<{ ok: boolean; detail?: string }> {
  const authKey = process.env["MSG91_AUTH_KEY"];
  const integratedNumber = process.env["MSG91_WHATSAPP_NUMBER"];
  if (!authKey || !integratedNumber) return { ok: false, detail: "not_configured" };

  const templateName = process.env["MSG91_WA_REMINDER_TEMPLATE"] ?? "ereminder_alert";
  const namespace = process.env["MSG91_WA_NAMESPACE"];

  const payload = {
    integrated_number: integratedNumber,
    content_type: "template",
    payload: {
      messaging_product: "whatsapp",
      type: "template",
      template: {
        name: templateName,
        language: { code: "en", policy: "deterministic" },
        ...(namespace ? { namespace } : {}),
        to_and_components: [
          {
            to: [phone.replace(/\D/g, "")],
            components: {
              body_1: { type: "text", value: title.replace(/\s+/g, " ").slice(0, 200) },
              body_2: { type: "text", value: when },
            },
          },
        ],
      },
    },
  };

  try {
    const res = await fetch(
      "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", authkey: authKey },
        body: JSON.stringify(payload),
      },
    );
    const text = await res.text();
    if (!res.ok) return { ok: false, detail: text.slice(0, 200) };
    try {
      const parsed = JSON.parse(text) as { type?: string; message?: string };
      if (parsed.type === "error") return { ok: false, detail: parsed.message ?? "rejected" };
    } catch {
      /* non-JSON success body is fine */
    }
    return { ok: true };
  } catch {
    return { ok: false, detail: "provider_unreachable" };
  }
}

export async function escalateMissedDoses(
  supabaseAdmin: AdminClient,
): Promise<{ checked: number; sent: number; skipped: number; failed: number }> {
  const summary = { checked: 0, sent: 0, skipped: 0, failed: 0 };
  const now = new Date();
  const { start, end } = istDayBounds(now);

  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, medicine_alert_member_id")
    .eq("medicine_alert_enabled", true)
    .not("medicine_alert_member_id", "is", null)
    .limit(BATCH_LIMIT);
  if (error || !profiles?.length) return summary;

  for (const profile of profiles as {
    id: string;
    full_name: string | null;
    medicine_alert_member_id: string;
  }[]) {
    const { data: member } = await supabaseAdmin
      .from("family_members")
      .select("id, full_name, whatsapp_phone")
      .eq("id", profile.medicine_alert_member_id)
      .maybeSingle();
    const phone = (member as { whatsapp_phone?: string | null } | null)?.whatsapp_phone;
    if (!phone) {
      summary.skipped += 1;
      continue;
    }

    const { data: reminders } = await supabaseAdmin
      .from("reminders")
      .select("id, title, due_at, category, recurrence, completed")
      .eq("user_id", profile.id)
      .eq("category", "health")
      .eq("recurrence", "daily")
      .eq("completed", false)
      .limit(BATCH_LIMIT);

    for (const reminder of (reminders ?? []) as {
      id: string;
      title: string;
      due_at: string;
    }[]) {
      const due = new Date(reminder.due_at);
      const doseAt = new Date(now);
      doseAt.setHours(due.getHours(), due.getMinutes(), 0, 0);
      if (now.getTime() - doseAt.getTime() < LATE_AFTER_MS) continue;
      // Already rolled past today means the dose was handled.
      if (due.getTime() >= end.getTime()) continue;

      summary.checked += 1;

      const { data: existing } = await supabaseAdmin
        .from("reminder_occurrences")
        .select("id, status")
        .eq("reminder_id", reminder.id)
        .gte("occurrence_at", start.toISOString())
        .lt("occurrence_at", end.toISOString())
        .limit(1);
      if (existing?.length) {
        summary.skipped += 1;
        continue;
      }

      const when = doseAt.toLocaleString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      });
      const result = await sendMissedDoseWhatsapp(
        phone,
        `Missed dose: ${reminder.title} (${profile.full_name ?? "your family member"})`,
        when,
      );
      if (!result.ok) {
        summary.failed += 1;
        continue;
      }

      // The "missed" occurrence doubles as the de-duplication marker so the
      // next cron pass does not send the same alert again.
      await supabaseAdmin.from("reminder_occurrences").insert({
        user_id: profile.id,
        reminder_id: reminder.id,
        occurrence_at: doseAt.toISOString(),
        status: "missed",
      });
      summary.sent += 1;
    }
  }

  return summary;
}
