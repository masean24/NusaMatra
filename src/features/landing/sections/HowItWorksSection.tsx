import { Link } from 'react-router';
import { surfaceClassName } from '@/components/ui/Surface/surfaceClassName';
import { Reveal } from '@/features/motion';
import { useStaggeredNavigate } from '@/features/navigation';
import { SceneZone } from '../scene3d/SceneZone';
import styles from './HowItWorksSection.module.css';

/** Figma 41:198 "Cara kerja": five steps, each linking to the feature that does it. */
const STEPS = [
  { title: 'Jelajahi', description: 'Pilih wilayah di peta atau ketik namanya.', to: '/jelajahi' },
  {
    title: 'Bandingkan',
    description: 'Sandingkan dua wilayah; perbedaan ditulis dengan kata.',
    to: '/bandingkan',
  },
  { title: 'Putuskan', description: 'Atur bobot kriteria dan lihat urutan bergeser.', to: '/lab-prioritas' },
  { title: 'Uji', description: 'Ganti asumsi dan cek apakah hasilnya stabil.', to: '/uji-rekomendasi' },
  {
    title: 'Verifikasi',
    description: 'Simpan Paspor Bukti: sumber, tahun, asumsi, batasan.',
    to: '/paspor-bukti',
  },
] as const;

/* G3: heading rises 24px (600ms); steps follow one by one, 80ms apart, shifting 16px from the left. */
const G3_STEP_STAGGER_MS = 80;

interface StepLinkProps {
  readonly step: (typeof STEPS)[number];
  readonly number: number;
}

/** A step card: the landing page staggers out (this card last) and the feature page staggers in. */
function StepLink({ step, number }: StepLinkProps) {
  const leaveTo = useStaggeredNavigate();

  return (
    <Link
      to={step.to}
      className={surfaceClassName('step', styles.step)}
      onClick={(event) => {
        leaveTo(event, step.to);
      }}
    >
      <span className={`kk-number ${styles.badge}`} data-first={number === 1 || undefined} aria-hidden="true">
        {number}
      </span>
      <span className={styles.stepText}>
        <span className={`kk-h3 ${styles.stepTitle}`}>
          <span className="visually-hidden">Langkah {number}: </span>
          {step.title}
        </span>
        <span className={`kk-small ${styles.stepDescription}`}>{step.description}</span>
      </span>
    </Link>
  );
}

export function HowItWorksSection() {
  return (
    <section id="cara-kerja" className={styles.section} aria-labelledby="cara-kerja-title">
      <div className={styles.copy}>
        <Reveal distance={24} duration={600}>
          <h2 id="cara-kerja-title" className={`kk-h1 ${styles.title}`}>
            Dari pertanyaan sederhana ke keputusan yang bisa diperiksa
          </h2>
        </Reveal>
        <ol role="list" className={styles.steps}>
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <Reveal distance={0} fromX={-16} duration={600} delay={120 + index * G3_STEP_STAGGER_MS}>
                <StepLink step={step} number={index + 1} />
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
      <SceneZone
        kind="layeredIsland"
        className={styles.visual}
        description="Ilustrasi pulau berlapis data: satu pulau terangkat lalu terbuka menjadi tiga lapisan, yaitu risiko, sosial, dan layanan, mengikuti posisi gulir."
      />
    </section>
  );
}
