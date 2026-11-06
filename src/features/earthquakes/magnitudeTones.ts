import type { CSSProperties } from 'react';
import type { MagnitudeBand } from '@/domain/hazards';
import { localized, t } from '@/lib/i18n';

/**
 * The colour steps of a magnitude: `color` for symbols, `text` for the number on a light card (at
 * least 4.5:1 on kapur). They help read the number; they say nothing about damage or risk.
 */
export const MAGNITUDE_TONES = localized(
  (): Readonly<Record<MagnitudeBand, { color: string; text: string; label: string }>> => ({
    strong: { color: '#E5342B', text: '#C4261E', label: t('M 5 ke atas') },
    moderate: { color: '#FF8A3D', text: '#B84F08', label: t('M 4 sampai 4,9') },
    light: { color: '#F2B705', text: '#8A6500', label: t('Di bawah M 4') },
  }),
);

export const toneStyle = (band: MagnitudeBand) =>
  ({ '--tone': MAGNITUDE_TONES()[band].color, '--tone-text': MAGNITUDE_TONES()[band].text }) as CSSProperties;
