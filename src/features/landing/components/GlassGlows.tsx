import type { CSSProperties } from 'react';
import glow1Url from '@/assets/figma/landing/glow-1.svg';
import glow2Url from '@/assets/figma/landing/glow-2.svg';
import glow3Url from '@/assets/figma/landing/glow-3.svg';
import glow4Url from '@/assets/figma/landing/glow-4.svg';
import glow5Url from '@/assets/figma/landing/glow-5.svg';
import glow6Url from '@/assets/figma/landing/glow-6.svg';
import glow7Url from '@/assets/figma/landing/glow-7.svg';
import styles from './GlassGlows.module.css';

/** Reference frame of the Kaca landing (27:118). */
const FRAME_WIDTH = 1440;
const FRAME_HEIGHT = 5080;

/**
 * "Cahaya latar" layers from 27:118: blurred cobalt and orange lights behind the glass panels.
 * Positions are the exported image boxes (layer box plus blur bleed), kept proportional to the page.
 */
const GLOWS = [
  { url: glow5Url, left: 760, top: -340, size: 980 },
  { url: glow6Url, left: -340, top: 360, size: 880 },
  { url: glow7Url, left: 1010, top: 420, size: 640 },
  { url: glow4Url, left: -360, top: 1340, size: 1020 },
  { url: glow3Url, left: 840, top: 2440, size: 920 },
  { url: glow2Url, left: -260, top: 3440, size: 1120 },
  { url: glow1Url, left: 740, top: 4140, size: 920 },
] as const;

/** Decorative; rendered only in Kaca mode through CSS. */
export function GlassGlows() {
  return (
    <div className={styles.layer} aria-hidden="true">
      {GLOWS.map((glow) => (
        <img
          key={glow.url}
          className={styles.glow}
          src={glow.url}
          alt=""
          width={glow.size}
          height={glow.size}
          loading="lazy"
          decoding="async"
          style={
            {
              '--glow-left': `${(glow.left / FRAME_WIDTH) * 100}%`,
              '--glow-top': `${(glow.top / FRAME_HEIGHT) * 100}%`,
              '--glow-size': `min(${glow.size}px, ${((glow.size / FRAME_WIDTH) * 100).toFixed(2)}vw)`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
