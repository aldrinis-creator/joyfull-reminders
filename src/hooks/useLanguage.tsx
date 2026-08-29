import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  LANGUAGE_STORAGE_KEY,
  readStoredLanguage,
  setActiveLanguage,
  translate,
  type Language,
  type TranslateVars,
} from "@/lib/i18n";

type LanguageContextValue = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, vars?: TranslateVars) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function initialLanguage(): Language {
  if (typeof window === "undefined") return "en";
  const fromScript = (window as unknown as { __EREMINDER_LANG__?: Language }).__EREMINDER_LANG__;
  return fromScript === "hi" || fromScript === "en" ? fromScript : readStoredLanguage();
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const lang = initialLanguage();
    setActiveLanguage(lang);
    return lang;
  });

  useEffect(() => {
    setActiveLanguage(language);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", language);
    }
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      /* storage unavailable — keep it in memory only */
    }
    setActiveLanguage(next);
    setLanguageState(next);
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key: string, vars?: TranslateVars) => translate(key, vars, language),
    }),
    [language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (ctx) return ctx;
  // Safe fallback (e.g. rendered outside the provider): English source strings.
  return {
    language: "en",
    setLanguage: () => {},
    t: (key: string, vars?: TranslateVars) => translate(key, vars, "en"),
  };
}

/** Shorthand: const t = useT(); t("home.title") */
export function useT() {
  return useLanguage().t;
}
