import { useState } from 'react';
import { StatusMessage } from '@/components/feedback/StatusMessage';
import { Button } from '@/components/ui/Button/Button';
import { Chip } from '@/components/ui/Chip/Chip';
import { Surface } from '@/components/ui/Surface/Surface';
import {
  TOTAL_BASIS_POINTS,
  basisPointsToPercent,
  redistributeWeights,
  type WeightsBps,
} from '@/domain/prioritization';
import { ResourceView, formatDecimalId, useDataHubResource } from '@/features/data-hub';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  INDONESIAN_ERROR_COPY,
  type ExploratoryCompositeResultDTO,
  type IndicatorCatalogDTO,
} from '@/services/api';
import { DEFAULT_CRITERIA, DEFAULT_CRITERION_IDS, weightsKey, type CriterionId } from './criteria';
import styles from './PriorityLab.module.css';

const RECOMPUTE_DEBOUNCE_MS = 400;
const PAGE_SIZE = 10;

type Weights = WeightsBps<CriterionId>;

/** Weight sliders on the Data Hub's exploratory DEMO composite query, with a ranked preview. */
export function PriorityLab() {
  const catalog = useDataHubResource('catalog', (repository, dataMode, signal) =>
    repository.getIndicatorCatalog({ dataMode, signal }),
  );
  const [weights, setWeights] = useState<Weights>(DEFAULT_CRITERIA);

  return (
    <ResourceView state={catalog.state} onRetry={catalog.retry} loadingTitle="Memuat katalog indikator…">
      {(envelope) => {
        const known = new Set(envelope.data.items.map((item) => item.indicatorId));
        const missing = DEFAULT_CRITERION_IDS.filter((id) => !known.has(id));
        if (missing.length > 0) {
          return (
            <StatusMessage kind="error" title="Kriteria awal tidak ada di katalog Data Hub">
              Lab Prioritas tidak dijalankan karena indikator berikut tidak ditemukan: {missing.join(', ')}.
              Tidak ada indikator pengganti yang dipilih secara diam-diam.
            </StatusMessage>
          );
        }
        return <Workbench catalog={envelope.data} weights={weights} onWeightsChange={setWeights} />;
      }}
    </ResourceView>
  );
}

interface WorkbenchProps {
  readonly catalog: IndicatorCatalogDTO;
  readonly weights: Weights;
  readonly onWeightsChange: (weights: Weights) => void;
}

