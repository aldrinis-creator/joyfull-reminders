export const LANGUAGES = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "hi", label: "Hindi", nativeLabel: "हिंदी" },
] as const;

export type Language = (typeof LANGUAGES)[number]["code"];

/**
 * A namespace holds the English source-of-truth strings plus a full parallel
 * translation for every other supported language. Adding a new language means
 * adding one more key here (and to LANGUAGES) — nothing else changes.
 */
export type Namespace = Record<Language, Record<string, string>>;

export const LANGUAGE_STORAGE_KEY = "ereminder-language";

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some((l) => l.code === value);
}

export function readStoredLanguage(): Language {
  if (typeof window === "undefined") return "en";
  try {
    const raw = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(raw) ? raw : "en";
  } catch {
    return "en";
  }
}

/** Applies the stored language before first paint (html lang + global hint). */
export const languageInitScript = `(function(){try{var k=localStorage.getItem(${JSON.stringify(
  LANGUAGE_STORAGE_KEY,
)});var l=(k==='hi'||k==='en')?k:'en';window.__EREMINDER_LANG__=l;document.documentElement.setAttribute('lang',l);}catch(e){}})();`;
