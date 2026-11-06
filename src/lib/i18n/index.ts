/**
 * Interface language. The Indonesian text in the source is the key and the fallback, so a string
 * without a translation still reads correctly. The language is fixed for the life of the page and
 * changing it reloads, which keeps text computed anywhere (modules, memos, the 3D map) consistent
 * without threading it through every function. The English text is loaded only for those who chose it.
 */
export type Language = 'id' | 'en';

const STORAGE_KEY = 'nusa-matra:language';
const SKIP_INTRO_KEY = 'nusa-matra:skip-intro';

function readStoredLanguage(): Language {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'id';
  } catch {
    return 'id';
  }
}

export const LANGUAGE: Language = readStoredLanguage();

/** For numbers and dates: British English keeps the day-month order and the 24-hour clock of WIB. */
export const LOCALE = LANGUAGE === 'en' ? 'en-GB' : 'id-ID';

const dictionary: Readonly<Record<string, string>> | null =
  LANGUAGE === 'en' ? (await import('./en.json')).default : null;

/** The text in the page's language, with `{0}`, `{1}`… filled in order. */
export function t(source: string, ...args: readonly unknown[]): string {
  const text = dictionary?.[source] ?? source;
  if (args.length === 0) return text;
  return text.replace(/\{(\d+)\}/g, (placeholder, index: string) => {
    const position = Number(index);
    return position < args.length ? String(args[position]) : placeholder;
  });
}

/** Saves the choice and reloads into it; the opening animation is not played a second time. */
export function changeLanguage(next: Language): void {
  if (next === LANGUAGE) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
    window.sessionStorage.setItem(SKIP_INTRO_KEY, '1');
  } catch {
    // Storage blocked: the choice cannot outlive this page, so there is nothing to reload into.
    return;
  }
  window.location.reload();
}

/** True once, right after a language change. */
export function consumeSkipIntro(): boolean {
  try {
    if (window.sessionStorage.getItem(SKIP_INTRO_KEY) === null) return false;
    window.sessionStorage.removeItem(SKIP_INTRO_KEY);
    return true;
  } catch {
    return false;
  }
}
