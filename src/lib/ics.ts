/**
 * Minimal RFC 5545 helpers shared by the subscription feed route and the
 * single-event download button.
 *
 * Reminders are emitted as single (non-recurring) events at their current
 * `due_at`. Our "roll forward on completion" model does not map cleanly onto a
 * fixed RRULE, so a subscribed calendar simply picks up the next occurrence on
 * its next refresh.
 */

export type IcsAlarm = { minutesBefore: number; label?: string | null };

export type IcsEvent = {
  uid: string;
  start: Date;
  durationMinutes?: number;
  summary: string;
  description?: string | null;
  alarms?: IcsAlarm[];
};

function pad(n: number): string {
  return `${n}`.padStart(2, "0");
}

/** UTC basic-format timestamp, e.g. 20260830T091500Z */
export function icsDate(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

export function icsEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold long lines at 75 octets as required by RFC 5545. */
function fold(line: string): string {
  if (line.length <= 73) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 73));
  rest = rest.slice(73);
  while (rest.length > 72) {
    parts.push(` ${rest.slice(0, 72)}`);
    rest = rest.slice(72);
  }
  if (rest.length) parts.push(` ${rest}`);
  return parts.join("\r\n");
}

function eventLines(event: IcsEvent, stamp: Date): string[] {
  const end = new Date(event.start.getTime() + (event.durationMinutes ?? 30) * 60_000);
  const lines = [
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${icsDate(stamp)}`,
    `DTSTART:${icsDate(event.start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEscape(event.summary)}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${icsEscape(event.description)}`);
  for (const alarm of event.alarms ?? []) {
    const minutes = Math.max(0, Math.round(alarm.minutesBefore));
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsEscape(alarm.label || event.summary)}`,
      `TRIGGER:-PT${minutes}M`,
      "END:VALARM",
    );
  }
  lines.push("END:VEVENT");
  return lines;
}

export function buildIcs(options: {
  name: string;
  description?: string;
  events: IcsEvent[];
  /** Refresh hint for subscribed calendars, in hours. */
  refreshHours?: number;
  now?: Date;
}): string {
  const stamp = options.now ?? new Date();
  const ttl = `PT${Math.max(1, Math.round(options.refreshHours ?? 1))}H`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//e-Reminder//Calendar Sync//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(options.name)}`,
    ...(options.description ? [`X-WR-CALDESC:${icsEscape(options.description)}`] : []),
    `REFRESH-INTERVAL;VALUE=DURATION:${ttl}`,
    `X-PUBLISHED-TTL:${ttl}`,
    ...options.events.flatMap((event) => eventLines(event, stamp)),
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
