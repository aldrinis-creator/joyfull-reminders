/**
 * Detects that a newer build has been deployed while this page stayed open.
 *
 * The app ships no caching service worker, so a reload always fetches fresh
 * code — the real hazard is a phone that keeps the page alive in memory for
 * hours (an installed PWA resumes instead of reloading), so the person keeps
 * using yesterday's JavaScript without any way of knowing.
 *
 * Every deploy renames the hashed entry bundle, so its filename is a reliable
 * build fingerprint: compare the one this page booted with against the one the
 * server advertises right now.
 */
const ENTRY_RE = /\/assets\/index-[A-Za-z0-9_-]+\.js/;

export function currentEntry(): string | null {
  if (typeof document === "undefined") return null;
  for (const script of Array.from(document.querySelectorAll("script[src]"))) {
    const src = script.getAttribute("src") ?? "";
    const match = ENTRY_RE.exec(src);
    if (match) return match[0];
  }
  return null;
}

export async function latestEntry(): Promise<string | null> {
  try {
    const res = await fetch("/", { cache: "no-store", headers: { accept: "text/html" } });
    if (!res.ok) return null;
    const html = await res.text();
    return ENTRY_RE.exec(html)?.[0] ?? null;
  } catch {
    return null;
  }
}

/** True only when we can positively identify two different builds. */
export async function isUpdateAvailable(booted: string | null): Promise<boolean> {
  if (!booted) return false;
  const latest = await latestEntry();
  return latest !== null && latest !== booted;
}
