import { useState } from 'react';
import { Chip } from '@/components/ui/Chip/Chip';
import { Surface } from '@/components/ui/Surface/Surface';
import {
  ResourceView,
  categoryLabel,
  describeObservation,
  formatDecimalId,
  preferredDirectionLabel,
  publicHttpUrl,
  qualityFlagNote,
  useDataHubResource,
} from '@/features/data-hub';
import type {
  AdaptedEnvelope,
  DataHubIndicatorDTO,
  IndicatorCatalogDTO,
  IndicatorValuesMapDTO,
  RegionIndicatorMeasurementDTO,
} from '@/services/api';

type IndicatorValuesEnvelope = AdaptedEnvelope<IndicatorValuesMapDTO>;
import styles from './IndicatorPanel.module.css';

/** Opened first when the catalog has it; otherwise the first indicator the Data Hub lists. */
const PREFERRED_INDICATOR_ID = 'soc_poverty_rate';

const STATS_LABELS = [
  ['min', 'Terendah'],
  ['median', 'Median'],
  ['mean', 'Rata-rata'],
  ['max', 'Tertinggi'],
] as const;

function pickIndicator(catalog: IndicatorCatalogDTO, chosenId: string | null): DataHubIndicatorDTO | null {
  const byId = (id: string | null) => catalog.items.find((item) => item.indicatorId === id);
  return byId(chosenId) ?? byId(PREFERRED_INDICATOR_ID) ?? catalog.items[0] ?? null;
}

interface IndicatorPanelProps {
  /** The region chosen in the list, whose value for the indicator is shown. */
  readonly regionId: string | null;
  /** Inside another panel (the Jelajahi sidebar): no card of its own. */
  readonly embedded?: boolean;
}

/**
 * Indicator explorer: which indicator, its value for the chosen region with year, unit, source and
 * quality, then the definition, formula and national statistics on demand.
 */
