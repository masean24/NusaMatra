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
  useDataHubResource,
} from '@/features/data-hub';
import type { DataHubIndicatorDTO, IndicatorCatalogDTO, RegionIndicatorMeasurementDTO } from '@/services/api';
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
}

/** Indicator catalog with each indicator's definition, unit, direction and source, plus the chosen region's value. */
export function IndicatorPanel({ regionId }: IndicatorPanelProps) {
  const catalog = useDataHubResource('catalog', (repository, dataMode, signal) =>
    repository.getIndicatorCatalog({ dataMode, signal }),
  );
  const [chosenId, setChosenId] = useState<string | null>(null);

  return (
    <Surface radius="card" className={styles.panel}>
      <h2 className="kk-h3">Indikator</h2>
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
              <IndicatorDefinition indicator={indicator} />
              <IndicatorRegionValue indicator={indicator} regionId={regionId} />
            </>
          );
        }}
      </ResourceView>
    </Surface>
  );
}

function IndicatorDefinition({ indicator }: { readonly indicator: DataHubIndicatorDTO }) {
  const portalUrl = publicHttpUrl(indicator.provenance.officialPortalUrl);
  return (
    <section aria-label="Definisi indikator" className={styles.definition}>
      <h3 className="kk-body-strong">{indicator.labelId}</h3>
      <p className={`kk-small ${styles.muted}`}>
        {categoryLabel(indicator.category)} · satuan: {indicator.unitCode || 'tidak dicantumkan'} ·{' '}
        {preferredDirectionLabel(indicator.preferredDirection)}
        {indicator.referenceYear !== null
          ? ` · tahun ${String(indicator.referenceYear)}`
          : ' · periode belum tersedia'}
      </p>
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
  );
}

function IndicatorRegionValue({
  indicator,
  regionId,
}: {
  readonly indicator: DataHubIndicatorDTO;
  readonly regionId: string | null;
}) {
  const values = useDataHubResource(indicator.indicatorId, (repository, dataMode, signal) =>
    repository.getIndicatorValues({ dataMode, indicatorId: indicator.indicatorId, signal }),
  );

  return (
    <section aria-label="Nilai pada wilayah terpilih" className={styles.value}>
      <h3 className="kk-body-strong">Nilai pada wilayah terpilih</h3>
      {regionId === null ? (
        <p className="kk-body">Pilih wilayah pada daftar untuk melihat nilainya.</p>
      ) : (
        <ResourceView state={values.state} onRetry={values.retry} loadingTitle="Memuat nilai indikator…">
          {(envelope) => {
            const cell = envelope.data.valuesByRegion[regionId];
            return cell ? (
              <MeasurementCard cell={cell} unit={indicator.unitCode} />
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
}: {
  readonly cell: RegionIndicatorMeasurementDTO;
  readonly unit: string;
}) {
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
      {cell.isDemoExample && <Chip tone="warning">DEMO_EXAMPLE</Chip>}
    </div>
  );
}
