import common from "./locales/common";
import home from "./locales/home";
import reminders from "./locales/reminders";
import family from "./locales/family";
import market from "./locales/market";
import profile from "./locales/profile";
import publicNs from "./locales/public";
import { LANGUAGES, type Language, type Namespace } from "./types";

export * from "./types";

const NAMESPACES: Record<string, Namespace> = {
  common,
  home,
  reminders,
  family,
  market,
  profile,
  public: publicNs,
};

function build(lang: Language): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [ns, dict] of Object.entries(NAMESPACES)) {
    for (const [key, value] of Object.entries(dict[lang] ?? {})) {
      out[ns === "common" ? key : `${ns}.${key}`] = value;
    }
  }
  return out;
}

export const dictionaries: Record<Language, Record<string, string>> = Object.fromEntries(
  LANGUAGES.map((l) => [l.code, build(l.code)]),
) as Record<Language, Record<string, string>>;

export type TranslateVars = Record<string, string | number>;

export function translate(key: string, vars?: TranslateVars, lang: Language = activeLanguage): string {
  const raw = dictionaries[lang]?.[key] ?? dictionaries.en[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name: string) =>
    vars[name] === undefined ? m : String(vars[name]),
  );
}

/**
 * Module-level active language so non-React helpers (date formatting,
 * category labels) can localise without threading a hook everywhere.
 */
let activeLanguage: Language = "en";

export function setActiveLanguage(lang: Language): void {
  activeLanguage = lang;
}

export function getActiveLanguage(): Language {
  return activeLanguage;
}

/** BCP-47 locale used for dates/numbers — Latin digits in both languages. */
export function activeLocale(lang: Language = activeLanguage): string {
  return lang === "hi" ? "hi-IN-u-nu-latn" : "en-IN";
}
