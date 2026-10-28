import { useRef } from 'react';
import { StatusMessage } from '@/components/feedback/StatusMessage';
import { Chip } from '@/components/ui/Chip/Chip';
import { DataHubErrorMessage } from '@/features/data-hub';
import { formatEventTime, formatMagnitude } from './format';
import { OriginBadge } from './OriginBadge';
import { describeLastSuccess } from './originText';
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
 * the keyboard and screen-reader way to reach what the map shows as dots. It sits in the map's
 * toolbar, so the list, headed by how to read the dots, folds into a disclosure that opens over the map; why data
 * is stale or withheld, and failures, are always shown in full.
 */
export function EarthquakeLayerControl({
  enabled,
  available,
  onToggle,
  state,
  selectedId,
  onSelect,
}: EarthquakeLayerControlProps) {
  const listRef = useRef<HTMLDetailsElement>(null);
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
        {!available && <span className="kk-small">Hanya untuk data LIVE (peta batas resmi).</span>}
        {enabled && <LayerStatus state={state} count={shown.length} />}
        {shown.length > 0 && (
          <details ref={listRef} className={styles.disclosure}>
            <summary className="kk-small">Daftar gempa ({shown.length})</summary>
            <div className={`glass ${styles.popover}`}>
              <p className={`kk-small ${styles.legend}`}>
                Ukuran titik mengikuti magnitudo, bukan luas wilayah terdampak. Warna dan ukuran tidak
                menunjukkan kerusakan, risiko, atau potensi tsunami; ikuti keterangan resmi BMKG.
              </p>
              <ul role="list" className={styles.events}>
                {shown.map((event) => (
                  <li key={event.id}>
                    <button
                      type="button"
                      className={styles.event}
                      aria-pressed={event.id === selectedId}
                      onClick={() => {
                        onSelect(event.id);
                        // The detail opens in the panel; fold the list so it does not cover the map.
                        if (listRef.current) listRef.current.open = false;
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
            </div>
          </details>
        )}
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
      {enabled && feed && assessment && assessment.display !== 'WITHHELD' && (
        <p className={`kk-small ${styles.reasons}`}>
          {describeLastSuccess(feed.lastSuccessAt)}
          {feed.rejectedCount > 0
            ? ` · ${String(feed.rejectedCount)} entri ditolak karena tidak lolos validasi`
            : ''}
        </p>
      )}
      {enabled && state.status === 'error' && (
        <DataHubErrorMessage error={state.lastError} onRetry={state.retry} />
      )}
      {enabled && state.status === 'loading' && <StatusMessage kind="loading" title="Memuat gempa BMKG…" />}
    </section>
  );
}

function LayerStatus({ state, count }: { readonly state: EarthquakeFeedState; readonly count: number }) {
  const { assessment, feed } = state;
  if (!assessment || !feed) return null;
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
      <OriginBadge origin={feed.origin} />
      {assessment.isStale && <Chip tone="warning">Mungkin usang</Chip>}
      <span>
        {count} gempa{age ? ` · ${age}` : ''}
      </span>
    </span>
  );
}
