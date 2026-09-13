import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  parseDocumentScanInput,
  parsedReminderSchema,
  type ParsedReminder,
} from "@/lib/voice-reminder.schemas";

export type ParseDocumentScanResult =
  | { ok: true; reminder: ParsedReminder }
  | { ok: false; reason: "not_configured" | "unclear" | "failed" };

const SYSTEM_PROMPT = `You read a photographed Indian bill or document (electricity, water, gas, broadband, insurance policy, PUC certificate, vehicle papers, school/college admission form, tax notice, subscription invoice) and turn it into reminder fields.

Rules:
- Extract ONLY what is visibly printed on the page. Never invent or estimate a date, an amount or a name. Omit any field you cannot read.
- "title" is a short natural phrase, e.g. "Electricity bill - MSEDCL" or "Car insurance renewal".
- "date" is YYYY-MM-DD: the due date / last date of payment / expiry / renewal date printed on the page. Resolve any relative wording against the supplied local date. If the printed due date has clearly already passed, still return what is printed.
- "time" only if a time is printed. "recurrence" is one of once, daily, weekly, monthly, yearly — use the billing cycle when it is printed (e.g. a monthly electricity bill => monthly), otherwise "once".
- "category" is one of: personal_family, finance_tax (bills, taxes, EMIs, insurance premiums), automotive (PUC, vehicle insurance, servicing), academic_career, subscription, health, household (utilities, home maintenance), appointment, meeting, custom.
- "paymentAmount" is the total amount payable in rupees, as a plain number, ONLY if clearly printed. Ignore previous balances, arrears breakdowns and late-payment-after-due-date figures unless that is the only total.
- "upiPayeeName" is the biller / company name exactly as printed.
- "vehicleNumber" only for vehicle documents, "institution" only for academic documents.
- If the image is not a bill or document at all (a person, a landscape, blank/unreadable), call the tool with no fields filled.
- Respond with the tool call only.`;

export const parseDocumentScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => parseDocumentScanInput.parse(input))
  .handler(async ({ data }): Promise<ParseDocumentScanResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false, reason: "not_configured" };

    const tool = {
      type: "function" as const,
      function: {
        name: "fill_reminder",
        description: "Fill only the reminder fields clearly printed on the document.",
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
            paymentAmount: { type: "number", description: "Total payable in rupees" },
            upiPayeeName: { type: "string", description: "Biller or company name" },
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
              content: [
                {
                  type: "text",
                  text: `Reader language: ${data.language}\nLocal date and time now: ${data.localNow}\nExtract the reminder fields from these ${data.images.length} photo(s) of one document (pages or front/back of the same paper).`,
                },
                ...data.images.map((img) => ({
                  type: "image_url" as const,
                  image_url: { url: `data:${img.mimeType};base64,${img.imageBase64}` },
                })),
              ],
            },
          ],
          tools: [tool],
          tool_choice: { type: "function", function: { name: "fill_reminder" } },
        }),
      });

      if (!res.ok) {
        console.error("[document-scan] gateway error", res.status, await res.text());
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

      const hasSomething = Object.values(parsed.data).some((v) =>
        typeof v === "string" ? v.trim().length > 0 : typeof v === "number",
      );
      if (!hasSomething) return { ok: false, reason: "unclear" };

      return { ok: true, reminder: parsed.data };
    } catch (error) {
      console.error("[document-scan] request failed", error);
      return { ok: false, reason: "failed" };
    }
  });
