import { ButtonLink } from '@/components/ui/Button/Button';
import { buttonClassName } from '@/components/ui/Button/buttonClassName';
import { DEMO_HERO_CARDS } from '@/data/fixtures/landingDemo';
import { HeroDioramaSlot } from '@/features/geo3d';
import { Reveal } from '@/features/motion';
import { FloatingCard } from '../components/FloatingCard';
import { RegionSearchForm } from '../components/RegionSearchForm';
import styles from './HeroSection.module.css';

/* G1: heading, lead, search, buttons rise 28px, ~90ms apart, 700ms on the "Tenang" curve. */
const G1_STAGGER_MS = 90;
const G1_DISTANCE = 28;
/* G2: the diorama rises 60px over 1.1s; the floating cards follow it. */
const G2_DELAY_MS = 100;
const CARD_DELAYS_MS = [900, 1020, 1140] as const;

/** Where "Mulai jelajahi" leads (3D-1 note: the CTA opens the map). */
const EXPLORE_PATH = '/peta';

export function HeroSection() {
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
            Jelajahi kondisi kabupaten/kota di Indonesia, bandingkan indikator pembangunan, dan tentukan
            prioritas secara objektif dan terukur, lengkap dengan bukti di balik setiap angka.
          </p>
        </Reveal>
        <Reveal trigger="load" distance={G1_DISTANCE} delay={G1_STAGGER_MS * 2} className={styles.search}>
          <RegionSearchForm placeholder="Ketik nama kabupaten/kota Anda" />
        </Reveal>
        <Reveal trigger="load" distance={G1_DISTANCE} delay={G1_STAGGER_MS * 3} className={styles.actions}>
          <ButtonLink to={EXPLORE_PATH}>Mulai jelajahi</ButtonLink>
          <a href="#cara-kerja" className={buttonClassName('secondary')}>
            Lihat cara kerjanya
          </a>
        </Reveal>
        <Reveal trigger="load" distance={G1_DISTANCE} delay={G1_STAGGER_MS * 4}>
          <p className={`kk-small ${styles.note}`}>
            Gratis dan tanpa daftar. Setiap angka menyebutkan sumber dan tahunnya.
          </p>
        </Reveal>
      </div>

      <div className={styles.visual}>
        <Reveal
          trigger="load"
          distance={60}
          duration={1100}
          delay={G2_DELAY_MS}
          className={styles.dioramaReveal}
        >
          {/* External 3D engine (`HeroDiorama`); the Figma illustration shows until it is ready. */}
          <HeroDioramaSlot
            scene="hero"
            description="Ilustrasi Diorama Nusantara: lempeng laut kobalt dengan lima pulau kapur bertingkat dan tiga kolom penanda oranye."
          />
        </Reveal>
        <ul role="list" className={styles.cards} aria-label="Contoh kartu wilayah (data simulasi)">
          {DEMO_HERO_CARDS.map((card, index) => (
            <li key={card.id} className={styles.cardSlot} data-card={card.id}>
              <Reveal trigger="load" distance={18} duration={600} delay={CARD_DELAYS_MS[index] ?? 0}>
                <FloatingCard
                  title={card.title}
                  detail={card.detail}
                  badge={card.badge}
                  badgeTone={card.badgeTone}
                />
              </Reveal>
            </li>
          ))}
        </ul>
        <p className={`kk-caption ${styles.caption}`}>Ilustrasi, bukan peta geografis akurat.</p>
      </div>
    </section>
  );
}
