import { useState } from 'react';
import { Button } from '@/components/ui/Button/Button';
import { Chip } from '@/components/ui/Chip/Chip';
import type { FeedAssessment } from '@/domain/hazards';
import type { EarthquakeEventDTO, EarthquakeOrigin } from '@/services/api';
import { OriginBadge } from './OriginBadge';
import {
  formatDepth,
  formatEpicentre,
  formatEventTime,
  formatMagnitude,
  formatMagnitudeValue,
} from './format';
import styles from './EarthquakeDetail.module.css';
import { t } from '@/lib/i18n';

const BMKG_PORTAL = 'https://data.bmkg.go.id/gempabumi/';

interface EarthquakeDetailProps {
  readonly event: EarthquakeEventDTO;
  readonly assessment: FeedAssessment;
  /** Where the Data Hub says the feed came from; omitted only when the caller does not know. */
  readonly origin?: EarthquakeOrigin | undefined;
  readonly onClose: () => void;
}

/** One BMKG event in the side panel. Every string from the feed is rendered as text by React. */
export function EarthquakeDetail({ event, assessment, origin, onClose }: EarthquakeDetailProps) {
  const [shakemapFailed, setShakemapFailed] = useState(false);

  return (
    <article className={styles.detail} aria-labelledby={`gempa-${event.id}`}>
      <header className={styles.header}>
        <h2 id={`gempa-${event.id}`} className="kk-h3">
          {t('Gempa {0}', formatMagnitude(event.magnitude))}
        </h2>
        <Button variant="secondary" onClick={onClose}>
          {t('Tutup detail gempa')}
        </Button>
      </header>
      <p className={styles.status}>
        {assessment.display === 'PREVIEW_UNVERIFIED' ? (
          <Chip tone="warning">{t('Pratinjau: asal data belum terverifikasi')}</Chip>
        ) : (
          <Chip>{t('Data BMKG')}</Chip>
        )}
        {origin && <OriginBadge origin={origin} />}
        {assessment.isStale && <Chip tone="warning">{t('Mungkin usang')}</Chip>}
      </p>

      <dl className={styles.facts}>
        <div>
          <dt>{t('Magnitudo')}</dt>
          <dd>{formatMagnitudeValue(event.magnitude)}</dd>
        </div>
        <div>
          <dt>{t('Kedalaman')}</dt>
          <dd>{formatDepth(event.depthKm)}</dd>
        </div>
        <div>
          <dt>{t('Waktu')}</dt>
          <dd>{formatEventTime(event)}</dd>
        </div>
        <div>
          <dt>{t('Episenter')}</dt>
          <dd>{formatEpicentre(event)}</dd>
        </div>
        <div>
          <dt>{t('Lokasi')}</dt>
          <dd>{event.area ?? t('Tidak disebutkan')}</dd>
        </div>
        <div>
          <dt>{t('Dirasakan (skala MMI)')}</dt>
          <dd>{event.felt ?? t('Tidak ada laporan dirasakan pada data ini')}</dd>
        </div>
        {event.potency && (
          <div>
            <dt>{t('Keterangan BMKG')}</dt>
            <dd>{event.potency}</dd>
          </div>
        )}
      </dl>

      {event.shakemapUrl && !shakemapFailed && (
        <figure className={styles.shakemap}>
          <img
            src={event.shakemapUrl}
            alt={t(
              'Peta guncangan (shakemap) BMKG untuk gempa {0} {1}',
              formatMagnitude(event.magnitude),
              formatEventTime(event),
            )}
            loading="lazy"
            decoding="async"
            onError={() => {
              setShakemapFailed(true);
            }}
          />
          <figcaption className="kk-small">{t('Shakemap BMKG')}</figcaption>
        </figure>
      )}
      {event.shakemapUrl && shakemapFailed && (
        <p className="kk-small">
          {t('Gambar shakemap gagal dimuat.')}{' '}
          <a href={event.shakemapUrl} target="_blank" rel="noreferrer noopener">
            {t('Buka di situs BMKG')}
          </a>
        </p>
      )}

      <p className={`kk-small ${styles.muted}`}>
        {t(
          'Ukuran titik di peta mengikuti magnitudo, bukan luas wilayah terdampak. Magnitudo bukan ukuran kerusakan atau risiko tsunami; untuk peringatan, ikuti keterangan resmi BMKG.',
        )}
      </p>
      <p className={`kk-small ${styles.muted}`}>
        {t('Sumber: BMKG (Badan Meteorologi, Klimatologi, dan Geofisika) melalui Data Hub Nusa Matra.')}{' '}
        <a href={BMKG_PORTAL} target="_blank" rel="noreferrer noopener">
          data.bmkg.go.id
        </a>
      </p>
    </article>
  );
}
