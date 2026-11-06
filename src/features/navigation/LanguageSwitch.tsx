import { useState } from 'react';
import { runThemeTransition } from '@/features/theme';
import { applyLanguage, prepareLanguage, t, type Language } from '@/lib/i18n';
import { useLanguage } from '@/lib/i18n/useLanguage';
import styles from './LanguageSwitch.module.css';

const OPTIONS: readonly { readonly value: Language; readonly label: string; readonly name: string }[] = [
  { value: 'id', label: 'IN', name: 'Bahasa Indonesia' },
  { value: 'en', label: 'EN', name: 'English' },
];

/**
 * Chooses the interface language; each option is named in its own language, so it can always be
 * found. The text changes in place under a short crossfade, with nothing reloaded.
 */
export function LanguageSwitch() {
  const current = useLanguage();
  const [failed, setFailed] = useState(false);

  const choose = async (next: Language) => {
    if (next === current) return;
    const ready = await prepareLanguage(next);
    setFailed(!ready);
    if (!ready) return;
    await runThemeTransition({
      apply: () => {
        applyLanguage(next);
      },
      originX: 0,
      originY: 0,
      reducedMotion: true,
    });
  };

  return (
    <div className={styles.switch} role="group" aria-label={t('Bahasa')}>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={styles.option}
          lang={option.value}
          aria-label={option.name}
          aria-pressed={option.value === current}
          onClick={() => {
            void choose(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
      {failed && (
        <span role="status" className="visually-hidden">
          {t('Bahasa Inggris tidak dapat dimuat. Periksa koneksi, lalu coba lagi.')}
        </span>
      )}
    </div>
  );
}