function Workbench({ catalog, weights, onWeightsChange }: WorkbenchProps) {
  const labelOf = (id: string) => catalog.items.find((item) => item.indicatorId === id)?.labelId ?? id;
  const debouncedWeights = useDebouncedValue(weights, RECOMPUTE_DEBOUNCE_MS);
  const isSettling = debouncedWeights !== weights;

  const ranking = useDataHubResource(weightsKey(debouncedWeights), (repository, dataMode, signal) =>
    repository.runExploratoryCompositeQuery({
      dataMode,
      criteria: DEFAULT_CRITERION_IDS.map((id) => ({ indicatorId: id, basisPoints: debouncedWeights[id] })),
      signal,
    }),
  );

  const total = DEFAULT_CRITERION_IDS.reduce((sum, id) => sum + weights[id], 0);

  return (
    <div className={styles.lab}>
      <Surface radius="card" className={styles.panel}>
        <h2 className="kk-h3">Bobot kriteria</h2>
        <p className={`kk-small ${styles.muted}`}>
          Geser satu bobot dan bobot lainnya menyesuaikan, sehingga totalnya selalu 100% (10.000 basis poin).
        </p>
        <div className={styles.sliders}>
          {DEFAULT_CRITERION_IDS.map((id) => (
            <div key={id} className={styles.slider}>
              <label htmlFor={`bobot-${id}`} className="kk-body">
                {labelOf(id)}
              </label>
              <input
                id={`bobot-${id}`}
                type="range"
                min={0}
                max={100}
                step={1}
                value={basisPointsToPercent(weights[id])}
                aria-valuetext={`${formatDecimalId(String(basisPointsToPercent(weights[id])))} persen`}
                onChange={(event) => {
                  onWeightsChange(redistributeWeights(weights, id, Number(event.target.value) * 100));
                }}
              />
              <output htmlFor={`bobot-${id}`} className={`kk-body-strong ${styles.percent}`}>
                {formatDecimalId(String(basisPointsToPercent(weights[id])))}%
              </output>
            </div>
          ))}
        </div>
        <div className={styles.footer}>
          <p className="kk-body-strong" role="status">
            Total: {formatDecimalId(String(basisPointsToPercent(total)))}% ({formatDecimalId(String(total))}{' '}
            basis poin dari {formatDecimalId(String(TOTAL_BASIS_POINTS))})
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              onWeightsChange(DEFAULT_CRITERIA);
            }}
          >
            Atur ulang bobot
          </Button>
        </div>
      </Surface>

      <Surface radius="card" className={styles.panel} aria-busy={isSettling}>
        <div className={styles.titleRow}>
          <h2 className="kk-h3">Pratinjau peringkat</h2>
          <Chip tone="warning">Pratinjau Simulasi DEMO (Tanpa Run ID Imutabel)</Chip>
        </div>
        <p className="kk-body-strong">{INDONESIAN_ERROR_COPY['data.demo_disclaimer']}</p>
        {isSettling ? (
          <StatusMessage kind="loading" title={INDONESIAN_ERROR_COPY['analysis.running'] ?? 'Menghitung…'} />
        ) : (
          <ResourceView
            state={ranking.state}
            onRetry={ranking.retry}
            loadingTitle={INDONESIAN_ERROR_COPY['analysis.running'] ?? 'Menghitung…'}
          >
            {(envelope) => <RankingList result={envelope.data} labelOf={labelOf} />}
          </ResourceView>
        )}
        <p className={`kk-small ${styles.muted}`}>
          Rincian kontribusi berbobot per kriteria (“Mengapa Diprioritaskan”) belum tersedia: Data Hub belum
          menyediakan endpoint penjelasan analisis. Skor komponen di bawah adalah nilai ternormalisasi 0–100,
          bukan kontribusi berbobot, dan hasil ini bukan rekomendasi kebijakan.
        </p>
      </Surface>
    </div>
  );
}

function RankingList({
  result,
  labelOf,
}: {
  readonly result: ExploratoryCompositeResultDTO;
  readonly labelOf: (id: string) => string;
}) {
  const [shown, setShown] = useState(PAGE_SIZE);
  const rows = result.items.slice(0, shown);

  return (
    <>
      <p className="kk-small" role="status">
        Menampilkan {rows.length} dari {result.totalRegions} wilayah · nama wilayah pada dataset DEMO bersifat
        sintetis
      </p>
      <ol className={styles.ranking}>
        {rows.map((item) => (
          <li key={item.regionId} className={styles.rank}>
            <span className={`kk-number ${styles.position}`}>{item.rankPosition ?? '—'}</span>
            <span className={styles.name}>
              <span className="kk-body-strong">{item.regionDisplayName}</span>
              <span className={`kk-small ${styles.muted}`}>Kode {item.regionId}</span>
            </span>
            <span className="kk-body-strong">
              {item.compositeScoreDecimal === null
                ? 'Tidak dapat dihitung'
                : formatDecimalId(item.compositeScoreDecimal)}
            </span>
            <details className={styles.components}>
              <summary className="kk-small">Skor komponen (ternormalisasi)</summary>
              <ul role="list" className={styles.componentList}>
                {Object.entries(item.componentScoresDecimal).map(([id, score]) => (
                  <li key={id} className="kk-small">
                    {labelOf(id)}: {score === null ? 'Data belum tersedia' : formatDecimalId(score)}
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ol>
      {shown < result.items.length && (
        <Button
          variant="secondary"
          onClick={() => {
            setShown((current) => current + PAGE_SIZE);
          }}
        >
          Tampilkan {Math.min(PAGE_SIZE, result.items.length - shown)} lagi
        </Button>
      )}
    </>
  );
}
