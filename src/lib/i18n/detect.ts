import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { LANGUAGE_STORAGE_KEY, isLanguage, readStoredLanguage, type Language } from "./types";

/**
 * Resolves the language the very first render should use.
 * On the server we read the language cookie (kept in sync with localStorage)
 * so the SSR HTML already matches what the browser will render.
 */
export const detectLanguage = createIsomorphicFn()
  .server((): Language => {
    const raw = getCookie(LANGUAGE_STORAGE_KEY);
    return isLanguage(raw) ? raw : "en";
  })
  .client((): Language => {
    const fromScript = (window as unknown as { __EREMINDER_LANG__?: string }).__EREMINDER_LANG__;
    return isLanguage(fromScript) ? fromScript : readStoredLanguage();
  });
