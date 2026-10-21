import { useEffect, useEffectEvent } from 'react';
import dioramaGlassUrl from '@/assets/figma/landing/diorama-nusantara-kaca.svg';
import dioramaUrl from '@/assets/figma/landing/diorama-nusantara.svg';
import storyGlassUrl from '@/assets/figma/landing/placeholder-story-diorama-kaca.svg';
import storyUrl from '@/assets/figma/landing/placeholder-story-diorama.svg';
import { useMediaQuery, useReducedMotion } from '@/features/motion';
import { useDisplayMode } from '@/features/theme';
import { publicConfig } from '@/lib/publicConfig';
import { EngineSlot } from './EngineSlot';
import { geoEngineRegistry } from './engineRegistry';
import styles from './HeroDioramaSlot.module.css';

/** Approved Figma illustrations (27:3 hero, 41:341 story), per display mode. */
const PLACEHOLDER_ART = {
  hero: { normal: dioramaUrl, glass: dioramaGlassUrl, width: 700, height: 640 },
  story: { normal: storyUrl, glass: storyGlassUrl, width: 1190, height: 1088 },
} as const;

/** Figma 43:713: phones skip the relief diorama fallback (the hexagon map itself runs on phones). */
const STILL_IMAGE_QUERY = '(width < 768px)';

/** What happened to the hexagon hero map, for the parts of the page that follow it. */
export type HeroMapOutcome = 'settled' | 'unavailable';

interface HeroDioramaSlotProps {
  /** `hero` = landing hero map; `story` = 3D-5 story band (the engine has no story scene yet). */
  readonly scene: 'hero' | 'story';
  /** Plain-language description of the illustration for screen readers. */
  readonly description: string;
  readonly className?: string | undefined;
  /** Hero only: `settled` once the hexagons finished entering, `unavailable` if they cannot render. */
  readonly onHeroMapOutcome?: ((outcome: HeroMapOutcome) => void) | undefined;
}

function ReportOnMount({ onMount }: { readonly onMount: () => void }) {
  const report = useEffectEvent(onMount);
  useEffect(() => {
    report();
  }, []);
  return null;
}

/**
 * Integration slot for the landing hero. The hexagon map is the default engine; if it cannot start
 * (no WebGL, data failed to load) the previous relief `HeroDiorama` takes over on larger screens,
 * and the static Figma illustration remains the last resort. The illustration also shows while
 * anything is loading.
 */
export function HeroDioramaSlot({ scene, description, className, onHeroMapOutcome }: HeroDioramaSlotProps) {
  const { mode } = useDisplayMode();
  const reducedMotion = useReducedMotion();
  const stillImageOnly = useMediaQuery(STILL_IMAGE_QUERY);
  const art = PLACEHOLDER_ART[scene];
  const isHero = scene === 'hero';
  const hexEngine = isHero ? geoEngineRegistry.HeroHexMap : null;
  const reliefEngine = isHero && !stillImageOnly ? geoEngineRegistry.HeroDiorama : null;
  const engineProps = { displayMode: mode, dataMode: publicConfig.dataMode, reducedMotion };

  const illustration = (
    <img
      className={styles.art}
      src={art[mode]}
      alt=""
      width={art.width}
      height={art.height}
      loading={isHero ? 'eager' : 'lazy'}
      decoding="async"
    />
  );

  return (
    <div className={[styles.frame, styles[scene], className].filter(Boolean).join(' ')}>
      <p className="visually-hidden">{description}</p>
      {isHero ? (
        <EngineSlot
          engine={hexEngine}
          engineProps={{
            ...engineProps,
            onEntranceSettled: () => {
              onHeroMapOutcome?.('settled');
            },
          }}
          placeholder={(state) =>
            state === 'failed' || state === 'absent' ? (
              <>
                <ReportOnMount
                  onMount={() => {
                    onHeroMapOutcome?.('unavailable');
                  }}
                />
                <EngineSlot engine={reliefEngine} engineProps={engineProps} placeholder={illustration} />
              </>
            ) : (
              illustration
            )
          }
        />
      ) : (
        <EngineSlot engine={null} engineProps={engineProps} placeholder={illustration} />
      )}
    </div>
  );
}
