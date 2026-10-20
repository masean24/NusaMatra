import { Surface } from '@/components/ui/Surface/Surface';
import { Reveal } from '@/features/motion';
import styles from './SourcesSection.module.css';

/**
 * Figma 41:406. These are *planned* sources: none is connected in this prototype, and the
 * status line says so on every card. Integration happens in the separate Data Hub.
 */
const PLANNED_SOURCES = [
  { name: 'BNPB · InaRISK', description: 'Indeks dan kelas risiko bencana per kabupaten/kota.' },
  { name: 'Badan Pusat Statistik', description: 'Kemiskinan, kependudukan, dan layanan dasar.' },
  { name: 'DJPK Kemenkeu', description: 'Anggaran dan realisasi APBD.' },
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
        {PLANNED_SOURCES.map((source, index) => (
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
                <p className={`kk-caption ${styles.status}`}>Direncanakan · belum terhubung di prototipe</p>
              </Surface>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}
