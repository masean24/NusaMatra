import { useId, useState } from 'react';
import { ButtonLink } from '@/components/ui/Button/Button';
import { Chip } from '@/components/ui/Chip/Chip';
import { GlassSelect } from '@/components/ui/GlassSelect/GlassSelect';
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

import { IndicatorDownloads } from './IndicatorDownloads';
import { scoreMethodHref } from './scoreMethodHref';
import styles from './IndicatorPanel.module.css';
import { localized, t } from '@/lib/i18n';

type IndicatorValuesEnvelope = AdaptedEnvelope<IndicatorValuesMapDTO>;

/** Opened first when the catalog has it; otherwise the first indicator the Data Hub lists. */
const PREFERRED_INDICATOR_ID = 'soc_poverty_rate';

const STATS_LABELS = localized(
  () =>
    [
      ['min', t('Terendah')],
      ['median', t('Median')],
      ['mean', t('Rata-rata')],
      ['max', t('Tertinggi')],
    ] as const,
);

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
  const pickerLabelId = useId();
  const Frame = embedded ? 'section' : Surface;
  const frameProps = embedded
    ? { className: styles.embedded, 'aria-labelledby': 'indikator-judul' }
    : { radius: 'card' as const, className: styles.panel };

  return (
    <Frame {...frameProps}>
      <h2 id="indikator-judul" className={embedded ? 'kk-body-strong' : 'kk-h3'}>
        {t('Indikator')}
      </h2>
      <ResourceView
        state={catalog.state}
        onRetry={catalog.retry}
        loadingTitle={t('Memuat katalog indikator…')}
      >
        {(envelope) => {
          const indicator = pickIndicator(envelope.data, chosenId);
          if (!indicator) return <p className="kk-body">{t('Katalog indikator dari Data Hub kosong.')}</p>;
          return (
            <>
              <div className={styles.picker}>
                <span id={pickerLabelId} className="kk-body-strong">
                  {t('Pilih indikator')}
                </span>
                {/* The glass combobox, grouped by theme as the native <optgroup> list was. */}
                <GlassSelect
                  labelledBy={pickerLabelId}
                  value={indicator.indicatorId}
                  options={envelope.data.categories.flatMap((category) =>
                    (envelope.data.byCategory[category] ?? []).map((item) => ({
                      value: item.indicatorId,
                      label: item.labelId,
                      group: categoryLabel(category),
                    })),
                  )}
                  onChange={setChosenId}
                />
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
      <IndicatorDownloads indicator={indicator} referenceYear={referenceYear} values={values.state} />
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
        {t('{0}, satuan', categoryLabel(indicator.category))} {indicator.unitCode || t('tidak dicantumkan')}.{' '}
        {preferredDirectionLabel(indicator.preferredDirection)}
        {referenceYear !== null ? t(', tahun {0}.', String(referenceYear)) : t(', periode belum tersedia.')}
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
        <span className="kk-small">{t('Definisi, sumber, dan statistik nasional')}</span>
      </summary>
      <section aria-label={t('Definisi indikator')} className={styles.definition}>
        {indicator.derivationFormula && (
          <p className={`kk-small ${styles.muted}`}>{t('Rumus turunan: {0}', indicator.derivationFormula)}</p>
        )}
        <p className={`kk-small ${styles.muted}`}>
          {t(
            'Sumber: {0}{1}',
            indicator.provenance.agencyCode,
            indicator.provenance.datasetTitle ? `, ${indicator.provenance.datasetTitle}` : '',
          )}
          {portalUrl && (
            <>
              {' ('}
              <a href={portalUrl} target="_blank" rel="noreferrer noopener">
                {t('portal sumber')}
              </a>
              {')'}
            </>
          )}
        </p>
        {indicator.stats && (
          <dl className={styles.stats}>
            {STATS_LABELS().map(([key, label]) => {
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
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={styles.valueCard}>
      <h3 id={titleId} className={styles.valueTitle}>
        {t('Nilai pada wilayah terpilih')}
      </h3>
      {regionId === null ? (
        <p className="kk-body">{t('Pilih wilayah pada daftar untuk melihat nilainya.')}</p>
      ) : (
        <ResourceView state={values.state} onRetry={values.retry} loadingTitle={t('Memuat nilai indikator…')}>
          {(envelope) => {
            if (Object.keys(envelope.data.valuesByRegion).length === 0) {
              return (
                <p className="kk-body">
                  {t(
                    'Data Hub tidak memuat nilai untuk indikator ini pada versi data ini. Indikatornya terdaftar di katalog, tetapi belum ada datanya.',
                  )}
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
              <p className="kk-body">
                {t('Wilayah kode {0} tidak ada dalam respons indikator ini.', regionId)}
              </p>
            );
          }}
        </ResourceView>
      )}
      <ButtonLink
        to={scoreMethodHref(indicator.indicatorId, regionId)}
        variant="secondary"
        className={styles.methodLink}
      >
        {t('Bagaimana skor tersebut dihitung')}
      </ButtonLink>
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
        {cell.rank !== null ? t('Peringkat {0}', String(cell.rank)) : t('Peringkat belum tersedia')}
        {cell.percentileDecimal !== null ? t(', persentil {0}', formatDecimalId(cell.percentileDecimal)) : ''}
        {cell.normalizedScoreDecimal !== null
          ? t(', skor ternormalisasi {0}', formatDecimalId(cell.normalizedScoreDecimal))
          : ''}
      </p>
      <p className={`kk-small ${styles.muted}`}>
        {t(
          '{0}, sumber {1}',
          referenceYear === null ? t('Periode belum tersedia') : t('Tahun {0}', String(referenceYear)),
          agencyCode,
        )}
      </p>
      {qualityNote && <Chip tone="warning">{qualityNote}</Chip>}
      {cell.isDemoExample && <Chip tone="warning">DEMO_EXAMPLE</Chip>}
    </div>
  );
}
