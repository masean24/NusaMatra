import type { MagnitudeBand } from '@/domain/hazards';
import { MAGNITUDE_TONES } from './magnitudeTones';
import styles from './EarthquakeLegend.module.css';

const BANDS: readonly MagnitudeBand[] = ['strong', 'moderate', 'light'];

/**
 * How to read the symbols, on the map itself. The rings are named for what they are: BMKG's feed has
 * no shaking radius, so they must not be read as one.
 */
export function EarthquakeLegend({ className }: { readonly className?: string | undefined }) {
  return (
    <aside className={`${styles.legend} ${className ?? ''}`} aria-label="Keterangan simbol gempa">
      <p className={styles.title}>Titik gempa</p>
      <ul role="list" className={styles.items}>
        {BANDS.map((band) => (
          <li key={band} className={styles.item}>
            <span className={styles.swatch} style={{ background: MAGNITUDE_TONES[band].color }} />
            {MAGNITUDE_TONES[band].label}
          </li>
        ))}
        <li className={styles.item}>
          <span className={styles.ring} />
          Cincin ikut magnitudo, bukan radius guncangan
        </li>
      </ul>
    </aside>
  );
}
