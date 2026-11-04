import { magnitudeBand } from '@/domain/hazards';
import type { EarthquakeEventDTO } from '@/services/api';
import { describeEvent, formatEventTime, formatMagnitudeShort } from './format';
import { toneStyle } from './magnitudeTones';
import styles from './EarthquakeCallout.module.css';

interface EarthquakeCalloutProps {
  readonly event: EarthquakeEventDTO;
  readonly selected: boolean;
  readonly onSelect: (id: string) => void;
}

/** A card under an epicentre: what it was, how strong, where and when; opens the event's detail. */
export function EarthquakeCallout({ event, selected, onSelect }: EarthquakeCalloutProps) {
  return (
    <button
      type="button"
      className={styles.card}
      style={toneStyle(magnitudeBand(event.magnitude))}
      aria-label={describeEvent(event)}
      aria-pressed={selected}
      onClick={() => {
        onSelect(event.id);
      }}
    >
      <span className={styles.head}>
        <span>
          <span className={styles.kind}>Gempa Bumi</span>
          <span className={styles.magnitude}>{formatMagnitudeShort(event.magnitude)}</span>
        </span>
        <svg className={styles.trace} viewBox="0 0 32 20" width="32" height="20" aria-hidden="true">
          <path d="M1 10h7l3-7 5 14 3-9 2 2h10" />
        </svg>
      </span>
      <span className={styles.line}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M8 14.5s5-4.6 5-8.5a5 5 0 0 0-10 0c0 3.9 5 8.5 5 8.5Z" />
          <circle cx="8" cy="6" r="1.75" />
        </svg>
        <span className={styles.place}>{event.area ?? 'Lokasi tidak disebutkan'}</span>
      </span>
      <span className={styles.line}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <circle cx="8" cy="8" r="6" />
          <path d="M8 4.75V8l2.25 1.5" />
        </svg>
        <span>{formatEventTime(event)}</span>
      </span>
    </button>
  );
}
