import { useState } from 'react';
import { Chip } from '@/components/ui/Chip/Chip';
import { Icon } from '@/components/ui/Icon/Icon';
import {
  depthClassOf,
  magnitudeBand,
  parseFeltReports,
  statesTsunamiThreat,
  type FeedAssessment,
} from '@/domain/hazards';
import type { EarthquakeEventDTO, EarthquakeOrigin } from '@/services/api';
import { BMKG_MMI_PAGE, depthClassText, mmiMeaning } from './earthquakeText';
import {
  formatDepth,
  formatEpicentre,
  formatEventTime,
  formatMagnitude,
  formatMagnitudeValue,
  formatTimeAgo,
} from './format';
import { toneStyle } from './magnitudeTones';
import { OriginBadge } from './OriginBadge';
import styles from './EarthquakeDetail.module.css';
import { t } from '@/lib/i18n';

const BMKG_PORTAL = 'https://data.bmkg.go.id/gempabumi/';

interface EarthquakeDetailProps {
  readonly event: EarthquakeEventDTO;
  readonly assessment: FeedAssessment;
  /** Where the Data Hub says the feed came from; omitted only when the caller does not know. */
  readonly origin?: EarthquakeOrigin | undefined;
  /** Its place in the list, with the ways to walk it; omitted, the detail stands alone. */
  readonly navigation?:
    | {
        readonly index: number;
        readonly total: number;
        readonly onBack: () => void;
        readonly onPrevious: (() => void) | null;
        readonly onNext: (() => void) | null;
      }
    | undefined;
  readonly onClose: () => void;
}

/**
 * One BMKG event, what a visitor asks first at the top: how strong, where, when, and what BMKG says
 * about a tsunami; then how deep it was and who felt it. Every string from the feed is rendered as
 * text by React.
 */
export function EarthquakeDetail({ event, assessment, origin, navigation, onClose }: EarthquakeDetailProps) {
  const [shakemapFailed, setShakemapFailed] = useState(false);
  // One moment per event opened: "6 jam yang lalu" does not need to tick while it is read.
  const [openedAt] = useState(() => Date.now());
  const timeAgo = formatTimeAgo(event.occurredAt, openedAt);

  return (
    <article className={styles.detail} aria-label={t('Gempa {0}', formatMagnitude(event.magnitude))}>
      <nav className={styles.toolbar} aria-label={t('Navigasi detail gempa')}>
        {navigation && (
          <button type="button" className={styles.back} onClick={navigation.onBack}>
            <Icon name="chevronLeft" size={18} />
            {t('Daftar gempa')}
          </button>
        )}
        <span className={styles.toolbarEnd}>
          {navigation && (
            <span className={styles.pager}>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={t('Gempa sebelumnya di daftar')}
                disabled={!navigation.onPrevious}
                onClick={navigation.onPrevious ?? undefined}
              >
                <Icon name="chevronLeft" size={18} />
              </button>
              <span className={styles.position}>
                {t('{0} dari {1}', String(navigation.index + 1), String(navigation.total))}
              </span>
              <button
                type="button"
                className={`${styles.iconButton} ${styles.next}`}
                aria-label={t('Gempa berikutnya di daftar')}
                disabled={!navigation.onNext}
                onClick={navigation.onNext ?? undefined}
              >
                <Icon name="chevronLeft" size={18} />
              </button>
            </span>
          )}
          <button
            type="button"
            className={styles.iconButton}
            aria-label={t('Tutup detail gempa')}
            onClick={onClose}
          >
            <Icon name="close" size={20} />
          </button>
        </span>
      </nav>

      <header className={styles.hero} style={toneStyle(magnitudeBand(event.magnitude))}>
        <p className={styles.magnitude}>
          <span className={styles.magnitudeLabel}>{t('Magnitudo')}</span>
          <span className={styles.magnitudeValue}>{formatMagnitudeValue(event.magnitude)}</span>
        </p>
        <div className={styles.headline}>
          <h2 className={`kk-body-strong ${styles.place}`} tabIndex={-1} data-quake-heading>
            {event.area ?? t('Lokasi tidak disebutkan')}
          </h2>
          <p className={`kk-small ${styles.time}`}>{formatEventTime(event)}</p>
          {timeAgo && <p className={`kk-small ${styles.ago}`}>{timeAgo}</p>}
        </div>
      </header>

      <TsunamiNote potency={event.potency} />

      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>{t('Kedalaman')}</dt>
          <dd>
            <span className={styles.factValue}>{formatDepth(event.depthKm)}</span>
            {event.depthKm !== null && (
              <span className={`kk-small ${styles.factHint}`}>
                {depthClassText(depthClassOf(event.depthKm))}
              </span>
            )}
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>{t('Episenter')}</dt>
          <dd>
            <span className={styles.factValue}>{formatEpicentre(event)}</span>
          </dd>
        </div>
      </dl>

      <FeltSection felt={event.felt} />

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
          <figcaption className={`kk-small ${styles.muted}`}>{t('Shakemap BMKG')}</figcaption>
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

      <footer className={styles.footer}>
        <p className={styles.status}>
          {assessment.display === 'PREVIEW_UNVERIFIED' ? (
            <Chip tone="warning">{t('Pratinjau: asal data belum terverifikasi')}</Chip>
          ) : (
            <Chip>{t('Data BMKG')}</Chip>
          )}
          {origin && <OriginBadge origin={origin} />}
          {assessment.isStale && <Chip tone="warning">{t('Mungkin usang')}</Chip>}
        </p>
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
      </footer>
    </article>
  );
}

