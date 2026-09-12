import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { nextOccurrence, type Reminder } from "@/lib/ereminder";

export const askAssistantInput = z.object({
  question: z.string().trim().min(1).max(500),
  language: z.enum(["en", "hi"]).default("en"),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().max(2000),
      }),
    )
    .max(6)
    .default([]),
});

export type AskAssistantResult =
  | { ok: true; answer: string }
  | { ok: false; reason: "not_configured" | "failed" };

const WINDOW_DAYS = 60;

const SYSTEM_PROMPT = `You are the in-app assistant of "e-Reminder", a reminders app used in India, including by elderly and non-technical people.

Rules:
- Answer ONLY from the user's data given below. It is the single source of truth.
- If the answer is not in that data, say plainly that it is not on file. Never guess, never invent dates, amounts, names or events.
- Keep answers short (1-4 sentences or a short list), warm and in plain, non-technical language.
- Do not dump raw data, and do not reveal phone numbers, UPI IDs or other contact details unless the question cannot be answered without them.
- Money amounts are Indian rupees.
- Reply in the same language the question was asked in (English or Hindi). If unclear, reply in English.`;

function fmt(d: Date) {
  return d.toLocaleString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

/** Next occurrence of a recurring yearly-style special date, within the window. */
function nextAnnual(dateStr: string, from: Date) {
  const base = new Date(`${dateStr}T00:00:00+05:30`);
  if (Number.isNaN(base.getTime())) return null;
  const next = new Date(base);
  while (next < from) next.setFullYear(next.getFullYear() + 1);
  return next;
}

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => askAssistantInput.parse(input))
  .handler(async ({ data, context }): Promise<AskAssistantResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false, reason: "not_configured" };

    const now = new Date();
    const windowEnd = new Date(now.getTime() + WINDOW_DAYS * 86_400_000);

    const [remindersRes, membersRes, datesRes] = await Promise.all([
      context.supabase
        .from("reminders")
        .select(
          "id,title,category,due_at,recurrence,recurrence_interval_days,completed,payment_amount,description,family_member_id",
        )
        .eq("user_id", context.userId)
        .order("due_at", { ascending: true })
        .limit(300),
      context.supabase
        .from("family_members")
        .select("id,full_name,relationship,birth_date")
        .eq("user_id", context.userId)
        .limit(200),
      context.supabase
        .from("special_dates")
        .select("family_member_id,title,kind,event_date,recurring")
        .eq("user_id", context.userId)
        .limit(300),
    ]);

    const memberName = new Map(
      (membersRes.data ?? []).map((m) => [m.id, m.full_name] as const),
    );

    const reminderLines: { at: Date; line: string }[] = [];
    for (const r of remindersRes.data ?? []) {
      if (r.completed) continue;
      const at = nextOccurrence(r as unknown as Reminder, now);
      if (at > windowEnd) continue;
      const who = r.family_member_id ? memberName.get(r.family_member_id) : undefined;
      const bits = [
        `${fmt(at)} — ${r.title}`,
        `category: ${r.category}`,
        r.recurrence !== "once" ? `repeats: ${r.recurrence}` : null,
        r.payment_amount ? `amount: Rs ${r.payment_amount}` : null,
        who ? `for: ${who}` : null,
        at < now ? "status: overdue" : null,
        r.description ? `notes: ${r.description.slice(0, 120)}` : null,
      ].filter(Boolean);
      reminderLines.push({ at, line: `- ${bits.join(" | ")}` });
    }
    reminderLines.sort((a, b) => a.at.getTime() - b.at.getTime());

    const dateLines: { at: Date; line: string }[] = [];
    for (const d of datesRes.data ?? []) {
      const at = d.recurring
        ? nextAnnual(d.event_date, now)
        : new Date(`${d.event_date}T00:00:00+05:30`);
      if (!at || Number.isNaN(at.getTime()) || at > windowEnd || at < now) continue;
      const who = memberName.get(d.family_member_id) ?? "family member";
      dateLines.push({
        at,
        line: `- ${fmt(at)} — ${who}: ${d.title} (${d.kind})`,
      });
    }
    for (const m of membersRes.data ?? []) {
      if (!m.birth_date) continue;
      const at = nextAnnual(m.birth_date, now);
      if (!at || at > windowEnd) continue;
      dateLines.push({ at, line: `- ${fmt(at)} — ${m.full_name} (${m.relationship}): birthday` });
    }
    dateLines.sort((a, b) => a.at.getTime() - b.at.getTime());

    const summary = [
      `Today (India time): ${fmt(now)}`,
      "",
      `UPCOMING REMINDERS (next ${WINDOW_DAYS} days, not completed):`,
      reminderLines.length ? reminderLines.map((r) => r.line).join("\n") : "- none",
      "",
      `FAMILY SPECIAL DATES (next ${WINDOW_DAYS} days):`,
      dateLines.length ? dateLines.map((d) => d.line).join("\n") : "- none",
    ].join("\n");

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash",
          messages: [
            { role: "system", content: `${SYSTEM_PROMPT}\n\nUSER'S DATA:\n${summary}` },
            ...data.history.slice(-6).map((m) => ({ role: m.role, content: m.text })),
            { role: "user", content: data.question },
          ],
        }),
      });

      if (!res.ok) {
        console.error("[assistant] gateway error", res.status, await res.text());
        return { ok: false, reason: "failed" };
      }

      const body = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const answer = body.choices?.[0]?.message?.content?.trim() ?? "";
      if (!answer) return { ok: false, reason: "failed" };
      return { ok: true, answer };
    } catch (error) {
      console.error("[assistant] request failed", error);
      return { ok: false, reason: "failed" };
    }
  });
