import { useLayoutEffect, useRef, useState } from 'react';
import bigLogo from '@/assets/sources/big.webp';
import bmkgLogo from '@/assets/sources/bmkg.webp';
import bnpbLogo from '@/assets/sources/bnpb.webp';
import bpsLogo from '@/assets/sources/bps.webp';
import kemendikdasmenLogo from '@/assets/sources/kemendikdasmen.webp';
import kemenkesLogo from '@/assets/sources/kemenkes.webp';
import { Surface } from '@/components/ui/Surface/Surface';
import { Reveal } from '@/features/motion';
import styles from './SourcesSection.module.css';
import { localized, t } from '@/lib/i18n';

/**
 * Figma 41:406. The agencies whose data the Data Hub ingests, from its LIVE dataset list
 * (`GET /api/v1/datasets`, read 2026-11-10: 24 datasets from BPS, BNPB, Kemenkes, Kemendikdasmen,
 * BIG and BMKG, plus the hub's own ingestion audit). Each line names what is actually used. Logos
 * are the agencies' public-domain marks from Wikimedia Commons, shown only to identify the source.
 */
const SOURCES = localized(
  () =>
    [
      {
        name: t('Badan Pusat Statistik'),
        short: 'BPS',
        logo: bpsLogo,
        description: t('IPM, kemiskinan, kependudukan, air minum, sanitasi, dan akses internet.'),
      },
      {
        name: t('Badan Nasional Penanggulangan Bencana'),
        short: 'BNPB',
        logo: bnpbLogo,
        description: t('Indeks risiko bencana (IRBI) dan catatan kejadian bencana (DIBI).'),
      },
      {
        name: t('Kementerian Kesehatan'),
        short: 'Kemenkes',
        logo: kemenkesLogo,
        description: t('Status gizi balita (SSGI, SKI), dokter, rumah sakit, dan puskesmas.'),
      },
      {
        name: t('Kementerian Pendidikan Dasar dan Menengah'),
        short: 'Kemendikdasmen',
        logo: kemendikdasmenLogo,
        description: t('Partisipasi sekolah, kondisi ruang kelas, dan rasio murid dan guru.'),
      },
      {
        name: t('Badan Informasi Geospasial'),
        short: 'BIG',
        logo: bigLogo,
        description: t('Batas wilayah administrasi kabupaten/kota.'),
      },
      {
        name: t('Badan Meteorologi, Klimatologi, dan Geofisika'),
        short: 'BMKG',
        logo: bmkgLogo,
        description: t('Gempa bumi terkini dan yang dirasakan.'),
      },
    ] as const,
);

type Source = ReturnType<typeof SOURCES>[number];

function SourceCard({ source, hidden = false }: { readonly source: Source; readonly hidden?: boolean }) {
  return (
    <Surface as="article" radius="source" className={styles.card} aria-hidden={hidden || undefined}>
      <span className={styles.head}>
        {/* Not lazy: in the gliding row a lazy logo would pop in as its card comes round again. */}
        <img className={styles.logo} src={source.logo} alt="" width={40} height={40} decoding="async" />
        <span className={styles.names}>
          <span className={`kk-body-strong ${styles.short}`}>{source.short}</span>
          <h3 className={`kk-caption ${styles.name}`}>{source.name}</h3>
        </span>
      </span>
      <p className={`kk-small ${styles.description}`}>{source.description}</p>
      <p className={`kk-caption ${styles.status}`}>{t('Terhubung lewat Data Hub')}</p>
    </Surface>
  );
}

/**
 * One row of source cards. When the row is wider than the column, it glides right to left on a loop
 * (a second, hidden copy follows the first so the loop has no seam) and pauses under the pointer or
 * keyboard focus. With reduced motion it does not move; the row scrolls sideways by hand instead.
 */
export function SourcesSection() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLUListElement>(null);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const row = rowRef.current;
    if (!viewport || !row || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      setOverflows(row.scrollWidth > viewport.clientWidth + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(row);
    return () => {
      observer.disconnect();
    };
  }, []);

  const sources = SOURCES();

  return (
    <section id="sumber" className={styles.section} aria-labelledby="sumber-title">
      <Reveal distance={24} duration={600}>
        <h2 id="sumber-title" className="kk-h1">
          {t('Sumber dan metodologi')}
        </h2>
      </Reveal>
      <Reveal distance={24} duration={600} delay={100}>
        <div
          ref={viewportRef}
          className={styles.viewport}
          data-marquee={overflows || undefined}
          role="region"
          aria-label={t('Lembaga sumber data')}
          // A row wider than the screen scrolls by hand with reduced motion, so the keyboard must
          // reach it (WCAG 2.1.1); focus is also what holds the glide still for reading.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region
          tabIndex={overflows ? 0 : undefined}
        >
          <div className={styles.track}>
            <ul ref={rowRef} role="list" className={styles.row}>
              {sources.map((source) => (
                <li key={source.short} className={styles.cell}>
                  <SourceCard source={source} />
                </li>
              ))}
            </ul>
            {overflows && (
              <ul role="list" className={styles.row} aria-hidden="true">
                {sources.map((source) => (
                  <li key={source.short} className={styles.cell}>
                    <SourceCard source={source} hidden />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Reveal>
      <p className={`kk-small ${styles.note}`}>
        {t(
          'Belum semua indikator punya data. Ketersediaan dan tahun tiap indikator ditampilkan di Jelajahi dan Lab Prioritas.',
        )}
      </p>
    </section>
  );
}
