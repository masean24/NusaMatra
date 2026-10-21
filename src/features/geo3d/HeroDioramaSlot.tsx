import { useEffect, useEffectEvent } from 'react';
import storyGlassUrl from '@/assets/figma/landing/placeholder-story-diorama-kaca.svg';
import storyUrl from '@/assets/figma/landing/placeholder-story-diorama.svg';
import { HexPoster } from '@/features/hex-map';
import { useReducedMotion } from '@/features/motion';
import { useDisplayMode } from '@/features/theme';
import { publicConfig } from '@/lib/publicConfig';
import { EngineSlot } from './EngineSlot';
import { geoEngineRegistry } from './engineRegistry';
import styles from './HeroDioramaSlot.module.css';

/** Approved Figma illustration of the story band (41:341), per display mode. */
const STORY_ART = { normal: storyUrl, glass: storyGlassUrl, width: 1190, height: 1088 } as const;

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
 * Integration slot for the landing hero. The hexagon map is the only engine. While it loads, and if
 * it cannot run (no WebGL, data or a rendering error), the slot shows `HexPoster`: a still picture of
 * that same map in the active theme. No other illustration is ever used in its place, and the slot
 * keeps its size throughout, so nothing jumps when the live scene takes over.
 */
export function HeroDioramaSlot({ scene, description, className, onHeroMapOutcome }: HeroDioramaSlotProps) {
  const { mode } = useDisplayMode();
  const reducedMotion = useReducedMotion();
  const isHero = scene === 'hero';
  const engineProps = { displayMode: mode, dataMode: publicConfig.dataMode, reducedMotion };

  return (
    <div className={[styles.frame, styles[scene], className].filter(Boolean).join(' ')}>
      <p className="visually-hidden">{description}</p>
      {isHero ? (
        <EngineSlot
          engine={geoEngineRegistry.HeroHexMap}
          engineProps={{
            ...engineProps,
            onEntranceSettled: () => {
              onHeroMapOutcome?.('settled');
            },
          }}
          placeholder={(state) => (
            <>
              {(state === 'failed' || state === 'absent') && (
                <ReportOnMount
                  onMount={() => {
                    onHeroMapOutcome?.('unavailable');
                  }}
                />
              )}
              <HexPoster theme={mode} />
            </>
          )}
        />
      ) : (
        <EngineSlot
          engine={null}
          engineProps={engineProps}
          placeholder={
            <img
              className={styles.art}
              src={STORY_ART[mode]}
              alt=""
              width={STORY_ART.width}
              height={STORY_ART.height}
              loading="lazy"
              decoding="async"
            />
          }
        />
      )}
    </div>
  );
}
