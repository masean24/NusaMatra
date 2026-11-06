import { Link } from 'react-router';
import { StatusMessage } from '@/components/feedback/StatusMessage';
import { Button } from '@/components/ui/Button/Button';
import { Chip } from '@/components/ui/Chip/Chip';
import { ConditionBadge, type ConditionTone } from '@/components/ui/ConditionBadge/ConditionBadge';
import { polarityReading, type ConditionVerdict } from '@/domain/indicators';
import {
  ResourceView,
  adminLevelLabel,
  categoryLabel,
  formatDecimalId,
  publicHttpUrl,
  qualityFlagNote,
  sourceLinkName,
  sourceVerificationLabel,
  useDataHub,
  useDataHubResource,
} from '@/features/data-hub';
import { passportHref } from '@/features/evidence-passport';
import { ApiError, type RegionProfileDTO } from '@/services/api';
import { buildRegionInsight, type InsightIndicator } from './regionInsight';
import styles from './RegionDetailPanel.module.css';
import { t } from '@/lib/i18n';

const TONE_OF: Readonly<Record<ConditionVerdict, ConditionTone>> = {
  FAVORABLE: 'positive',
  UNFAVORABLE: 'negative',
  NEUTRAL: 'neutral',
  NO_JUDGEMENT: 'unknown',
};

interface RegionDetailPanelProps {
  readonly regionId: string | null;
  /** Name known before the profile arrives (from the map or the list), so the panel never waits to say where you are. */
  readonly fallbackName?: string | null;
  /** Clears the selection (the panel goes back to search). */
  readonly onClose?: (() => void) | undefined;
}

/**
 * Profile of one Data Hub region: identity and data status first, a short summary in plain words,
 * then indicators by theme with their meaning, and finally the evidence behind them.
 */
export function RegionDetailPanel({ regionId, fallbackName = null, onClose }: RegionDetailPanelProps) {
  const { dataMode } = useDataHub();
  const detail = useDataHubResource(
    regionId ?? '',
    (repository, mode, signal) =>
      repository.getRegionDetail({ dataMode: mode, regionId: regionId ?? '', signal }),
    regionId !== null,
  );
  const catalog = useDataHubResource(
    'catalog',
    (repository, mode, signal) => repository.getIndicatorCatalog({ dataMode: mode, signal }),
    regionId !== null,
  );

  if (regionId === null) {
    return (
      <p className="kk-body">
        {t('Pilih wilayah di peta atau dari daftar untuk melihat profil dan indikatornya.')}
      </p>
    );
  }

  const profile = detail.state.status === 'success' ? detail.state.data.data : null;
  const name = profile?.region.displayName ?? fallbackName ?? t('Wilayah kode {0}', regionId);

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.headline}>
          <h2 className="kk-h3" aria-live="polite" tabIndex={-1} data-panel-heading>
            {name}
          </h2>
          {onClose && (
            <Button variant="secondary" onClick={onClose}>
              {t('Tutup profil')}
            </Button>
          )}
        </div>
        <p className={`kk-small ${styles.muted}`}>
          {profile
            ? describeRegion(profile)
            : detail.state.status === 'loading'
              ? t('Kode {0}, memuat provinsi dan indikator…', regionId)
              : t('Kode {0}', regionId)}
        </p>
        <DataStatus dataMode={dataMode} />
      </header>

      {isNotFound(detail.state) ? (
        <StatusMessage
          kind="unavailable"
          title={t('Wilayah tidak ditemukan')}
          action={
            onClose && (
              <Button variant="secondary" onClick={onClose}>
                {t('Pilih wilayah lain')}
              </Button>
            )
          }
        >
          {t(
            'Kode {0} tidak ada pada versi data ini. Tautan mungkin berasal dari mode data lain atau dari kode yang keliru.',
            regionId,
          )}
        </StatusMessage>
      ) : (
        <ResourceView
          state={detail.state}
          onRetry={detail.retry}
          loadingTitle={t('Memuat indikator wilayah…')}
        >
          {(envelope) =>
            // Never show another region's numbers under this region's name.
            envelope.data.region.regionId === regionId ? (
              <ProfileBody
                profile={envelope.data}
                // Mode and snapshot are those of the response being shown, not of the URL or app state.
                passportTo={passportHref({
                  kind: 'wilayah',
                  regionId: envelope.data.region.regionId,
                  mode: envelope.meta.dataMode,
                  snapshotId: envelope.meta.snapshotId,
                })}
                catalog={catalog.state.status === 'success' ? catalog.state.data.data : null}
                scoreDirection={envelope.meta.scoreDirection}
              />
            ) : (
              <StatusMessage kind="error" title={t('Data wilayah tidak cocok')}>
                {t(
                  'Data Hub menjawab untuk kode {0}, bukan {1}, jadi profil tidak ditampilkan.',
                  envelope.data.region.regionId,
                  regionId,
                )}
              </StatusMessage>
            )
          }
        </ResourceView>
      )}
    </div>
  );
}

