import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  parseVoiceReminderInput,
  parsedReminderSchema,
  type ParsedReminder,
} from "@/lib/voice-reminder.schemas";

export type ParseVoiceReminderResult =
  | { ok: true; reminder: ParsedReminder }
  | { ok: false; reason: "not_configured" | "unclear" | "failed" };

const SYSTEM_PROMPT = `You turn a spoken sentence into structured reminder fields for an Indian reminders app.

Rules:
- Only output a field when the speaker actually said it or it is unmistakably implied. Never invent a birth year, a person, an amount, a place or notes.
- "date" is YYYY-MM-DD, "time" is 24-hour HH:mm. Resolve relative phrases ("tomorrow", "next Friday", "in 2 weeks") against the supplied local date and time. If a date is spoken without a year and that date has already passed this year, use next year.
- If no time was said, omit "time".
- "recurrence" is one of once, daily, weekly, monthly, yearly. Use "once" unless repetition was said ("every year", "monthly", "each month").
- "category" is one of: personal_family (birthdays, anniversaries, family events), finance_tax (bills, taxes, EMIs, insurance premiums), automotive (PUC, vehicle insurance, servicing), academic_career (exams, admissions, forms), subscription (trials, renewals of services), health (medicines, check-ups), household (utilities, home maintenance), appointment (doctor, salon, bank visit, any personal appointment), meeting (work or group meetings and calls), custom. Choose the closest; use "custom" when unclear.
- "location" only for appointments/meetings/health when a place or meeting link was said. "participants" only when people were named. "vehicleNumber" only for automotive when a registration number was said. "institution" only for academic_career.
- "title" is a short, natural phrase in the same language as the speaker, without the words "remind me to".
- Respond with the tool call only.`;

export const parseVoiceReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => parseVoiceReminderInput.parse(input))
  .handler(async ({ data }): Promise<ParseVoiceReminderResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false, reason: "not_configured" };

    const tool = {
      type: "function" as const,
      function: {
        name: "fill_reminder",
        description: "Fill only the reminder fields that were clearly stated.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string" },
            category: {
              type: "string",
              enum: [
                "personal_family",
                "finance_tax",
                "automotive",
                "academic_career",
                "subscription",
                "health",
                "household",
                "custom",
                "appointment",
                "meeting",
              ],
            },
            date: { type: "string", description: "YYYY-MM-DD" },
            time: { type: "string", description: "24-hour HH:mm" },
            recurrence: {
              type: "string",
              enum: ["once", "daily", "weekly", "monthly", "yearly"],
            },
            description: { type: "string" },
            location: { type: "string" },
            participants: { type: "string" },
            vehicleNumber: { type: "string" },
            institution: { type: "string" },
          },
          additionalProperties: false,
        },
      },
    };

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
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `Speaker language: ${data.language}\nTheir local date and time now: ${data.localNow}\nThey said: "${data.transcript}"`,
            },
          ],
          tools: [tool],
          tool_choice: { type: "function", function: { name: "fill_reminder" } },
        }),
      });

      if (!res.ok) {
        console.error("[voice-reminder] gateway error", res.status, await res.text());
        return { ok: false, reason: "failed" };
      }

      const body = (await res.json()) as {
        choices?: {
          message?: {
            tool_calls?: { function?: { arguments?: string } }[];
            content?: string;
          };
        }[];
      };

      const raw =
        body.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ??
        body.choices?.[0]?.message?.content ??
        "";
      if (!raw) return { ok: false, reason: "unclear" };

      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch {
        return { ok: false, reason: "unclear" };
      }

      const parsed = parsedReminderSchema.safeParse(json);
      if (!parsed.success) return { ok: false, reason: "unclear" };

      const hasSomething = Object.values(parsed.data).some(
        (v) => typeof v === "string" && v.trim().length > 0,
      );
      if (!hasSomething) return { ok: false, reason: "unclear" };

      return { ok: true, reminder: parsed.data };
    } catch (error) {
      console.error("[voice-reminder] request failed", error);
      return { ok: false, reason: "failed" };
    }
  });
