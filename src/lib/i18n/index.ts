/**
 * Interface language. The Indonesian text in the source is the key and the fallback, so a string
 * without a translation still reads correctly. Changing the language happens in place: the store
 * changes, `Localized` draws the page again without remounting it, and text that used to be computed
 * while a module loaded is built on demand through `localized`. The English text is loaded only for
 * those who choose it.
 */
export type Language = 'id' | 'en';

type Dictionary = Readonly<Record<string, string>>;

const STORAGE_KEY = 'nusa-matra:language';

function readStoredLanguage(): Language {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'id';
  } catch {
    return 'id';
  }
}

const loadEnglish = async (): Promise<Dictionary> => (await import('./en.json')).default;

let current: Language = readStoredLanguage();
let english: Dictionary | null = current === 'en' ? await loadEnglish() : null;
const listeners = new Set<() => void>();

export const language = (): Language => current;

/** For numbers and dates: British English keeps the day-month order and the 24-hour clock of WIB. */
export const locale = (): string => (current === 'en' ? 'en-GB' : 'id-ID');

/** The text in the current language, with `{0}`, `{1}`… filled in order. */
export function t(source: string, ...args: readonly unknown[]): string {
  const text = (current === 'en' ? english?.[source] : undefined) ?? source;
  if (args.length === 0) return text;
  return text.replace(/\{(\d+)\}/g, (placeholder, index: string) => {
    const position = Number(index);
    return position < args.length ? String(args[position]) : placeholder;
  });
}

/** A module-level value that holds text: built on first use, and again after the language changes. */
export function localized<T>(build: () => T): () => T {
  let builtFor: Language | null = null;
  let value: T;
  return () => {
    if (builtFor !== current) {
      value = build();
      builtFor = current;
    }
    return value;
  };
}

/**
 * For a memo whose value holds text, directly or through what it calls: naming the language here makes
 * it a real dependency of the memo.
 */
export const forLanguage = <T>(_language: Language, build: () => T): T => build();

/** Fetches what a language needs, so the change itself can be synchronous. False when it failed. */
export async function prepareLanguage(next: Language): Promise<boolean> {
  if (next === 'id' || english) return true;
  try {
    english = await loadEnglish();
    return true;
  } catch {
    return false;
  }
}

const DESCRIPTION_ID =
  'Nusa Matra membantu Anda menjelajahi kondisi kabupaten/kota di Indonesia, membandingkan indikator, dan menyusun prioritas yang dapat diperiksa.';
const DESCRIPTION_EN =
  'Nusa Matra helps you explore conditions across Indonesian regencies and cities, compare indicators and set priorities you can check.';

/** What lives outside React: the page's language and its description for sharing. */
export function applyLanguageToDocument(): void {
  document.documentElement.setAttribute('lang', current);
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute('content', current === 'en' ? DESCRIPTION_EN : DESCRIPTION_ID);
}

/** Switches a prepared language and tells the page; the choice is kept for the next visit. */
export function applyLanguage(next: Language): void {
  if (next === current || (next === 'en' && !english)) return;
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage blocked: the choice still holds for this page.
  }
  applyLanguageToDocument();
  for (const listener of listeners) listener();
}

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
