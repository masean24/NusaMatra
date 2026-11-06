import { useRef } from 'react';
import { StatusMessage } from '@/components/feedback/StatusMessage';
import { Chip } from '@/components/ui/Chip/Chip';
import { DataHubErrorMessage } from '@/features/data-hub';
import { magnitudeBand } from '@/domain/hazards';
import { describeEvent, formatEventTime, formatMagnitudeShort } from './format';
import { toneStyle } from './magnitudeTones';
import { OriginBadge } from './OriginBadge';
import { describeLastSuccess } from './originText';
import type { EarthquakeFeedState } from './useEarthquakeFeed';
import styles from './EarthquakeLayerControl.module.css';
import { t } from '@/lib/i18n';

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
 * the keyboard and screen-reader way to reach what the map shows as symbols. It sits in the map's
 * toolbar, so the list, headed by how to read the symbols, folds into a disclosure that opens over the
 * map; why data is stale or withheld, and failures, are always shown in full.
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
    <section className={styles.control} aria-label={t('Lapisan gempa BMKG')}>
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
          {t('Gempa BMKG')}
        </button>
        {!available && <span className="kk-small">{t('Hanya untuk data LIVE (peta batas resmi).')}</span>}
        {shown.length > 0 && (
          <details ref={listRef} className={styles.disclosure}>
            <summary className="kk-small">{t('Daftar gempa ({0})', shown.length)}</summary>
            <div className={`glass ${styles.popover}`}>
              <p className={`kk-small ${styles.legend}`}>
                {t(
                  'Warna dan ukuran simbol mengikuti magnitudo, bukan luas wilayah terdampak: merah M 5 ke atas, jingga M 4 sampai 4,9, kuning di bawah M 4. Keduanya tidak menunjukkan kerusakan, risiko, atau potensi tsunami; ikuti keterangan resmi BMKG.',
                )}
              </p>
              <ul role="list" className={styles.events}>
                {shown.map((event) => (
                  <li key={event.id}>
                    <button
                      type="button"
                      className={styles.event}
                      aria-label={describeEvent(event)}
                      aria-pressed={event.id === selectedId}
                      onClick={() => {
                        onSelect(event.id);
                        // The detail opens in the panel; fold the list so it does not cover the map.
                        if (listRef.current) listRef.current.open = false;
                      }}
                    >
                      <span className={styles.eventBadge} style={toneStyle(magnitudeBand(event.magnitude))}>
                        {formatMagnitudeShort(event.magnitude)}
                      </span>
                      <span className={styles.eventText}>
                        <span className="kk-body-strong">{event.area ?? t('Lokasi tidak disebutkan')}</span>
                        <span className={`kk-small ${styles.eventTime}`}>{formatEventTime(event)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        )}
      </div>
      {enabled && <LayerStatus state={state} count={shown.length} />}

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
          {t('Pembaruan terakhir gagal; yang tampil adalah data sebelumnya. Akan dicoba lagi otomatis.')}
        </p>
      )}
      {enabled && feed && assessment && assessment.display !== 'WITHHELD' && (
        <p className={`kk-small ${styles.reasons}`}>
          {describeLastSuccess(feed.lastSuccessAt)}
          {feed.rejectedCount > 0
            ? t(', {0} entri ditolak karena tidak lolos validasi', String(feed.rejectedCount))
            : ''}
        </p>
      )}
      {enabled && state.status === 'error' && (
        <DataHubErrorMessage error={state.lastError} onRetry={state.retry} />
      )}
      {enabled && state.status === 'loading' && (
        <StatusMessage kind="loading" title={t('Memuat gempa BMKG…')} />
      )}
    </section>
  );
}

function LayerStatus({ state, count }: { readonly state: EarthquakeFeedState; readonly count: number }) {
  const { assessment, feed } = state;
  if (!assessment || !feed) return null;
  if (assessment.display === 'WITHHELD')
    return <Chip tone="warning">{t('Gempa ditahan: asal data belum jelas')}</Chip>;
  const age =
    assessment.ageMinutes === null
      ? null
      : t('diperbarui BMKG ±{0} menit lalu', String(Math.round(assessment.ageMinutes)));
  return (
    <span className={`kk-small ${styles.status}`}>
      {assessment.display === 'PREVIEW_UNVERIFIED' ? (
        <Chip tone="warning">{t('Pratinjau: asal data belum terverifikasi')}</Chip>
      ) : (
        <Chip>{t('Data BMKG')}</Chip>
      )}
      <OriginBadge origin={feed.origin} />
      {assessment.isStale && <Chip tone="warning">{t('Mungkin usang')}</Chip>}
      <span>{t('{0} gempa{1}', count, age ? `, ${age}` : '')}</span>
    </span>
  );
}
