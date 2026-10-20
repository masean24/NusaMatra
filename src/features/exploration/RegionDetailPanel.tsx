import { Chip } from '@/components/ui/Chip/Chip';
import { Surface } from '@/components/ui/Surface/Surface';
import {
  ResourceView,
  adminLevelLabel,
  categoryLabel,
  describeObservation,
  formatDecimalId,
  publicHttpUrl,
  useDataHubResource,
} from '@/features/data-hub';
import type {
  RegionCompositeScoresSummaryDTO,
  RegionProfileDTO,
  RegionProfileIndicatorValueDTO,
} from '@/services/api';
import styles from './RegionDetailPanel.module.css';

const COMPOSITE_LABELS: readonly {
  readonly key: keyof RegionCompositeScoresSummaryDTO;
  readonly label: string;
}[] = [
  { key: 'overallPriorityIndex', label: 'Indeks prioritas keseluruhan' },
  { key: 'disasterRisk', label: 'Risiko bencana' },
  { key: 'socioeconomic', label: 'Sosial ekonomi' },
  { key: 'educationAccess', label: 'Akses pendidikan' },
  { key: 'healthcareAccess', label: 'Akses kesehatan' },
  { key: 'infrastructure', label: 'Infrastruktur' },
  { key: 'dataReliability', label: 'Keandalan data' },
];

function groupByCategory(
  indicators: readonly RegionProfileIndicatorValueDTO[],
): readonly (readonly [string, readonly RegionProfileIndicatorValueDTO[]])[] {
  const groups = new Map<string, RegionProfileIndicatorValueDTO[]>();
  for (const indicator of indicators) {
    const group = groups.get(indicator.category) ?? [];
    group.push(indicator);
    groups.set(indicator.category, group);
  }
  return [...groups.entries()];
}

interface RegionDetailPanelProps {
  readonly regionId: string | null;
}

/** Profile of one Data Hub region: identity, simulated composite scores and every indicator with its source. */
export function RegionDetailPanel({ regionId }: RegionDetailPanelProps) {
  const detail = useDataHubResource(
    regionId ?? '',
    (repository, dataMode, signal) =>
      repository.getRegionDetail({ dataMode, regionId: regionId ?? '', signal }),
    regionId !== null,
  );

  return (
    <Surface radius="card" className={styles.panel} aria-live="polite">
      <h2 className="kk-h3">Profil wilayah</h2>
      {regionId === null ? (
        <p className="kk-body">Pilih wilayah pada daftar untuk melihat profil dan indikatornya.</p>
      ) : (
        <ResourceView state={detail.state} onRetry={detail.retry} loadingTitle="Memuat profil wilayah…">
          {(envelope) => <RegionProfile profile={envelope.data} />}
        </ResourceView>
      )}
    </Surface>
  );
}

function RegionProfile({ profile }: { readonly profile: RegionProfileDTO }) {
  const { region, compositeScores, indicators } = profile;
  const publicIdentifiers = region.identifiers
    .map(({ codeSystem, code }) => `${codeSystem} ${code}`)
    .join(' · ');

  return (
    <>
      <header className={styles.header}>
        <h3 className="kk-h2">{region.displayName}</h3>
        <p className={`kk-small ${styles.muted}`}>
          {adminLevelLabel(region.adminLevel)} · {region.provinceName ?? 'provinsi tidak diketahui'}
          {region.islandGroup ? ` · ${region.islandGroup}` : ''}
          {region.areaKm2 !== null ? ` · ${formatDecimalId(String(region.areaKm2))} km²` : ''}
        </p>
        {publicIdentifiers && <p className={`kk-small ${styles.muted}`}>Kode: {publicIdentifiers}</p>}
        {region.isSyntheticDemoName && <Chip tone="warning">Nama sintetis (DEMO), bukan nama resmi</Chip>}
      </header>

      {compositeScores && (
        <section aria-labelledby="skor-komposit">
          <h4 id="skor-komposit" className="kk-body-strong">
            Skor komposit simulasi (0–100)
          </h4>
          <dl className={styles.scores}>
            {COMPOSITE_LABELS.map(({ key, label }) => {
              const score = compositeScores[key];
              return (
                <div key={key} className={styles.score}>
                  <dt className="kk-small">{label}</dt>
                  <dd className="kk-body-strong">
                    {score === null ? 'Data belum tersedia' : formatDecimalId(score)}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      )}

      <section aria-labelledby="indikator-wilayah" className={styles.indicators}>
        <h4 id="indikator-wilayah" className="kk-body-strong">
          Indikator ({indicators.length})
        </h4>
        {indicators.length === 0 && (
          <p className="kk-body">Data Hub tidak mengirim indikator untuk wilayah ini.</p>
        )}
        {groupByCategory(indicators).map(([category, items]) => (
          <div key={category} className={styles.group}>
            <h5 className={`kk-small ${styles.groupTitle}`}>{categoryLabel(category)}</h5>
            <ul role="list" className={styles.rows}>
              {items.map((item) => (
                <IndicatorRow key={item.indicatorId} item={item} />
              ))}
            </ul>
          </div>
        ))}
      </section>
    </>
  );
}

function IndicatorRow({ item }: { readonly item: RegionProfileIndicatorValueDTO }) {
  const sourceUrl = publicHttpUrl(item.provenance.officialUrl);
  const hasValue = item.value.status === 'AVAILABLE';

  return (
    <li className={styles.row}>
      <span className="kk-body">{item.indicatorName}</span>
      <span className={styles.value}>
        <strong className="kk-body-strong" data-missing={hasValue ? undefined : true}>
          {describeObservation(item.value)}
        </strong>
        {hasValue && item.unit && <span className={`kk-small ${styles.muted}`}> {item.unit}</span>}
      </span>
      <span className={`kk-small ${styles.muted} ${styles.meta}`}>
        {item.referenceYear === null ? 'Periode belum tersedia' : `Tahun ${String(item.referenceYear)}`}
        {item.nationalRank !== null ? ` · peringkat nasional ${String(item.nationalRank)}` : ''}
        {' · Sumber: '}
        {sourceUrl ? (
          <a href={sourceUrl} target="_blank" rel="noreferrer noopener">
            {item.provenance.agencyCode}
          </a>
        ) : (
          item.provenance.agencyCode
        )}
      </span>
      {item.isDemoExample && (
        <span className={styles.badge}>
          <Chip tone="warning">DEMO_EXAMPLE</Chip>
        </span>
      )}
    </li>
  );
}