function isNotFound(state: { readonly status: string; readonly error?: unknown }): boolean {
  return state.status === 'error' && state.error instanceof ApiError && state.error.status === 404;
}

function describeRegion(profile: RegionProfileDTO): string {
  const { region } = profile;
  const parts = [
    adminLevelLabel(region.adminLevel),
    region.provinceName ?? t('provinsi tidak diketahui'),
    ...(region.islandGroup && !region.provinceName?.endsWith(region.islandGroup) ? [region.islandGroup] : []),
    ...(region.areaKm2 === null
      ? []
      : [
          region.areaKm2 > 0
            ? `${formatDecimalId(String(region.areaKm2))} km²`
            : t('luas wilayah dari sumber tidak valid (0 km²)'),
        ]),
  ];
  const codes = region.identifiers.map(({ codeSystem, code }) => `${codeSystem} ${code}`).join(', ');
  return codes ? t('{0}, kode {1}', parts.join(', '), codes) : parts.join(', ');
}

function DataStatus({ dataMode }: { readonly dataMode: 'DEMO' | 'LIVE' }) {
  return dataMode === 'LIVE' ? (
    <p className={`kk-small ${styles.status}`}>
      <Chip>{t('Data resmi')}</Chip>
    </p>
  ) : (
    <p className={`kk-small ${styles.status}`}>
      <Chip tone="warning">{t('Data simulasi (DEMO)')}</Chip>
      <span className={styles.muted}>{t('nama dan angka bukan data resmi')}</span>
    </p>
  );
}

function ProfileBody({
  profile,
  passportTo,
  catalog,
  scoreDirection,
}: {
  readonly profile: RegionProfileDTO;
  /** Link to the Paspor Bukti of exactly this loaded profile. */
  readonly passportTo: string;
  readonly catalog: Parameters<typeof buildRegionInsight>[1];
  /** The profile response's meta.score_direction: what its percentiles mean. */
  readonly scoreDirection: string | null;
}) {
  const insight = buildRegionInsight(profile, catalog, scoreDirection);
  const { region } = profile;

  if (insight.indicatorCount === 0) {
    return (
      <p className="kk-body">
        {t(
          'Belum ada data indikator untuk wilayah ini pada versi data ini. Wilayahnya terdaftar, tetapi Data Hub belum memuat datanya, jadi wilayah ini tidak ikut dalam perbandingan dan peringkat.',
        )}
      </p>
    );
  }

  return (
    <>
      {region.isSyntheticDemoName && (
        <Chip tone="warning">{t('Nama sintetis (DEMO), bukan nama resmi')}</Chip>
      )}

      {/*
       * The way to the evidence, first and in the accent colour (owner revision 2026-10-28): the
       * Paspor Bukti holds the sources, years and limitations, so the panel no longer repeats them.
       */}
      <Link to={passportTo} className={styles.passportCard}>
        <span className={styles.passportText}>
          <span className="kk-body-strong">{t('Paspor Bukti wilayah ini')}</span>
          <span className="kk-small">{t('Sumber, tahun data, dan batasan setiap angka')}</span>
        </span>
        <span className={styles.passportArrow} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
            <path
              d="M4.5 12h15M13 5.5l6.5 6.5-6.5 6.5"
              stroke="currentColor"
              strokeWidth="3.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </Link>

      <section aria-labelledby="ringkasan-wilayah" className={styles.section}>
        <h3 id="ringkasan-wilayah" className="kk-body-strong">
          {t('Ringkasan')}
        </h3>
        <ul role="list" className={styles.summary}>
          {/* The essentials only: what is measured, its value and the verdict; the reasoning behind
              the verdict stays in each indicator's details below. */}
          {insight.summary.map((indicator) => (
            <li key={indicator.id} className={styles.card}>
              <p className={styles.cardTitle}>{indicator.label}</p>
              <p className={styles.bigValue}>
                {indicator.valueText}
                {indicator.unit.label ? (
                  <span className={`kk-small ${styles.muted}`}> {indicator.unit.label}</span>
                ) : null}
              </p>
              <ConditionBadge tone={TONE_OF[indicator.reading.verdict]}>
                {indicator.reading.label}
              </ConditionBadge>
              {indicator.isDemoExample && <Chip tone="warning">DEMO_EXAMPLE</Chip>}
            </li>
          ))}
        </ul>
        <p className={`kk-small ${styles.muted} ${styles.justified}`}>
          {t(
            'Penilaian membandingkan wilayah ini dengan wilayah lain yang datanya tersedia, satu indikator sekali waktu. Itu bukan penilaian atas seluruh kondisi wilayah.',
          )}
        </p>
      </section>

      <section aria-labelledby="indikator-wilayah" className={styles.section}>
        <h3 id="indikator-wilayah" className="kk-body-strong">
          {t('Semua indikator ({0})', insight.indicatorCount)}
        </h3>
        {insight.groups.map(([category, items]) => (
          <details key={category} className={styles.group}>
            <summary className={styles.groupSummary}>
              <span className="kk-body-strong">{categoryLabel(category)}</span>
              <span className={`kk-small ${styles.muted}`}>{t('{0} indikator', items.length)}</span>
            </summary>
            <ul role="list" className={styles.rows}>
              {items.map((indicator) => (
                <IndicatorItem
                  key={indicator.id}
                  indicator={indicator}
                  polarity={polarityOf(catalog, indicator.id)}
                />
              ))}
            </ul>
          </details>
        ))}
      </section>
    </>
  );
}

