import { useEffect, useRef } from 'react';
import { Icon } from '@/components/ui/Icon/Icon';
import { magnitudeBand } from '@/domain/hazards';
import type { EarthquakeEventDTO } from '@/services/api';
import { describeEvent, formatEventTime, formatMagnitudeShort } from './format';
import { toneStyle } from './magnitudeTones';
import styles from './EarthquakeList.module.css';
import { t } from '@/lib/i18n';

interface EarthquakeListProps {
  readonly events: readonly EarthquakeEventDTO[];
  /** The event just left, whose row takes the focus again and is marked, so the place is not lost. */
  readonly lastOpenedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly onClose: () => void;
}

/**
 * The events the map shows as symbols, as a list in the side panel; the keyboard and screen-reader way
 * to reach them too. Opening one shows its detail in the same place, so the eye never has to travel.
 */
export function EarthquakeList({ events, lastOpenedId, onSelect, onClose }: EarthquakeListProps) {
  const lastRowRef = useRef<HTMLButtonElement>(null);

  // Back from a detail: this row again, in view, instead of the top of a long list.
  useEffect(() => {
    lastRowRef.current?.focus();
  }, []);

  return (
    <section className={styles.list} aria-label={t('Daftar gempa')}>
      <header className={styles.header}>
        <h2 className={`kk-h3 ${styles.title}`} tabIndex={-1} data-quake-heading>
          {t('Daftar gempa')}
        </h2>
        <button type="button" className={styles.close} aria-label={t('Tutup daftar gempa')} onClick={onClose}>
          <Icon name="close" size={20} />
        </button>
      </header>
      <p className={`kk-small ${styles.count}`}>
        {t('{0} gempa terbaru dari BMKG. Pilih salah satu untuk melihatnya di peta.', String(events.length))}
      </p>
      <details className={`kk-small ${styles.legend}`}>
        <summary>{t('Cara membaca warna dan ukuran simbol')}</summary>
        <p>
          {t(
            'Warna dan ukuran simbol mengikuti magnitudo, bukan luas wilayah terdampak: merah M 5 ke atas, jingga M 4 sampai 4,9, kuning di bawah M 4. Keduanya tidak menunjukkan kerusakan, risiko, atau potensi tsunami; ikuti keterangan resmi BMKG.',
          )}
        </p>
      </details>
      <ul role="list" className={styles.events} aria-label={t('Gempa, terbaru lebih dulu')}>
        {events.map((event) => (
          <li key={event.id}>
            <button
              ref={event.id === lastOpenedId ? lastRowRef : undefined}
              type="button"
              className={styles.event}
              data-last={event.id === lastOpenedId || undefined}
              aria-label={describeEvent(event)}
              onClick={() => {
                onSelect(event.id);
              }}
            >
              <span className={styles.badge} style={toneStyle(magnitudeBand(event.magnitude))}>
                {formatMagnitudeShort(event.magnitude)}
              </span>
              <span className={styles.text}>
                <span className={styles.place}>{event.area ?? t('Lokasi tidak disebutkan')}</span>
                <span className={`kk-small ${styles.time}`}>{formatEventTime(event)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
