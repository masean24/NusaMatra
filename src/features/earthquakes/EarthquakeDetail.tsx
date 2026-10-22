import { useState } from 'react';
import { Button } from '@/components/ui/Button/Button';
import { Chip } from '@/components/ui/Chip/Chip';
import type { FeedAssessment } from '@/domain/hazards';
import type { EarthquakeEventDTO } from '@/services/api';
import { formatDepth, formatEpicentre, formatEventTime, formatMagnitude } from './format';
import styles from './EarthquakeDetail.module.css';

const BMKG_PORTAL = 'https://data.bmkg.go.id/gempabumi/';

interface EarthquakeDetailProps {
  readonly event: EarthquakeEventDTO;
  readonly assessment: FeedAssessment;
  readonly onClose: () => void;
}

/** One BMKG event in the side panel. Every string from the feed is rendered as text by React. */
export function EarthquakeDetail({ event, assessment, onClose }: EarthquakeDetailProps) {
  const [shakemapFailed, setShakemapFailed] = useState(false);

  return (
    <article className={styles.detail} aria-labelledby={`gempa-${event.id}`}>
      <header className={styles.header}>
        <h2 id={`gempa-${event.id}`} className="kk-h3">
          Gempa {formatMagnitude(event.magnitude)}
        </h2>
        <Button variant="secondary" onClick={onClose}>
          Tutup detail gempa
        </Button>
      </header>
      <p className={styles.status}>
        {assessment.display === 'PREVIEW_UNVERIFIED' ? (
          <Chip tone="warning">Pratinjau: asal data belum terverifikasi</Chip>
        ) : (
          <Chip>Data BMKG</Chip>
        )}
        {assessment.isStale && <Chip tone="warning">Mungkin usang</Chip>}
      </p>

      <dl className={styles.facts}>
        <div>
          <dt>Magnitudo</dt>
          <dd>{formatMagnitude(event.magnitude).replace('Magnitudo ', '')}</dd>
        </div>
        <div>
          <dt>Kedalaman</dt>
          <dd>{formatDepth(event.depthKm)}</dd>
        </div>
        <div>
          <dt>Waktu</dt>
          <dd>{formatEventTime(event)}</dd>
        </div>
        <div>
          <dt>Episenter</dt>
          <dd>{formatEpicentre(event)}</dd>
        </div>
        <div>
          <dt>Lokasi</dt>
          <dd>{event.area ?? 'Tidak disebutkan'}</dd>
        </div>
        <div>
          <dt>Dirasakan (skala MMI)</dt>
          <dd>{event.felt ?? 'Tidak ada laporan dirasakan pada data ini'}</dd>
        </div>
        {event.potency && (
          <div>
            <dt>Keterangan BMKG</dt>
            <dd>{event.potency}</dd>
          </div>
        )}
      </dl>

      {event.shakemapUrl && !shakemapFailed && (
        <figure className={styles.shakemap}>
          <img
            src={event.shakemapUrl}
            alt={`Peta guncangan (shakemap) BMKG untuk gempa ${formatMagnitude(event.magnitude)} ${formatEventTime(event)}`}
            loading="lazy"
            decoding="async"
            onError={() => {
              setShakemapFailed(true);
            }}
          />
          <figcaption className="kk-small">Shakemap BMKG</figcaption>
        </figure>
      )}
      {event.shakemapUrl && shakemapFailed && (
        <p className="kk-small">
          Gambar shakemap gagal dimuat.{' '}
          <a href={event.shakemapUrl} target="_blank" rel="noreferrer noopener">
            Buka di situs BMKG
          </a>
        </p>
      )}

      <p className={`kk-small ${styles.muted}`}>
        Ukuran titik di peta mengikuti magnitudo, bukan luas wilayah terdampak. Magnitudo bukan ukuran
        kerusakan atau risiko tsunami; untuk peringatan, ikuti keterangan resmi BMKG.
      </p>
      <p className={`kk-small ${styles.muted}`}>
        Sumber: BMKG (Badan Meteorologi, Klimatologi, dan Geofisika) melalui Data Hub Nusa Matra ·{' '}
        <a href={BMKG_PORTAL} target="_blank" rel="noreferrer noopener">
          data.bmkg.go.id
        </a>
      </p>
    </article>
  );
}
