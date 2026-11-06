import { LANGUAGE, changeLanguage, t, type Language } from '@/lib/i18n';
import styles from './LanguageSwitch.module.css';

const OPTIONS: readonly { readonly value: Language; readonly label: string; readonly name: string }[] = [
  { value: 'id', label: 'IN', name: 'Bahasa Indonesia' },
  { value: 'en', label: 'EN', name: 'English' },
];

/** Chooses the interface language; each option is named in its own language, so it can always be found. */
export function LanguageSwitch() {
  return (
    <div className={styles.switch} role="group" aria-label={t('Bahasa')}>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={styles.option}
          lang={option.value}
          aria-label={option.name}
          aria-pressed={option.value === LANGUAGE}
          onClick={() => {
            changeLanguage(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
