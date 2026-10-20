import type { CSSProperties } from 'react';
import checkUrl from '@/assets/figma/icons/check.svg';
import chevronLeftUrl from '@/assets/figma/icons/chevron-left.svg';
import closeUrl from '@/assets/figma/icons/close.svg';
import compareUrl from '@/assets/figma/icons/compare.svg';
import dropUrl from '@/assets/figma/icons/drop.svg';
import labUrl from '@/assets/figma/icons/lab.svg';
import mapUrl from '@/assets/figma/icons/map.svg';
import passportUrl from '@/assets/figma/icons/passport.svg';
import searchUrl from '@/assets/figma/icons/search.svg';
import storyUrl from '@/assets/figma/icons/story.svg';
import sunUrl from '@/assets/figma/icons/sun.svg';
import testUrl from '@/assets/figma/icons/test.svg';
import warningUrl from '@/assets/figma/icons/warning.svg';
import styles from './Icon.module.css';

/** The "ikon/*" line icons exported from Figma. */
const ICONS = {
  check: { url: checkUrl, inset: '25% 16.67% 29.17%' },
  chevronLeft: { url: chevronLeftUrl, inset: '0' },
  close: { url: closeUrl, inset: '25%' },
  compare: { url: compareUrl, inset: '12.5%' },
  drop: { url: dropUrl, inset: '0' },
  lab: { url: labUrl, inset: '8.33% 17.63%' },
  map: { url: mapUrl, inset: '13.48% 12.5%' },
  passport: { url: passportUrl, inset: '8.33% 16.67%' },
  search: { url: searchUrl, inset: '12.5%' },
  story: { url: storyUrl, inset: '12.5% 8.33%' },
  sun: { url: sunUrl, inset: '0' },
  test: { url: testUrl, inset: '12.5% 8.33%' },
  warning: { url: warningUrl, inset: '12.44% 8.34% 12.5% 8.26%' },
} as const;

export type IconName = keyof typeof ICONS;

interface IconProps {
  readonly name: IconName;
  /** Box size in px; the glyph keeps the inset it has inside its Figma frame. */
  readonly size?: number;
  readonly className?: string | undefined;
}

/**
 * Renders a Figma icon as a CSS mask so it takes `currentColor`, matching the Figma note
 * "Warna mengikuti token teks". Icons are decorative; the control around them carries the name.
 */
export function Icon({ name, size = 24, className }: IconProps) {
  const { url, inset } = ICONS[name];
  const style = {
    '--icon-size': `${size}px`,
    '--icon-url': `url("${url}")`,
    '--icon-inset': inset,
  } as CSSProperties;
  return (
    <span
      className={className ? `${styles.icon} ${className}` : styles.icon}
      style={style}
      aria-hidden="true"
    >
      <span className={styles.glyph} />
    </span>
  );
}
