import { useState } from 'react';
import { runThemeTransition } from '@/features/theme';
import { applyLanguage, prepareLanguage, t, type Language } from '@/lib/i18n';
import { useLanguage } from '@/lib/i18n/useLanguage';
import styles from './LanguageSwitch.module.css';

/**
 * Switches the interface language, built like the display mode switch beside it: one control,
 * pressed anywhere, with a knob that slides to the language now in use. Each label is written in
 * its own language. The text changes in place under a short crossfade, with nothing reloaded.
 */
export function LanguageSwitch() {
  const current = useLanguage();
  const [failed, setFailed] = useState(false);
  // The knob moves on the press; the text follows once the English dictionary has loaded.
  const [target, setTarget] = useState<Language | null>(null);
  const [squishing, setSquishing] = useState(false);
  const shown = target ?? current;

  const toggle = async () => {
    if (target) return;
    const next: Language = current === 'id' ? 'en' : 'id';
    setTarget(next);
    setSquishing(true);
    try {
      const ready = await prepareLanguage(next);
      setFailed(!ready);
      if (ready) {
        await runThemeTransition({
          apply: () => {
            applyLanguage(next);
          },
          originX: 0,
          originY: 0,
          reducedMotion: true,
        });
      }
    } finally {
      // Whatever happened, the knob returns to the language actually in use.
      setTarget(null);
    }
  };

  return (
    <>
      <button
        type="button"
        role="switch"
        lang="en"
        aria-label="English"
        aria-checked={current === 'en'}
        aria-busy={target ? true : undefined}
        className={styles.switch}
        data-selected={shown}
        onClick={() => {
          void toggle();
        }}
      >
        <span
          className={styles.knob}
          data-squish={squishing ? shown : undefined}
          onAnimationEnd={() => {
            setSquishing(false);
          }}
          aria-hidden="true"
        />
        <span className={styles.segment} data-segment="id" lang="id" aria-hidden="true">
          IN
        </span>
        <span className={styles.segment} data-segment="en" aria-hidden="true">
          EN
        </span>
      </button>
      {failed && (
        <span role="status" className="visually-hidden">
          {t('Bahasa Inggris tidak dapat dimuat. Periksa koneksi, lalu coba lagi.')}
        </span>
      )}
    </>
  );
}
