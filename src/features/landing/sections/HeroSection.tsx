import { Fragment, type CSSProperties } from 'react';
import { ButtonLink } from '@/components/ui/Button/Button';
import { buttonClassName } from '@/components/ui/Button/buttonClassName';
import { HeroDioramaSlot } from '@/features/geo3d';
import { Reveal, STAGGER_ITEM_PROPS, useReducedMotion } from '@/features/motion';
import { RegionSearchForm } from '../components/RegionSearchForm';
import styles from './HeroSection.module.css';
import { t } from '@/lib/i18n';

/* The title rises word by word out of its mask; lead, search, buttons and note fade up after it. */
const HERO_TITLE_WORDS = t('Memahami wilayah, menentukan arah.').split(' ');
const G1_STAGGER_MS = 90;
const G1_DISTANCE = 28;
const G1_AFTER_TITLE_MS = 240;
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
  // The space a section can rest in is the screen under the floating navbar's band, so it is centred
  // in that space (not in the whole screen, which would slide its top under the navbar).
  const navBand = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  const room = window.innerHeight - navBand;
  const spare = Math.max(0, room - section.offsetHeight) / 2;
  const top = section.getBoundingClientRect().top + window.scrollY - navBand - spare;
  window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion ? 'auto' : 'smooth' });
  section.focus({ preventScroll: true });
  window.history.replaceState(window.history.state, '', `#${section.id}`);
}

export function HeroSection() {
  const reducedMotion = useReducedMotion();

  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.copy}>
        <h1 id="hero-title" className={`kk-display ${styles.title}`} {...STAGGER_ITEM_PROPS}>
          {HERO_TITLE_WORDS.map((word, index) => (
            <Fragment key={word}>
              {index > 0 && ' '}
              <span className={styles.titleMask}>
                <span className={styles.titleWord} style={{ '--title-word': index } as CSSProperties}>
                  {word}
                </span>
              </span>
            </Fragment>
          ))}
        </h1>
        <Reveal trigger="load" distance={G1_DISTANCE} delay={G1_AFTER_TITLE_MS} introStep={0.22}>
          <p className={`kk-lead ${styles.lead}`}>
            {t(
              'Jelajahi kondisi kabupaten/kota di Indonesia, bandingkan indikator pembangunan, dan susun prioritas yang dapat diperiksa. Hasilnya bergantung pada indikator, bobot, data yang tersedia, dan metode yang dipakai.',
            )}
          </p>
        </Reveal>
        <Reveal
          trigger="load"
          distance={G1_DISTANCE}
          delay={G1_AFTER_TITLE_MS + G1_STAGGER_MS}
          introStep={0.32}
          className={styles.search}
        >
          <RegionSearchForm
            placeholder={t('Ketik nama kabupaten/kota Anda')}
            landmarkLabel={t('Cari wilayah')}
          />
        </Reveal>
        <Reveal
          trigger="load"
          distance={G1_DISTANCE}
          delay={G1_AFTER_TITLE_MS + G1_STAGGER_MS * 2}
          introStep={0.4}
          className={styles.actions}
        >
          <ButtonLink to={EXPLORE_PATH}>{t('Mulai jelajahi')}</ButtonLink>
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
            {t('Lihat cara kerjanya')}
          </a>
        </Reveal>
        <Reveal
          trigger="load"
          distance={G1_DISTANCE}
          delay={G1_AFTER_TITLE_MS + G1_STAGGER_MS * 3}
          introStep={0.4}
        >
          <p className={`kk-small ${styles.note}`}>
            {t('Gratis dan tanpa daftar. Setiap angka menyebutkan sumber dan tahunnya.')}
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
            introStep={0.1}
            className={styles.dioramaReveal}
          >
            {/* Hexagon map (default engine); its still poster is the fallback. */}
            <HeroDioramaSlot
              scene="hero"
              description={t(
                'Peta hexagon Indonesia (ilustrasi dekoratif): setiap sel hexagon mewakili sebagian daratan, diwarnai dari putih ke oranye tua.',
              )}
            />
          </Reveal>
        </div>
        <p className={`kk-caption ${styles.caption}`}>{t('Ilustrasi, bukan peta geografis akurat.')}</p>
      </div>
    </section>
  );
}
