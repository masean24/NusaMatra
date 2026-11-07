import { StatusMessage } from '@/components/feedback/StatusMessage';
import { Chip } from '@/components/ui/Chip/Chip';
import { DataHubErrorMessage } from '@/features/data-hub';
import { OriginBadge } from './OriginBadge';
import { describeLastSuccess } from './originText';
import type { EarthquakeFeedState } from './useEarthquakeFeed';
import styles from './EarthquakeLayerControl.module.css';
import { t } from '@/lib/i18n';

const shownEvents = ({ assessment, feed }: EarthquakeFeedState, enabled: boolean) =>
  enabled && feed && assessment && assessment.display !== 'WITHHELD' ? feed.events : [];

interface EarthquakeLayerSwitchProps {
  readonly enabled: boolean;
  /** Only LIVE has official geography to place epicentres on. */
  readonly available: boolean;
  readonly onToggle: (next: boolean) => void;
  readonly state: EarthquakeFeedState;
  /** Whether the side panel is showing the list of events (or one of them). */
  readonly listOpen: boolean;
  readonly onToggleList: () => void;
  /** Chips over a phone's map: shorter words, the same names for assistive tech. */
  readonly chips?: boolean;
}

/** Switch for the "Gempa BMKG" layer and the button that opens its list of events in the side panel. */
export function EarthquakeLayerSwitch({
  enabled,
  available,
  onToggle,
  state,
  listOpen,
  onToggleList,
  chips = false,
}: EarthquakeLayerSwitchProps) {
  const count = shownEvents(state, enabled).length;
  const listName = t('Daftar gempa ({0})', count);
  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={t('Gempa BMKG')}
        disabled={!available}
        className={styles.switch}
        data-chip={chips || undefined}
        onClick={() => {
          onToggle(!enabled);
        }}
      >
        <span className={styles.track} aria-hidden="true">
          <span className={styles.knob} />
        </span>
        {chips ? t('Gempa') : t('Gempa BMKG')}
      </button>
      {count > 0 && (
        <button
          type="button"
          className={`kk-small ${styles.listButton}`}
          data-chip={chips || undefined}
          aria-label={listName}
          aria-pressed={listOpen}
          onClick={onToggleList}
        >
          {chips ? t('Daftar gempa') : listName}
        </button>
      )}
    </>
  );
}

interface EarthquakeLayerStatusProps {
  readonly enabled: boolean;
  readonly available: boolean;
  readonly state: EarthquakeFeedState;
}

/** The layer's status in words. Why data is stale or withheld, and failures, are shown in full. */
export function EarthquakeLayerStatus({ enabled, available, state }: EarthquakeLayerStatusProps) {
  const { assessment, feed } = state;
  const count = shownEvents(state, enabled).length;
  return (
    <>
      {!available && <span className="kk-small">{t('Hanya untuk data LIVE (peta batas resmi).')}</span>}
      {enabled && <LayerStatus state={state} count={count} />}

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
    </>
  );
}

/** The switch with its status beneath it, as one card (desktop). */
export function EarthquakeLayerControl(props: EarthquakeLayerSwitchProps) {
  const { enabled, available, state } = props;
  return (
    <section className={styles.control} aria-label={t('Lapisan gempa BMKG')}>
      <div className={styles.row}>
        <EarthquakeLayerSwitch {...props} />
      </div>
      <EarthquakeLayerStatus enabled={enabled} available={available} state={state} />
    </section>
  );
}

/** The status alone, where the switch sits elsewhere (phone: among the chips over the map). */
export function EarthquakeLayerDetails(props: EarthquakeLayerStatusProps) {
  return (
    <section className={styles.control} aria-label={t('Lapisan gempa BMKG')}>
      <p className={`kk-body-strong ${styles.detailsTitle}`}>{t('Gempa BMKG')}</p>
      {!props.enabled && props.available && (
        <span className={`kk-small ${styles.reasons}`}>{t('Lapisan ini sedang mati.')}</span>
      )}
      <EarthquakeLayerStatus {...props} />
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
