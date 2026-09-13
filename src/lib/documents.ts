import { supabase } from "@/integrations/supabase/client";
import { translate } from "@/lib/i18n";
import type { Database } from "@/integrations/supabase/types";
import type { ReminderCategory } from "@/lib/ereminder";

export type DocType = Database["public"]["Enums"]["document_type"];
export type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];

export const DOC_TYPES: DocType[] = [
  "insurance",
  "puc",
  "id_proof",
  "vehicle",
  "warranty",
  "subscription",
  "other",
];

/** Which existing reminder category best fits each kind of document. */
const DOC_TYPE_CATEGORY: Record<DocType, ReminderCategory> = {
  insurance: "finance_tax",
  puc: "automotive",
  id_proof: "household",
  vehicle: "automotive",
  warranty: "household",
  subscription: "finance_tax",
  other: "household",
};

export function documentCategory(type: DocType): ReminderCategory {
  return DOC_TYPE_CATEGORY[type];
}

export function docTypeLabel(type: DocType): string {
  return translate(`documents.type_${type}`);
}

export const DOCUMENTS_BUCKET = "documents";
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_DOCUMENT_TYPES = "image/*,application/pdf";

/** Days left until expiry — negative when already past. */
export function daysUntil(expiry: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = expiry.split("-").map(Number);
  const target = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function expiryTone(expiry: string | null): "none" | "soon" | "past" {
  if (!expiry) return "none";
  const days = daysUntil(expiry);
  if (days < 0) return "past";
  return days <= 30 ? "soon" : "none";
}

/** Documents sorted with the soonest expiry first and undated ones last. */
export function sortDocuments(rows: DocumentRow[]): DocumentRow[] {
  return [...rows].sort((a, b) => {
    if (a.expiry_date && b.expiry_date) return a.expiry_date.localeCompare(b.expiry_date);
    if (a.expiry_date) return -1;
    if (b.expiry_date) return 1;
    return a.title.localeCompare(b.title);
  });
}

/** A short-lived link so the owner can open or download their own file. */
export async function signedDocumentUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

/** Every stored file for a document — newer rows keep a list, older ones a single path. */
export function documentPaths(doc: Pick<DocumentRow, "file_path" | "file_paths">): string[] {
  const list = (doc.file_paths ?? []).filter(Boolean);
  return list.length ? list : doc.file_path ? [doc.file_path] : [];
}

export async function signedDocumentUrls(paths: string[]): Promise<string[]> {
  const urls = await Promise.all(paths.map((p) => signedDocumentUrl(p)));
  return urls.filter((u): u is string => Boolean(u));
}

/** Uploads one or more files for a document and returns their storage paths. */
export async function uploadDocumentFiles(userId: string, files: Blob[]): Promise<string[] | null> {
  const paths: string[] = [];
  for (const [i, file] of files.entries()) {
    const type = file.type || "image/jpeg";
    const ext =
      type === "application/pdf" ? "pdf" : type.split("/")[1]?.replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${userId}/${Date.now()}-${i}.${ext}`;
    const { error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(path, file, { contentType: type, upsert: false });
    if (error) {
      await removeDocumentFiles(paths);
      return null;
    }
    paths.push(path);
  }
  return paths;
}

export async function removeDocumentFiles(paths: string[]): Promise<void> {
  if (paths.length) await supabase.storage.from(DOCUMENTS_BUCKET).remove(paths);
}

/** Expiry dates become a 9am reminder on the day the paper runs out. */
export function expiryDueAt(expiry: string): string {
  const [y, m, d] = expiry.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 9, 0, 0, 0).toISOString();
}

/** "7 days before" and "on the day" — the two alerts every document gets. */
const DOC_ALERTS = [
  { offset: 10080, label: "7 days before" },
  { offset: 0, label: "At the time" },
];

export async function createExpiryReminder(input: {
  userId: string;
  title: string;
  docType: DocType;
  expiry: string;
  familyMemberId: string | null;
  notes: string | null;
}): Promise<string | null> {
  const { data, error } = await supabase
    .from("reminders")
    .insert({
      user_id: input.userId,
      title: translate("documents.reminderTitle", { title: input.title }),
      description: input.notes,
      category: documentCategory(input.docType),
      due_at: expiryDueAt(input.expiry),
      recurrence: "once" as const,
      family_member_id: input.familyMemberId,
    })
    .select("id")
    .single();
  if (error || !data) return null;

  await supabase.from("reminder_alerts").insert(
    DOC_ALERTS.map((a) => ({
      user_id: input.userId,
      reminder_id: data.id,
      offset_minutes: a.offset,
      label: a.label,
    })),
  );
  return data.id;
}

export async function updateExpiryReminderDate(reminderId: string, expiry: string): Promise<void> {
  await supabase
    .from("reminders")
    .update({ due_at: expiryDueAt(expiry) })
    .eq("id", reminderId);
}

export async function deleteExpiryReminder(reminderId: string): Promise<void> {
  await supabase.from("reminders").delete().eq("id", reminderId);
}
