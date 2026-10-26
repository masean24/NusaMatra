import { useState } from 'react';
import { Link } from 'react-router';
import { surfaceClassName } from '@/components/ui/Surface/surfaceClassName';
import { Reveal, useMediaQuery } from '@/features/motion';
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

/** The three layers of the 3D object, bottom to top; the same meaning as its form (data → analysis → decision). */
const LAYER_LEGEND = [
  { key: 'data', label: 'Data & Sumber' },
  { key: 'analisis', label: 'Analisis & Simulasi' },
  { key: 'keputusan', label: 'Keputusan & Bukti' },
] as const;

/* G3: heading rises 24px (600ms); steps follow one by one, 80ms apart, shifting 16px from the left. */
const G3_STEP_STAGGER_MS = 80;

/** Devices without hover (phones, tablets): the first tap opens a card, the second opens its page. */
const NO_HOVER_QUERY = '(hover: none)';

interface StepLinkProps {
  readonly step: (typeof STEPS)[number];
  readonly number: number;
  /** Touch mode only: this card is the open one. */
  readonly open: boolean;
  readonly touch: boolean;
  readonly onOpen: () => void;
}

/**
 * A step card. By default it shows only its number and title; the explanation slides open on hover
 * or keyboard focus, or on the first tap on a touch device. The description always stays in the
 * document (only its height collapses), so screen readers read the whole card and the link name is
 * unchanged. The landing page staggers out (this card last) and the feature page staggers in.
 */
function StepLink({ step, number, open, touch, onOpen }: StepLinkProps) {
  const leaveTo = useStaggeredNavigate();

  return (
    <Link
      to={step.to}
      className={surfaceClassName('step', styles.step)}
      data-open={open || undefined}
      onClick={(event) => {
        if (touch && !open) {
          // First tap on a touch screen: show the explanation instead of leaving the page.
          event.preventDefault();
          onOpen();
          return;
        }
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
        <span className={styles.reveal}>
          <span className={`kk-small ${styles.stepDescription}`}>{step.description}</span>
        </span>
      </span>
    </Link>
  );
}

export function HowItWorksSection() {
  const touch = useMediaQuery(NO_HOVER_QUERY);
  // One open card at a time (touch). Opening another closes the previous one.
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    // tabIndex -1: the hero's "Lihat cara kerjanya" moves focus here along with the scroll.
    <section id="cara-kerja" tabIndex={-1} className={styles.section} aria-labelledby="cara-kerja-title">
      <div className={styles.copy}>
        <Reveal distance={24} duration={600}>
          <h2 id="cara-kerja-title" className={`kk-h1 ${styles.title}`}>
            Dari pertanyaan sederhana ke keputusan yang bisa diperiksa
          </h2>
        </Reveal>
        <ol role="list" className={styles.steps}>
          {STEPS.map((step, index) => (
            <li key={step.title} className={styles.item}>
              <Reveal distance={0} fromX={-16} duration={600} delay={120 + index * G3_STEP_STAGGER_MS}>
                <StepLink
                  step={step}
                  number={index + 1}
                  touch={touch}
                  open={touch && openIndex === index}
                  onOpen={() => {
                    setOpenIndex(index);
                  }}
                />
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
      <div className={styles.visualColumn}>
        <SceneZone
          kind="layeredIsland"
          className={styles.scene}
          description="Objek tiga lapis yang terbuka mengikuti gulir: lapisan bawah Data & Sumber (titik-titik sumber), tengah Analisis & Simulasi (batang simulasi), atas Keputusan & Bukti (stempel bukti), dihubungkan tiang-tiang tipis."
        />
        <ol className={styles.legend} aria-label="Tiga lapisan, dari bawah ke atas">
          {LAYER_LEGEND.map((layer) => (
            <li key={layer.key} className="kk-caption" data-layer={layer.key}>
              {layer.label}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