export function IndicatorPanel({ regionId, embedded = false }: IndicatorPanelProps) {
  const catalog = useDataHubResource('catalog', (repository, dataMode, signal) =>
    repository.getIndicatorCatalog({ dataMode, signal }),
  );
  const [chosenId, setChosenId] = useState<string | null>(null);
  const Frame = embedded ? 'section' : Surface;
  const frameProps = embedded
    ? { className: styles.embedded, 'aria-labelledby': 'indikator-judul' }
    : { radius: 'card' as const, className: styles.panel };

  return (
    <Frame {...frameProps}>
      <h2 id="indikator-judul" className={embedded ? 'kk-body-strong' : 'kk-h3'}>
        Indikator
      </h2>
      <ResourceView state={catalog.state} onRetry={catalog.retry} loadingTitle="Memuat katalog indikator…">
        {(envelope) => {
          const indicator = pickIndicator(envelope.data, chosenId);
          if (!indicator) return <p className="kk-body">Katalog indikator dari Data Hub kosong.</p>;
          return (
            <>
              <div className={styles.picker}>
                <label htmlFor="indikator-pilihan" className="kk-body-strong">
                  Pilih indikator
                </label>
                <select
                  id="indikator-pilihan"
                  className={styles.select}
                  value={indicator.indicatorId}
                  onChange={(event) => {
                    setChosenId(event.target.value);
                  }}
                >
                  {envelope.data.categories.map((category) => (
                    <optgroup key={category} label={categoryLabel(category)}>
                      {(envelope.data.byCategory[category] ?? []).map((item) => (
                        <option key={item.indicatorId} value={item.indicatorId}>
                          {item.labelId}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <IndicatorDetail indicator={indicator} regionId={regionId} />
            </>
          );
        }}
      </ResourceView>
    </Frame>
  );
}

/**
 * The catalog does not carry a reference year; the values response does. Until it arrives the
 * definition says the period is not yet known rather than guessing one.
 */
function IndicatorDetail({
  indicator,
  regionId,
}: {
  readonly indicator: DataHubIndicatorDTO;
  readonly regionId: string | null;
}) {
  const values = useDataHubResource(indicator.indicatorId, (repository, dataMode, signal) =>
    repository.getIndicatorValues({ dataMode, indicatorId: indicator.indicatorId, signal }),
  );
  const referenceYear =
    indicator.referenceYear ??
    (values.state.status === 'success' ? values.state.data.data.indicator.referenceYear : null);

  return (
    <>
      <IndicatorHeading indicator={indicator} referenceYear={referenceYear} />
      <IndicatorRegionValue
        indicator={indicator}
        referenceYear={referenceYear}
        regionId={regionId}
        values={values}
      />
      <IndicatorDefinition indicator={indicator} />
    </>
  );
}

/** The indicator's name, then the facts needed to read any value: theme, unit, direction and year. */
function IndicatorHeading({
  indicator,
  referenceYear,
}: {
  readonly indicator: DataHubIndicatorDTO;
  readonly referenceYear: number | null;
}) {
  return (
    <div className={styles.definition}>
      <h3 className="kk-body-strong">{indicator.labelId}</h3>
      <p className={`kk-small ${styles.muted}`}>
        {categoryLabel(indicator.category)} · satuan: {indicator.unitCode || 'tidak dicantumkan'} ·{' '}
        {preferredDirectionLabel(indicator.preferredDirection)}
        {referenceYear !== null ? ` · tahun ${String(referenceYear)}` : ' · periode belum tersedia'}
      </p>
    </div>
  );
}

/** Formula, source and national statistics: kept, but one step away from the value. */
function IndicatorDefinition({ indicator }: { readonly indicator: DataHubIndicatorDTO }) {
  const portalUrl = publicHttpUrl(indicator.provenance.officialPortalUrl);
  return (
    <details className={styles.more}>
      <summary className={styles.moreSummary}>
        <span className="kk-small">Definisi, sumber, dan statistik nasional</span>
      </summary>
      <section aria-label="Definisi indikator" className={styles.definition}>
        {indicator.derivationFormula && (
          <p className={`kk-small ${styles.muted}`}>Rumus turunan: {indicator.derivationFormula}</p>
        )}
        <p className={`kk-small ${styles.muted}`}>
          Sumber: {indicator.provenance.agencyCode}
          {indicator.provenance.datasetTitle ? ` · ${indicator.provenance.datasetTitle}` : ''}
          {portalUrl && (
            <>
              {' · '}
              <a href={portalUrl} target="_blank" rel="noreferrer noopener">
                portal sumber
              </a>
            </>
          )}
        </p>
        {indicator.stats && (
          <dl className={styles.stats}>
            {STATS_LABELS.map(([key, label]) => {
              const value = indicator.stats?.[key] ?? null;
              return value === null ? null : (
                <div key={key} className={styles.stat}>
                  <dt className="kk-small">{label}</dt>
                  <dd className="kk-body-strong">{formatDecimalId(value)}</dd>
                </div>
              );
            })}
          </dl>
        )}
      </section>
    </details>
  );
}

function IndicatorRegionValue({
  indicator,
  referenceYear,
  regionId,
  values,
}: {
  readonly indicator: DataHubIndicatorDTO;
  readonly referenceYear: number | null;
  readonly regionId: string | null;
  readonly values: ReturnType<typeof useDataHubResource<IndicatorValuesEnvelope>>;
}) {
  return (
    <section aria-label="Nilai pada wilayah terpilih" className={styles.value}>
      <h3 className="kk-body-strong">Nilai pada wilayah terpilih</h3>
      {regionId === null ? (
        <p className="kk-body">Pilih wilayah pada daftar untuk melihat nilainya.</p>
      ) : (
        <ResourceView state={values.state} onRetry={values.retry} loadingTitle="Memuat nilai indikator…">
          {(envelope) => {
            if (Object.keys(envelope.data.valuesByRegion).length === 0) {
              return (
                <p className="kk-body">
                  Data Hub tidak memuat nilai untuk indikator ini pada snapshot {envelope.data.snapshotId}.
                  Indikatornya terdaftar di katalog, tetapi belum ada datanya.
                </p>
              );
            }
            const cell = envelope.data.valuesByRegion[regionId];
            return cell ? (
              <MeasurementCard
                cell={cell}
                unit={indicator.unitCode}
                referenceYear={referenceYear}
                agencyCode={indicator.provenance.agencyCode}
              />
            ) : (
              <p className="kk-body">Wilayah kode {regionId} tidak ada dalam respons indikator ini.</p>
            );
          }}
        </ResourceView>
      )}
    </section>
  );
}

function MeasurementCard({
  cell,
  unit,
  referenceYear,
  agencyCode,
}: {
  readonly cell: RegionIndicatorMeasurementDTO;
  readonly unit: string;
  readonly referenceYear: number | null;
  readonly agencyCode: string;
}) {
  const qualityNote = qualityFlagNote(cell.qualityFlag);
  return (
    <div className={styles.measurement}>
      <p className="kk-h2">
        {describeObservation(cell.value)}
        {cell.value.status === 'AVAILABLE' && unit ? (
          <span className={`kk-small ${styles.muted}`}> {unit}</span>
        ) : null}
      </p>
      <p className={`kk-small ${styles.muted}`}>
        {cell.rank !== null ? `Peringkat ${String(cell.rank)}` : 'Peringkat belum tersedia'}
        {cell.percentileDecimal !== null ? ` · persentil ${formatDecimalId(cell.percentileDecimal)}` : ''}
        {cell.normalizedScoreDecimal !== null
          ? ` · skor ternormalisasi ${formatDecimalId(cell.normalizedScoreDecimal)}`
          : ''}
      </p>
      <p className={`kk-small ${styles.muted}`}>
        {referenceYear === null ? 'Periode belum tersedia' : `Tahun ${String(referenceYear)}`} · Sumber:{' '}
        {agencyCode}
      </p>
      {qualityNote && <Chip tone="warning">{qualityNote}</Chip>}
      {cell.isDemoExample && <Chip tone="warning">DEMO_EXAMPLE</Chip>}
    </div>
  );
}
