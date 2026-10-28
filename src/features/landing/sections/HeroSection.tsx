import { ButtonLink } from '@/components/ui/Button/Button';
import { buttonClassName } from '@/components/ui/Button/buttonClassName';
import { HeroDioramaSlot } from '@/features/geo3d';
import { Reveal, useReducedMotion } from '@/features/motion';
import { RegionSearchForm } from '../components/RegionSearchForm';
import styles from './HeroSection.module.css';

/* G1: heading, lead, search, buttons rise 28px, ~90ms apart, 700ms on the "Tenang" curve. */
const G1_STAGGER_MS = 90;
const G1_DISTANCE = 28;
/* G2: the diorama rises 60px over 1.1s. */
const G2_DELAY_MS = 100;

/** Where "Mulai jelajahi" leads: straight into Jelajahi (the "Peta Utama" hub was retired). */
const EXPLORE_PATH = '/jelajahi';

/** The "Cara kerja" section (HowItWorksSection) that the secondary hero button leads to. */
const HOW_IT_WORKS_ID = 'cara-kerja';

/**
 * Glides to a section and rests it in the middle of the screen (a section taller than the screen
 * starts at the top instead, so its heading is not cut off). Focus moves with it, as an anchor
 * jump would; the URL hash is kept for sharing. Reduced motion jumps without the glide.
 */
function scrollToCentre(section: HTMLElement, reducedMotion: boolean) {
  // The space a section can rest in is the screen under the floating navbar's band.
  const navBand = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  const fits = section.offsetHeight <= window.innerHeight - navBand;
  section.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: fits ? 'center' : 'start' });
  section.focus({ preventScroll: true });
  window.history.replaceState(window.history.state, '', `#${section.id}`);
}

export function HeroSection() {
  const reducedMotion = useReducedMotion();

  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.copy}>
        <Reveal trigger="load" distance={G1_DISTANCE}>
          <h1 id="hero-title" className={`kk-display ${styles.title}`}>
            Memahami wilayah, menentukan arah.
          </h1>
        </Reveal>
        <Reveal trigger="load" distance={G1_DISTANCE} delay={G1_STAGGER_MS}>
          <p className={`kk-lead ${styles.lead}`}>
            Jelajahi kondisi kabupaten/kota di Indonesia, bandingkan indikator pembangunan, dan susun
            prioritas yang dapat diperiksa. Hasilnya bergantung pada indikator, bobot, data yang tersedia, dan
            metode yang dipakai.
          </p>
        </Reveal>
        <Reveal trigger="load" distance={G1_DISTANCE} delay={G1_STAGGER_MS * 2} className={styles.search}>
          <RegionSearchForm placeholder="Ketik nama kabupaten/kota Anda" landmarkLabel="Cari wilayah" />
        </Reveal>
        <Reveal trigger="load" distance={G1_DISTANCE} delay={G1_STAGGER_MS * 3} className={styles.actions}>
          <ButtonLink to={EXPLORE_PATH}>Mulai jelajahi</ButtonLink>
          <a
            href={`#${HOW_IT_WORKS_ID}`}
            className={buttonClassName('secondary')}
            onClick={(event) => {
              const section = document.getElementById(HOW_IT_WORKS_ID);
              if (!section) return;
              event.preventDefault();
              scrollToCentre(section, reducedMotion);
            }}
          >
            Lihat cara kerjanya
          </a>
        </Reveal>
        <Reveal trigger="load" distance={G1_DISTANCE} delay={G1_STAGGER_MS * 4}>
          <p className={`kk-small ${styles.note}`}>
            Gratis dan tanpa daftar. Setiap angka menyebutkan sumber dan tahunnya.
          </p>
        </Reveal>
      </div>

      <div className={styles.visual} data-hero-visual>
        <div className={styles.stage}>
          <Reveal
            trigger="load"
            distance={60}
            duration={1100}
            delay={G2_DELAY_MS}
            className={styles.dioramaReveal}
          >
            {/* Hexagon map (default engine); its still poster is the fallback. */}
            <HeroDioramaSlot
              scene="hero"
              description="Peta hexagon Indonesia (ilustrasi dekoratif): setiap sel hexagon mewakili sebagian daratan, diwarnai dari putih ke oranye tua."
            />
          </Reveal>
        </div>
        <p className={`kk-caption ${styles.caption}`}>Ilustrasi, bukan peta geografis akurat.</p>
      </div>
    </section>
  );
}
