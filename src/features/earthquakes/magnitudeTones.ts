import type { CSSProperties } from 'react';
import type { MagnitudeBand } from '@/domain/hazards';

/**
 * The colour steps of a magnitude: `color` for symbols, `text` for the number on a light card (at
 * least 4.5:1 on kapur). They help read the number; they say nothing about damage or risk.
 */
export const MAGNITUDE_TONES: Readonly<
  Record<MagnitudeBand, { color: string; text: string; label: string }>
> = {
  strong: { color: '#E5342B', text: '#C4261E', label: 'M 5 ke atas' },
  moderate: { color: '#FF8A3D', text: '#B84F08', label: 'M 4 sampai 4,9' },
  light: { color: '#F2B705', text: '#8A6500', label: 'Di bawah M 4' },
};

export const toneStyle = (band: MagnitudeBand) =>
  ({ '--tone': MAGNITUDE_TONES[band].color, '--tone-text': MAGNITUDE_TONES[band].text }) as CSSProperties;
