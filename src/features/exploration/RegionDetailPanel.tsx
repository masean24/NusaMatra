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
  useDataHub,
  useDataHubResource,
} from '@/features/data-hub';
import { passportHref } from '@/features/evidence-passport';
import { ApiError, type RegionProfileDTO } from '@/services/api';
import { buildRegionInsight, type EvidenceSource, type InsightIndicator } from './regionInsight';
import styles from './RegionDetailPanel.module.css';

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
      <p className="kk-body">Pilih wilayah di peta atau dari daftar untuk melihat profil dan indikatornya.</p>
    );
  }

  const profile = detail.state.status === 'success' ? detail.state.data.data : null;
  const name = profile?.region.displayName ?? fallbackName ?? `Wilayah kode ${regionId}`;

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.headline}>
          <h2 className="kk-h3" aria-live="polite" tabIndex={-1} data-panel-heading>
            {name}
          </h2>
          {onClose && (
            <Button variant="secondary" onClick={onClose}>
              Tutup profil
            </Button>
          )}
        </div>
        <p className={`kk-small ${styles.muted}`}>
          {profile
            ? describeRegion(profile)
            : detail.state.status === 'loading'
              ? `Kode ${regionId} · memuat provinsi dan indikator…`
              : `Kode ${regionId}`}
        </p>
        <DataStatus
          dataMode={dataMode}
          snapshotId={detail.state.status === 'success' ? detail.state.data.meta.snapshotId : null}
        />
      </header>

      {isNotFound(detail.state) ? (
        <StatusMessage
          kind="unavailable"
          title="Wilayah tidak ditemukan"
          action={
            onClose && (
              <Button variant="secondary" onClick={onClose}>
                Pilih wilayah lain
              </Button>
            )
          }
        >
          Kode {regionId} tidak ada pada snapshot data ini. Tautan mungkin berasal dari mode data lain atau
          dari kode yang keliru.
        </StatusMessage>
      ) : (
        <ResourceView state={detail.state} onRetry={detail.retry} loadingTitle="Memuat indikator wilayah…">
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
              />
            ) : (
              <StatusMessage kind="error" title="Data wilayah tidak cocok">
                Data Hub menjawab untuk kode {envelope.data.region.regionId}, bukan {regionId}, jadi profil
                tidak ditampilkan.
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
    region.provinceName ?? 'provinsi tidak diketahui',
    ...(region.islandGroup && !region.provinceName?.endsWith(region.islandGroup) ? [region.islandGroup] : []),
    ...(region.areaKm2 === null
      ? []
      : [
          region.areaKm2 > 0
            ? `${formatDecimalId(String(region.areaKm2))} km²`
            : 'luas wilayah dari sumber tidak valid (0 km²)',
        ]),
  ];
  const codes = region.identifiers.map(({ codeSystem, code }) => `${codeSystem} ${code}`).join(' · ');
  return codes ? `${parts.join(' · ')} · kode ${codes}` : parts.join(' · ');
}

function DataStatus({
  dataMode,
  snapshotId,
}: {
  readonly dataMode: 'DEMO' | 'LIVE';
  readonly snapshotId: string | null;
}) {
  return dataMode === 'LIVE' ? (
    <p className={`kk-small ${styles.status}`}>
      <Chip>Data resmi LIVE</Chip>
      {snapshotId && <span className={styles.muted}>snapshot {snapshotId}</span>}
    </p>
  ) : (
    <p className={`kk-small ${styles.status}`}>
      <Chip tone="warning">Data simulasi (DEMO)</Chip>
      <span className={styles.muted}>nama dan angka bukan data resmi</span>
    </p>
  );
}

