import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;
type DocType = Database["public"]["Enums"]["document_type"];
type ReminderCategory = Database["public"]["Enums"]["reminder_category"];

/** Same mapping the Document Shelf uses when it creates a reminder by hand. */
const DOC_TYPE_CATEGORY: Record<DocType, ReminderCategory> = {
  insurance: "finance_tax",
  puc: "automotive",
  id_proof: "household",
  vehicle: "automotive",
  warranty: "household",
  subscription: "finance_tax",
  other: "household",
};

const DOC_ALERTS = [
  { offset: 10080, label: "7 days before" },
  { offset: 0, label: "At the time" },
];

/** 9am (IST) on the day the paper runs out. */
export function expiryDueAtUtc(expiry: string): string {
  const [y, m, d] = expiry.split("-").map(Number);
  return new Date(
    Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 9 - 5, 0 - 30, 0),
  ).toISOString();
}

/**
 * Gives every document with an expiry date a reminder, without duplicates:
 * creates one where it is missing and keeps an existing one on the right day.
 */
export async function syncDocumentExpiryReminders(
  admin: Admin,
  opts: { dryRun?: boolean } = {},
): Promise<{ created: number; updated: number; skipped: number }> {
  const { data: docs, error } = await admin
    .from("documents")
    .select("id, user_id, title, doc_type, expiry_date, notes, family_member_id, reminder_id")
    .not("expiry_date", "is", null);
  if (error) throw error;

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const doc of docs ?? []) {
    const expiry = doc.expiry_date;
    if (!expiry) continue;
    const dueAt = expiryDueAtUtc(expiry);

    if (doc.reminder_id) {
      const { data: existing } = await admin
        .from("reminders")
        .select("id, due_at, completed")
        .eq("id", doc.reminder_id)
        .maybeSingle();

      if (existing) {
        if (!existing.completed && existing.due_at !== dueAt) {
          if (!opts.dryRun) {
            await admin.from("reminders").update({ due_at: dueAt }).eq("id", existing.id);
          }
          updated += 1;
        } else {
          skipped += 1;
        }
        continue;
      }
      // Reminder was deleted — fall through and make a fresh one.
    }

    if (opts.dryRun) {
      created += 1;
      continue;
    }

    const { data: inserted, error: insertError } = await admin
      .from("reminders")
      .insert({
        user_id: doc.user_id,
        title: `Renew: ${doc.title}`,
        description: doc.notes,
        category: DOC_TYPE_CATEGORY[doc.doc_type],
        due_at: dueAt,
        recurrence: "once" as const,
        family_member_id: doc.family_member_id,
      })
      .select("id")
      .single();
    if (insertError || !inserted) {
      skipped += 1;
      continue;
    }

    await admin.from("reminder_alerts").insert(
      DOC_ALERTS.map((a) => ({
        user_id: doc.user_id,
        reminder_id: inserted.id,
        offset_minutes: a.offset,
        label: a.label,
      })),
    );
    await admin.from("documents").update({ reminder_id: inserted.id }).eq("id", doc.id);
    created += 1;
  }

  return { created, updated, skipped };
}
