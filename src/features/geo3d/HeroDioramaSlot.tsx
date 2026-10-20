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

/** Figma 43:713: phones get the still image instead of WebGL. */
const STILL_IMAGE_QUERY = '(width < 768px)';

interface HeroDioramaSlotProps {
  /** `hero` = 3D-1 landing hero; `story` = 3D-5 story band (the engine has no story scene yet). */
  readonly scene: 'hero' | 'story';
  /** Plain-language description of the illustration for screen readers. */
  readonly description: string;
  readonly className?: string | undefined;
}

/**
 * Integration slot for the external `HeroDiorama` (Figma 3D-1). The static Figma illustration is
 * shown first, on phones, for the story scene, and whenever the engine fails.
 */
export function HeroDioramaSlot({ scene, description, className }: HeroDioramaSlotProps) {
  const { mode } = useDisplayMode();
  const reducedMotion = useReducedMotion();
  const stillImageOnly = useMediaQuery(STILL_IMAGE_QUERY);
  const art = PLACEHOLDER_ART[scene];
  const engine = scene === 'hero' && !stillImageOnly ? geoEngineRegistry.HeroDiorama : null;

  return (
    <div className={[styles.frame, styles[scene], className].filter(Boolean).join(' ')}>
      <p className="visually-hidden">{description}</p>
      <EngineSlot
        engine={engine}
        engineProps={{
          displayMode: mode,
          dataMode: publicConfig.dataMode,
          reducedMotion,
        }}
        placeholder={
          <img
            className={styles.art}
            src={art[mode]}
            alt=""
            width={art.width}
            height={art.height}
            loading={scene === 'hero' ? 'eager' : 'lazy'}
            decoding="async"
          />
        }
      />
    </div>
  );
}
