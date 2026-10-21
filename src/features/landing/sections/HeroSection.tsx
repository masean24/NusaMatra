import { animate, stagger } from 'motion';
import { useEffect, useRef, useState } from 'react';
import { ButtonLink } from '@/components/ui/Button/Button';
import { buttonClassName } from '@/components/ui/Button/buttonClassName';
import { DEMO_HERO_CARDS } from '@/data/fixtures/landingDemo';
import { HeroDioramaSlot } from '@/features/geo3d';
import { Reveal, STAGGER_ITEM_PROPS, useReducedMotion } from '@/features/motion';
import { FloatingCard } from '../components/FloatingCard';
import { HeroMapLayer } from '../components/HeroMapLayer';
import { RegionSearchForm } from '../components/RegionSearchForm';
import type { HeroCardId } from '../heroMapPins';
import { useHeroMapSequence } from '../useHeroMapSequence';
import styles from './HeroSection.module.css';

/* G1: heading, lead, search, buttons rise 28px, ~90ms apart, 700ms on the "Tenang" curve. */
const G1_STAGGER_MS = 90;
const G1_DISTANCE = 28;
/* G2: the diorama rises 60px over 1.1s. The cards then follow the map's own entrance (see useHeroMapSequence). */
const G2_DELAY_MS = 100;
const CARD_STAGGER_S = 0.13;
const CARD_RISE_PX = 18;
const EASE_CALM = [0.16, 1, 0.3, 1] as const;

/** Where "Mulai jelajahi" leads (3D-1 note: the CTA opens the map). */
const EXPLORE_PATH = '/peta';

function isHeroCardId(id: string): id is HeroCardId {
  return id === 'a' || id === 'b' || id === 'c';
}

export function HeroSection() {
  const { outcome, pinsVisible, cardsVisible, handleOutcome } = useHeroMapSequence();
  const reducedMotion = useReducedMotion();
  const [activeCard, setActiveCard] = useState<HeroCardId | null>(null);
  const cardsRef = useRef<HTMLUListElement>(null);

  // The cards are laid out from the start (the connector lines measure them) but fade in one after
  // another once the map has finished its entrance.
  useEffect(() => {
    const cards = cardsRef.current;
    if (!cards || !cardsVisible) return;
    const holds = cards.querySelectorAll<HTMLElement>('[data-card-hold]');
    const playback = reducedMotion
      ? animate(holds, { opacity: [0, 1] }, { duration: 0.2 })
      : animate(
          holds,
          { opacity: [0, 1], y: [CARD_RISE_PX, 0] },
          { duration: 0.6, ease: EASE_CALM, delay: stagger(CARD_STAGGER_S) },
        );
    return () => {
      playback.stop();
    };
  }, [cardsVisible, reducedMotion]);

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

      <div className={styles.visual} data-hero-visual>
        <div className={styles.stage}>
          <Reveal
            trigger="load"
            distance={60}
            duration={1100}
            delay={G2_DELAY_MS}
            className={styles.dioramaReveal}
          >
            {/* Hexagon map (default engine); the relief diorama and the Figma illustration are its fallbacks. */}
            <HeroDioramaSlot
              scene="hero"
              description="Peta hexagon Indonesia (ilustrasi, data simulasi): setiap sel hexagon mewakili sebagian daratan, diberi warna dari putih ke oranye tua sesuai nilai simulasi, dengan tiga titik penanda oranye."
              onHeroMapOutcome={handleOutcome}
            />
          </Reveal>
          {outcome !== 'unavailable' && (
            <HeroMapLayer
              visible={pinsVisible}
              activeId={activeCard}
              reducedMotion={reducedMotion}
              onToggle={(id) => {
                setActiveCard((current) => (current === id ? null : id));
              }}
            />
          )}
        </div>
        <ul
          ref={cardsRef}
          role="list"
          className={styles.cards}
          aria-label="Contoh kartu wilayah (data simulasi)"
        >
          {DEMO_HERO_CARDS.map((card) => (
            <li key={card.id} className={styles.cardSlot} data-card={card.id}>
              <div className={styles.cardHold} data-card-hold {...STAGGER_ITEM_PROPS}>
                <FloatingCard
                  title={card.title}
                  detail={card.detail}
                  badge={card.badge}
                  badgeTone={card.badgeTone}
                  highlighted={isHeroCardId(card.id) && activeCard === card.id}
                />
              </div>
            </li>
          ))}
        </ul>
        <p className={`kk-caption ${styles.caption}`}>Ilustrasi, bukan peta geografis akurat.</p>
      </div>
    </section>
  );
}
