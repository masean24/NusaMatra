import { Surface } from '@/components/ui/Surface/Surface';
import { Reveal } from '@/features/motion';
import styles from './SourcesSection.module.css';

/**
 * Figma 41:406. Status as served by the LIVE Data Hub v2.2 dataset list (captured 2026-10-24,
 * src/services/api/__fixtures__/live-v2.2/datasets.json): BNPB (IRBI, DIBI) and BPS (SDGs,
 * Susenas) are ingested; DJPK is not. Static copy, so it names the mode and points to the
 * per-page snapshot instead of claiming freshness or completeness.
 */
const SOURCES = [
  {
    name: 'BNPB · InaRISK',
    description: 'Indeks dan kelas risiko bencana per kabupaten/kota.',
    status: 'Terhubung lewat Data Hub (mode LIVE)',
  },
  {
    name: 'Badan Pusat Statistik',
    description: 'Kemiskinan, kependudukan, dan layanan dasar.',
    status: 'Terhubung lewat Data Hub (mode LIVE)',
  },
  {
    name: 'DJPK Kemenkeu',
    description: 'Anggaran dan realisasi APBD.',
    status: 'Direncanakan · belum terhubung',
  },
] as const;

/* G10: three source cards rise one after another, 90ms apart. */
const G10_STAGGER_MS = 90;

export function SourcesSection() {
  return (
    <section id="sumber" className={styles.section} aria-labelledby="sumber-title">
      <Reveal distance={24} duration={600}>
        <h2 id="sumber-title" className="kk-h1">
          Sumber dan metodologi
        </h2>
      </Reveal>
      <ul role="list" className={styles.cards}>
        {SOURCES.map((source, index) => (
          <li key={source.name} className={styles.cell}>
            <Reveal
              distance={24}
              duration={600}
              delay={100 + index * G10_STAGGER_MS}
              className={styles.reveal}
            >
              <Surface as="article" radius="source" className={styles.card}>
                <h3 className="kk-h3">{source.name}</h3>
                <p className={`kk-small ${styles.description}`}>{source.description}</p>
                <p className={`kk-caption ${styles.status}`}>{source.status}</p>
              </Surface>
            </Reveal>
          </li>
        ))}
      </ul>
      <p className={`kk-small ${styles.note}`}>
        Belum semua indikator punya data. Ketersediaan tiap indikator, tahunnya, dan snapshot data yang
        dipakai ditampilkan di Jelajahi dan Lab Prioritas.
      </p>
    </section>
  );
}