/** BMKG's statement, verbatim, and said plainly when the feed carries none: silence is not an all-clear. */
function TsunamiNote({ potency }: { readonly potency: string | null }) {
  if (!potency) {
    return (
      <p className={`kk-small ${styles.note}`}>
        {t('Data ini tidak menyertakan keterangan tsunami dari BMKG.')}
      </p>
    );
  }
  const threat = statesTsunamiThreat(potency);
  return (
    <p className={styles.note} data-threat={threat || undefined} role={threat ? 'alert' : undefined}>
      {threat && <Icon name="warning" size={18} />}
      <span className={styles.noteText}>
        <span className={`kk-small ${styles.noteLabel}`}>{t('Keterangan BMKG')}</span>
        <span className="kk-body-strong">{potency}</span>
      </span>
    </p>
  );
}

/** Who felt it, sorted by how strongly and said in words; BMKG's text as sent if it cannot be read so. */
function FeltSection({ felt }: { readonly felt: string | null }) {
  const reports = felt ? parseFeltReports(felt) : null;
  return (
    <section className={styles.felt} aria-label={t('Dirasakan')}>
      <h3 className={`kk-body-strong ${styles.feltTitle}`}>{t('Dirasakan di')}</h3>
      {!felt && (
        <p className={`kk-small ${styles.muted}`}>{t('Tidak ada laporan dirasakan pada data ini')}</p>
      )}
      {felt && !reports && <p className="kk-small">{felt}</p>}
      {reports && (
        <>
          <ul role="list" className={styles.reports}>
            {reports.map((report) => (
              <li key={report.scale} className={styles.report}>
                <span className={styles.scale}>{report.scale}</span>
                <span className={styles.reportText}>
                  <span className={styles.reportPlaces}>{report.places.join(', ')}</span>
                  <span className={`kk-small ${styles.muted}`}>{mmiMeaning(report.level)}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className={`kk-small ${styles.muted}`}>
            {t('Angka romawi adalah skala MMI, seberapa kuat getaran terasa di tempat itu, bukan magnitudo.')}{' '}
            <a href={BMKG_MMI_PAGE} target="_blank" rel="noreferrer noopener">
              {t('Arti skala MMI menurut BMKG')}
            </a>
          </p>
        </>
      )}
    </section>
  );
}
