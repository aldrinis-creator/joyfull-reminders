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

export function LanguageProvider({
  children,
  initialLanguage = "en",
}: {
  children: ReactNode;
  initialLanguage?: Language;
}) {
  const [language, setLanguageState] = useState<Language>(() => {
    setActiveLanguage(initialLanguage);
    return initialLanguage;
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
      // Mirrored into a cookie so server-rendered HTML starts in the right language.
      document.cookie = `${LANGUAGE_STORAGE_KEY}=${next}; path=/; max-age=31536000; samesite=lax`;
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
