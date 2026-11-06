import { useEffect, useState } from 'react';
import { useReducedMotion } from '@/features/motion';
import styles from './Methodology.module.css';
import { localized, t } from '@/lib/i18n';

/** The page's sections in reading order; each id is a section on the page. */
const TOC_ENTRIES = localized(
  () =>
    [
      { id: 'ringkasan', kicker: null, label: t('Ringkasan tiga langkah') },
      { id: 'langkah-1', kicker: t('Langkah 1'), label: t('Nilai asli') },
      { id: 'langkah-2', kicker: t('Langkah 2'), label: t('Skala kebutuhan 0–100') },
      { id: 'hasil', kicker: t('Hasil'), label: t('Peringkat dan persentil') },
      { id: 'langkah-3', kicker: t('Langkah 3'), label: t('Skor gabungan') },
      { id: 'catatan', kicker: t('Catatan'), label: t('Kalau data tidak lengkap') },
      { id: 'penutup', kicker: t('Penutup'), label: t('Yang perlu diingat') },
    ] as const,
);

type SectionId = ReturnType<typeof TOC_ENTRIES>[number]['id'];

/*
 * A section counts as being read once its top passes a line about a third down the screen, so the
 * highlight changes where the reader's eyes are, not when a heading first peeks in at the bottom.
 */
const READING_LINE_MARGIN = '-30% 0px -65% 0px';

/** The section being read, followed with an IntersectionObserver as the page scrolls. */
function useActiveSection(): SectionId {
  const [active, setActive] = useState<SectionId>(TOC_ENTRIES()[0].id);
  useEffect(() => {
    const sections = TOC_ENTRIES()
      .map((entry) => document.getElementById(entry.id))
      .filter((element): element is HTMLElement => element !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        const crossing = entries.filter((entry) => entry.isIntersecting);
        const last = crossing.at(-1);
        if (last) setActive(last.target.id as SectionId);
      },
      { rootMargin: READING_LINE_MARGIN },
    );
    for (const section of sections) observer.observe(section);
    return () => {
      observer.disconnect();
    };
  }, []);
  return active;
}

/**
 * "Di halaman ini": the page's sections, the one being read highlighted. A sticky column on wide
 * screens, a row of chips that scrolls sideways on narrow ones.
 */
export function MethodToc() {
  const active = useActiveSection();
  const reducedMotion = useReducedMotion();
  return (
    <nav className={styles.toc} aria-labelledby="metode-toc">
      <p id="metode-toc" className={styles.tocTitle}>
        {t('Di halaman ini')}
      </p>
      <ol role="list" className={styles.tocList}>
        {TOC_ENTRIES().map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              className={styles.tocLink}
              aria-current={active === entry.id ? 'location' : undefined}
              onClick={(event) => {
                const target = document.getElementById(entry.id);
                if (!target) return;
                event.preventDefault();
                target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
                window.history.replaceState(window.history.state, '', `#${entry.id}`);
              }}
            >
              {entry.kicker && <span className={styles.tocKicker}>{entry.kicker}</span>}
              <span>{entry.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
