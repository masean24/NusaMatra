import { applyLanguage, language, locale, localized, prepareLanguage, t } from './index';
import english from './en.json';

const dictionary: Readonly<Record<string, string>> = english;
const placeholders = (text: string) => [...new Set(text.match(/\{\d+\}/g) ?? [])].sort();

/** Every literal text passed to t() anywhere in the application. */
function sourceKeys(): Set<string> {
  const files = import.meta.glob<string>(
    ['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}', '!/src/**/__fixtures__/**', '!/src/lib/i18n/**'],
    { query: '?raw', import: 'default', eager: true },
  );
  const call = /(?<![\w.])(?:t|tr)\(\s*'((?:\\.|[^'\\])*)'/g;
  const keys = new Set<string>();
  for (const source of Object.values(files)) {
    for (const match of source.matchAll(call)) keys.add((match[1] ?? '').replace(/\\(.)/g, '$1'));
  }
  return keys;
}

/** Texts that read the same in both languages: names of people. */
const UNCHANGED = new Set(['Mgs. M. Fahim Rahmatullah', 'Khalil Amin Adillah', 'Raihan Daris Ramadhan']);

describe('t', () => {
  it('returns the Indonesian source by default and fills placeholders in order', () => {
    expect(t('{0} dari {1} wilayah', 3, 'lima')).toBe('3 dari lima wilayah');
  });

  it('keeps a placeholder that has no argument, rather than printing "undefined"', () => {
    expect(t('{0} dan {1}', 'A')).toBe('A dan {1}');
  });
});

describe('changing the language in place', () => {
  afterEach(() => {
    applyLanguage('id');
    window.localStorage.clear();
  });

  it('changes text, locale and the document, and keeps the choice', async () => {
    expect(await prepareLanguage('en')).toBe(true);
    applyLanguage('en');
    expect(language()).toBe('en');
    expect(locale()).toBe('en-GB');
    expect(t('Kembali')).toBe('Back');
    expect(document.documentElement.getAttribute('lang')).toBe('en');
    expect(window.localStorage.getItem('nusa-matra:language')).toBe('en');
  });

  it('builds a localized value once per language', async () => {
    let builds = 0;
    const label = localized(() => {
      builds += 1;
      return t('Kembali');
    });
    expect([label(), label()]).toEqual(['Kembali', 'Kembali']);
    expect(builds).toBe(1);
    await prepareLanguage('en');
    applyLanguage('en');
    expect(label()).toBe('Back');
    expect(builds).toBe(2);
  });
});

describe('English dictionary', () => {
  it('has a translation for every text in the application', () => {
    const keys = sourceKeys();
    expect(keys.size).toBeGreaterThan(1000);
    const missing = [...keys].filter((key) => !(key in dictionary) && !UNCHANGED.has(key));
    expect(missing).toEqual([]);
  });

  it('keeps every placeholder of each text', () => {
    const broken = Object.entries(dictionary).filter(
      ([key, text]) => placeholders(key).join() !== placeholders(text).join(),
    );
    expect(broken).toEqual([]);
  });

  it('keeps the spaces that join a text to its neighbour', () => {
    const broken = Object.entries(dictionary).filter(
      ([key, text]) =>
        key.startsWith(' ') !== text.startsWith(' ') || key.endsWith(' ') !== text.endsWith(' '),
    );
    expect(broken).toEqual([]);
  });
});