function polarityOf(catalog: Parameters<typeof buildRegionInsight>[1], indicatorId: string): string {
  return catalog?.items.find((item) => item.indicatorId === indicatorId)?.polarity ?? 'unknown';
}

function IndicatorItem({
  indicator,
  polarity,
}: {
  readonly indicator: InsightIndicator;
  readonly polarity: string;
}) {
  const sourceUrl = publicHttpUrl(indicator.sourceUrl);
  const verification = sourceVerificationLabel(indicator.sourceVerification);
  const qualityNote = qualityFlagNote(indicator.qualityFlag);
  const direction = polarityReading(polarity);

  return (
    <li>
      <details className={styles.item}>
        <summary className={styles.itemSummary}>
          <span className={styles.itemName}>{indicator.label}</span>
          <span className={styles.itemValue}>
            <strong data-missing={indicator.hasValue ? undefined : true}>{indicator.valueText}</strong>
            {indicator.hasValue && indicator.unit.label ? (
              <span className={`kk-small ${styles.muted}`}> {indicator.unit.label}</span>
            ) : null}
          </span>
          <span className={styles.itemBadge}>
            <ConditionBadge tone={TONE_OF[indicator.reading.verdict]}>
              {indicator.reading.label}
            </ConditionBadge>
            {indicator.isDemoExample && <Chip tone="warning">DEMO_EXAMPLE</Chip>}
          </span>
        </summary>

        <div className={styles.detail}>
          <p className="kk-small">{indicator.reading.explanation}</p>
          {direction && <p className={`kk-small ${styles.muted}`}>{direction}</p>}
          {indicator.definition && indicator.definition !== indicator.label && (
            <p className={`kk-small ${styles.muted}`}>{t('Arti: {0}', indicator.definition)}</p>
          )}
          {indicator.derivationFormula && (
            <p className={`kk-small ${styles.muted}`}>
              {t('Rumus turunan: {0}', indicator.derivationFormula)}
            </p>
          )}
          {qualityNote && <Chip tone="warning">{qualityNote}</Chip>}
          {indicator.unit.warning && <Chip tone="warning">{t('Satuan dari sumber tidak konsisten')}</Chip>}
          {indicator.unit.warning && <p className={`kk-small ${styles.muted}`}>{indicator.unit.warning}</p>}

          <dl className={styles.facts}>
            <div>
              <dt>{t('Nilai asli (dari sumber)')}</dt>
              <dd>
                {indicator.valueText}
                {indicator.hasValue && indicator.unit.label ? ` ${indicator.unit.label}` : ''}
              </dd>
            </div>
            {indicator.normalizedScore !== null && (
              <div>
                <dt>{t('Skor ternormalisasi (0–100; makin tinggi, makin membutuhkan)')}</dt>
                <dd>{formatDecimalId(indicator.normalizedScore)}</dd>
              </div>
            )}
            {indicator.percentile !== null && (
              <div>
                <dt>{t('Persentil nasional dari Data Hub')}</dt>
                <dd>{t('{0} (arah persentil belum dijelaskan)', formatDecimalId(indicator.percentile))}</dd>
              </div>
            )}
            {indicator.nationalRank !== null && (
              <div>
                <dt>{t('Peringkat dari Data Hub')}</dt>
                <dd>{t('{0} (dasar penghitungan peringkat belum dijelaskan)', indicator.nationalRank)}</dd>
              </div>
            )}
            <div>
              <dt>{t('Tahun data')}</dt>
              <dd>{indicator.referenceYear === null ? t('belum tersedia') : indicator.referenceYear}</dd>
            </div>
            <div>
              <dt>{t('Sumber')}</dt>
              <dd>
                {sourceUrl ? (
                  <a href={sourceUrl} target="_blank" rel="noreferrer noopener">
                    {indicator.agencyCode}
                  </a>
                ) : (
                  indicator.agencyCode
                )}
                {indicator.datasetTitle ? `, ${indicator.datasetTitle}` : ''}
                {sourceUrl && ` (${sourceLinkName(indicator.sourceLinkLevel)})`}
                {verification && `. ${verification}.`}
              </dd>
            </div>
          </dl>
        </div>
      </details>
    </li>
  );
}
