import { StatusMessage } from '@/components/feedback/StatusMessage';
import { Chip } from '@/components/ui/Chip/Chip';
import { DataHubErrorMessage } from '@/features/data-hub';
import { formatEventTime, formatMagnitude } from './format';
import type { EarthquakeFeedState } from './useEarthquakeFeed';
import styles from './EarthquakeLayerControl.module.css';

interface EarthquakeLayerControlProps {
  readonly enabled: boolean;
  /** Only LIVE has official geography to place epicentres on. */
  readonly available: boolean;
  readonly onToggle: (next: boolean) => void;
  readonly state: EarthquakeFeedState;
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}

/**
 * Switch for the "Gempa BMKG" layer, its status in words, and a list of the same events as buttons:
 * the keyboard and screen-reader way to reach what the map shows as dots.
 */
export function EarthquakeLayerControl({
  enabled,
  available,
  onToggle,
  state,
  selectedId,
  onSelect,
}: EarthquakeLayerControlProps) {
  const { assessment, feed } = state;
  const shown = enabled && feed && assessment && assessment.display !== 'WITHHELD' ? feed.events : [];

  return (
    <section className={styles.control} aria-label="Lapisan gempa BMKG">
      <div className={styles.row}>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={!available}
          className={styles.switch}
          onClick={() => {
            onToggle(!enabled);
          }}
        >
          <span className={styles.track} aria-hidden="true">
            <span className={styles.knob} />
          </span>
          Gempa BMKG
        </button>
        {!available && <span className="kk-small">Hanya tersedia pada data LIVE (peta batas resmi).</span>}
        {enabled && <LayerStatus state={state} count={shown.length} />}
      </div>

      {enabled && assessment && assessment.display !== 'OFFICIAL' && assessment.reasons.length > 0 && (
        <ul role="list" className={`kk-small ${styles.reasons}`}>
          {assessment.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
      {enabled && assessment?.display === 'OFFICIAL' && assessment.isStale && (
        <ul role="list" className={`kk-small ${styles.reasons}`}>
          {assessment.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
      {enabled && state.lastError !== null && feed && (
        <p className={`kk-small ${styles.reasons}`} role="status">
          Pembaruan terakhir gagal; yang tampil adalah data sebelumnya. Akan dicoba lagi otomatis.
        </p>
      )}
      {enabled && state.status === 'error' && <DataHubErrorMessage error={state.lastError} />}
      {enabled && state.status === 'loading' && <StatusMessage kind="loading" title="Memuat gempa BMKG…" />}

      {shown.length > 0 && (
        <>
          <p className={`kk-small ${styles.legend}`}>
            Ukuran titik mengikuti magnitudo, bukan luas wilayah terdampak. Warna dan ukuran tidak menunjukkan
            kerusakan, risiko, atau potensi tsunami; ikuti keterangan resmi BMKG.
          </p>
          <details className={styles.list}>
            <summary className="kk-small">Daftar gempa ({shown.length})</summary>
            <ul role="list">
              {shown.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    className={styles.event}
                    aria-pressed={event.id === selectedId}
                    onClick={() => {
                      onSelect(event.id);
                    }}
                  >
                    <span className="kk-body-strong">{formatMagnitude(event.magnitude)}</span>
                    <span className="kk-small">
                      {event.area ?? 'Lokasi tidak disebutkan'} · {formatEventTime(event)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}

function LayerStatus({ state, count }: { readonly state: EarthquakeFeedState; readonly count: number }) {
  const { assessment } = state;
  if (!assessment) return null;
  if (assessment.display === 'WITHHELD')
    return <Chip tone="warning">Gempa ditahan: asal data belum jelas</Chip>;
  const age =
    assessment.ageMinutes === null
      ? null
      : `diperbarui BMKG ±${String(Math.round(assessment.ageMinutes))} menit lalu`;
  return (
    <span className={`kk-small ${styles.status}`}>
      {assessment.display === 'PREVIEW_UNVERIFIED' ? (
        <Chip tone="warning">Pratinjau: asal data belum terverifikasi</Chip>
      ) : (
        <Chip>Data BMKG</Chip>
      )}
      {assessment.isStale && <Chip tone="warning">Mungkin usang</Chip>}
      <span>
        {count} gempa{age ? ` · ${age}` : ''}
      </span>
    </span>
  );
}