function ProfileBody({
  profile,
  passportTo,
  catalog,
}: {
  readonly profile: RegionProfileDTO;
  /** Link to the Paspor Bukti of exactly this loaded profile. */
  readonly passportTo: string;
  readonly catalog: Parameters<typeof buildRegionInsight>[1];
}) {
  const insight = buildRegionInsight(profile, catalog);
  const { region } = profile;

  if (insight.indicatorCount === 0) {
    return (
      <p className="kk-body">
        Belum ada data indikator untuk wilayah ini pada snapshot ini. Wilayahnya terdaftar, tetapi Data Hub
        belum memuat datanya, jadi wilayah ini tidak ikut dalam perbandingan dan peringkat.
      </p>
    );
  }

  return (
    <>
      {region.isSyntheticDemoName && <Chip tone="warning">Nama sintetis (DEMO), bukan nama resmi</Chip>}

      <section aria-labelledby="ringkasan-wilayah" className={styles.section}>
        <h3 id="ringkasan-wilayah" className="kk-body-strong">
          Ringkasan
        </h3>
        <ul role="list" className={styles.summary}>
          {insight.summary.map((indicator) => (
            <li key={indicator.id} className={styles.card}>
              <p className={`kk-small ${styles.muted}`}>{indicator.label}</p>
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
              <p className={`kk-small ${styles.muted}`}>{indicator.reading.explanation}</p>
            </li>
          ))}
        </ul>
        <p className={`kk-small ${styles.muted}`}>
          Penilaian membandingkan wilayah ini dengan wilayah lain yang datanya tersedia, satu indikator sekali
          waktu. Itu bukan penilaian atas seluruh kondisi wilayah.
        </p>
      </section>

      <section aria-labelledby="indikator-wilayah" className={styles.section}>
        <h3 id="indikator-wilayah" className="kk-body-strong">
          Semua indikator ({insight.indicatorCount})
        </h3>
        {insight.groups.map(([category, items]) => (
          <details key={category} className={styles.group}>
            <summary className={styles.groupSummary}>
              <span className="kk-body-strong">{categoryLabel(category)}</span>
              <span className={`kk-small ${styles.muted}`}>{items.length} indikator</span>
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

      <section aria-labelledby="bukti-wilayah" className={styles.section}>
        <h3 id="bukti-wilayah" className="kk-body-strong">
          Bukti dan sumber
        </h3>
        <ul role="list" className={styles.evidence}>
          {insight.evidence.map((source) => (
            <EvidenceItem key={source.datasetId} source={source} />
          ))}
        </ul>
        <p className={`kk-small ${styles.muted}`}>
          Data Hub belum menerbitkan dokumen metodologi per indikator; rumus turunan tertera pada rincian
          indikator bila ada. Nilai asli selalu ditampilkan apa adanya, terpisah dari skor ternormalisasi.
        </p>
        <Link to={passportTo} className={styles.link}>
          Buka Paspor Bukti
        </Link>
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
            <p className={`kk-small ${styles.muted}`}>Arti: {indicator.definition}</p>
          )}
          {indicator.derivationFormula && (
            <p className={`kk-small ${styles.muted}`}>Rumus turunan: {indicator.derivationFormula}</p>
          )}
          {qualityNote && <Chip tone="warning">{qualityNote}</Chip>}
          {indicator.unit.warning && <Chip tone="warning">Satuan dari sumber tidak konsisten</Chip>}
          {indicator.unit.warning && <p className={`kk-small ${styles.muted}`}>{indicator.unit.warning}</p>}

          <dl className={styles.facts}>
            <div>
              <dt>Nilai asli (dari sumber)</dt>
              <dd>
                {indicator.valueText}
                {indicator.hasValue && indicator.unit.label ? ` ${indicator.unit.label}` : ''}
              </dd>
            </div>
            {indicator.normalizedScore !== null && (
              <div>
                <dt>Skor ternormalisasi (0–100; 100 = kondisi relatif terbaik)</dt>
                <dd>{formatDecimalId(indicator.normalizedScore)}</dd>
              </div>
            )}
            {indicator.percentile !== null && (
              <div>
                <dt>Lebih baik daripada wilayah lain (persentil)</dt>
                <dd>{formatDecimalId(indicator.percentile)}%</dd>
              </div>
            )}
            {indicator.nationalRank !== null && (
              <div>
                <dt>Peringkat dari Data Hub</dt>
                <dd>{indicator.nationalRank} (dasar penghitungan peringkat belum dijelaskan)</dd>
              </div>
            )}
            <div>
              <dt>Tahun data</dt>
              <dd>{indicator.referenceYear === null ? 'belum tersedia' : indicator.referenceYear}</dd>
            </div>
            <div>
              <dt>Sumber</dt>
              <dd>
                {sourceUrl ? (
                  <a href={sourceUrl} target="_blank" rel="noreferrer noopener">
                    {indicator.agencyCode}
                  </a>
                ) : (
                  indicator.agencyCode
                )}
                {indicator.datasetTitle ? ` · ${indicator.datasetTitle}` : ''}
              </dd>
            </div>
          </dl>
        </div>
      </details>
    </li>
  );
}

function EvidenceItem({ source }: { readonly source: EvidenceSource }) {
  const url = publicHttpUrl(source.portalUrl);
  const years =
    source.years.length === 0
      ? 'tahun belum tersedia'
      : source.years.length === 1
        ? `tahun ${String(source.years[0])}`
        : `tahun ${String(source.years[0])}–${String(source.years[source.years.length - 1])}`;
  return (
    <li className={styles.evidenceItem}>
      <span className="kk-body-strong">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer noopener">
            {source.agencyCode}
          </a>
        ) : (
          source.agencyCode
        )}
      </span>
      <span className={`kk-small ${styles.muted}`}>
        {source.datasetTitle ?? source.datasetId} · {years} · {source.indicatorCount} indikator
      </span>
    </li>
  );
}
