import type { ReactNode } from 'react';
import styles from './Chip.module.css';

interface ChipProps {
  /**
   * `neutral` = darat/2 chip ("Data simulasi untuk prototipe"); `warning` = orange ("Tahun berbeda");
   * `onBand` = the neutral chip placed on a darat/2 band, where it takes the surface colour instead.
   */
  readonly tone?: 'neutral' | 'warning' | 'onBand';
  readonly children: ReactNode;
}

export function Chip({ tone = 'neutral', children }: ChipProps) {
  return <span className={`${styles.chip} ${styles[tone]}`}>{children}</span>;
}
