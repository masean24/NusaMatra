import { useState } from 'react';
import { StatusMessage } from '@/components/feedback/StatusMessage';
import { Button } from '@/components/ui/Button/Button';
import { Chip } from '@/components/ui/Chip/Chip';
import { Surface } from '@/components/ui/Surface/Surface';
import {
  TOTAL_BASIS_POINTS,
  assessCompositeIntegrity,
  basisPointsToPercent,
  redistributeWeights,
  type CompositeIntegrity,
  type WeightsBps,
} from '@/domain/prioritization';
import { ResourceView, formatDecimalId, useDataHub, useDataHubResource } from '@/features/data-hub';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  INDONESIAN_ERROR_COPY,
  type ExploratoryCompositeResultDTO,
  type IndicatorCatalogDTO,
} from '@/services/api';
import { integrityInputFromResult } from './compositeCheck';
import { startingCriteriaFor, weightsKey } from './criteria';
import styles from './PriorityLab.module.css';

const RECOMPUTE_DEBOUNCE_MS = 400;
const PAGE_SIZE = 10;

type Weights = WeightsBps<string>;

/** Weight sliders on the Data Hub's exploratory composite query, with a ranked preview. */
export function PriorityLab() {
  const { dataMode } = useDataHub();
  // Each mode has its own starting criteria, so switching mode starts over instead of carrying weights across.
  return <Lab key={dataMode} startingWeights={startingCriteriaFor(dataMode)} />;
}

function Lab({ startingWeights }: { readonly startingWeights: Weights }) {
  const catalog = useDataHubResource('catalog', (repository, dataMode, signal) =>
    repository.getIndicatorCatalog({ dataMode, signal }),
  );
  const [weights, setWeights] = useState<Weights>(startingWeights);

  return (
    <ResourceView state={catalog.state} onRetry={catalog.retry} loadingTitle="Memuat katalog indikator…">
      {(envelope) => {
        const known = new Set(envelope.data.items.map((item) => item.indicatorId));
        const missing = Object.keys(startingWeights).filter((id) => !known.has(id));
        if (missing.length > 0) {
          return (
            <StatusMessage kind="error" title="Kriteria awal tidak ada di katalog Data Hub">
              Lab Prioritas tidak dijalankan karena indikator berikut tidak ditemukan: {missing.join(', ')}.
              Tidak ada indikator pengganti yang dipilih secara diam-diam.
            </StatusMessage>
          );
        }
        return (
          <Workbench
            catalog={envelope.data}
            weights={weights}
            startingWeights={startingWeights}
            onWeightsChange={setWeights}
          />
        );
      }}
    </ResourceView>
  );
}

interface WorkbenchProps {
  readonly catalog: IndicatorCatalogDTO;
  readonly weights: Weights;
  readonly startingWeights: Weights;
  readonly onWeightsChange: (weights: Weights) => void;
}

function Workbench({ catalog, weights, startingWeights, onWeightsChange }: WorkbenchProps) {
  const labelOf = (id: string) => catalog.items.find((item) => item.indicatorId === id)?.labelId ?? id;
  const debouncedWeights = useDebouncedValue(weights, RECOMPUTE_DEBOUNCE_MS);
  const isSettling = debouncedWeights !== weights;

  const criterionIds = Object.keys(weights);
  const total = criterionIds.reduce((sum, id) => sum + (weights[id] ?? 0), 0);

  return (
    <div className={styles.lab}>
      <Surface radius="card" className={styles.panel}>
        <h2 className="kk-h3">Bobot kriteria</h2>
        <p className={`kk-small ${styles.muted}`}>
          Geser satu bobot dan bobot lainnya menyesuaikan, sehingga totalnya selalu 100% (10.000 basis poin).
        </p>
        <div className={styles.sliders}>
          {criterionIds.map((id) => (
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
                value={basisPointsToPercent(weights[id] ?? 0)}
                aria-valuetext={`${formatDecimalId(String(basisPointsToPercent(weights[id] ?? 0)))} persen`}
                onChange={(event) => {
                  onWeightsChange(redistributeWeights(weights, id, Number(event.target.value) * 100));
                }}
              />
              <output htmlFor={`bobot-${id}`} className={`kk-body-strong ${styles.percent}`}>
                {formatDecimalId(String(basisPointsToPercent(weights[id] ?? 0)))}%
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
              onWeightsChange(startingWeights);
            }}
          >
            Atur ulang bobot
          </Button>
        </div>
      </Surface>

      <RankingPanel weights={debouncedWeights} isSettling={isSettling} labelOf={labelOf} />
    </div>
  );
}

interface RankingPanelProps {
  readonly weights: Weights;
  readonly isSettling: boolean;
  readonly labelOf: (id: string) => string;
}

/** The ranked preview, shown only when it reproduces from its own components and covers the registry. */
function RankingPanel({ weights, isSettling, labelOf }: RankingPanelProps) {
  const { dataMode } = useDataHub();
  const ranking = useDataHubResource(weightsKey(weights), (repository, mode, signal) =>
    repository.runExploratoryCompositeQuery({
      dataMode: mode,
      criteria: Object.entries(weights).map(([indicatorId, basisPoints]) => ({ indicatorId, basisPoints })),
      signal,
    }),
  );
  // Coverage can only be judged against the region registry of the same snapshot.
  const registry = useDataHubResource('registry-size', (repository, mode, signal) =>
    repository.searchRegions({ dataMode: mode, query: '', signal }),
  );

  return (
    <Surface radius="card" className={styles.panel} aria-busy={isSettling}>
      <div className={styles.titleRow}>
        <h2 className="kk-h3">Pratinjau peringkat</h2>
        <Chip tone="warning">
          {dataMode === 'DEMO'
            ? 'Pratinjau Simulasi DEMO (Tanpa Run ID Imutabel)'
            : 'Pratinjau Eksploratif LIVE (Tanpa Run ID Imutabel)'}
        </Chip>
      </div>
      {dataMode === 'DEMO' && (
        <p className="kk-body-strong">{INDONESIAN_ERROR_COPY['data.demo_disclaimer']}</p>
      )}
      {isSettling ? (
        <StatusMessage kind="loading" title={INDONESIAN_ERROR_COPY['analysis.running'] ?? 'Menghitung…'} />
      ) : (
        <ResourceView
          state={ranking.state}
          onRetry={ranking.retry}
          loadingTitle={INDONESIAN_ERROR_COPY['analysis.running'] ?? 'Menghitung…'}
        >
          {(envelope) => (
            <ResourceView
              state={registry.state}
              onRetry={registry.retry}
              loadingTitle="Memeriksa cakupan wilayah…"
            >
              {(regions) => (
                <CheckedRanking
                  result={envelope.data}
                  registryRegionCount={regions.data.length}
                  labelOf={labelOf}
                />
              )}
            </ResourceView>
          )}
        </ResourceView>
      )}
      <p className={`kk-small ${styles.muted}`}>
        Skor tinggi berarti kondisi relatif lebih baik pada kriteria terpilih (bahaya, kemiskinan, atau
        stunting lebih rendah; IPM lebih tinggi). Peringkat 1 adalah wilayah dengan kondisi relatif terbaik,
        bukan wilayah dengan prioritas intervensi tertinggi.
      </p>
      <p className={`kk-small ${styles.muted}`}>
        Rincian kontribusi berbobot per kriteria (“Mengapa Diprioritaskan”) belum tersedia: Data Hub belum
        menyediakan endpoint penjelasan analisis. Skor komponen di bawah adalah nilai ternormalisasi 0–100,
        bukan kontribusi berbobot, dan hasil ini bukan rekomendasi kebijakan.
      </p>
    </Surface>
  );
}

/**
 * LIVE: a ranking that fails the integrity check is withheld, because LIVE must be verifiable.
 * DEMO: the simulated list is still shown, with the problem flagged above it.
 */
function CheckedRanking({
  result,
  registryRegionCount,
  labelOf,
}: {
  readonly result: ExploratoryCompositeResultDTO;
  readonly registryRegionCount: number;
  readonly labelOf: (id: string) => string;
}) {
  const { dataMode } = useDataHub();
  const integrity = assessCompositeIntegrity(integrityInputFromResult(result, registryRegionCount));

  if (!integrity.ok && dataMode === 'LIVE') {
    return <IntegrityProblem integrity={integrity} withheld />;
  }
  return (
    <>
      {!integrity.ok && <IntegrityProblem integrity={integrity} withheld={false} />}
      <RankingList result={result} registryRegionCount={registryRegionCount} labelOf={labelOf} />
    </>
  );
}

function IntegrityProblem({
  integrity,
  withheld,
}: {
  readonly integrity: CompositeIntegrity;
  readonly withheld: boolean;
}) {
  return (
    <StatusMessage
      kind="error"
      title={
        withheld ? 'Peringkat ditahan: hasil komposit tidak konsisten' : 'Hasil komposit tidak konsisten'
      }
    >
      <ul role="list">
        {integrity.issues.map((issue) => (
          <li key={issue.code}>{issue.message}</li>
        ))}
      </ul>
      Data Hub perlu memperbaikinya; antarmuka tidak menghitung ulang atau menutup selisih ini.
    </StatusMessage>
  );
}

function RankingList({
  result,
  registryRegionCount,
  labelOf,
}: {
  readonly result: ExploratoryCompositeResultDTO;
  readonly registryRegionCount: number;
  readonly labelOf: (id: string) => string;
}) {
  const { dataMode } = useDataHub();
  const [shown, setShown] = useState(PAGE_SIZE);
  const rows = result.items.slice(0, shown);

  return (
    <>
      <p className="kk-small" role="status">
        Menampilkan {rows.length} dari {result.totalRegions} wilayah
        {dataMode === 'DEMO'
          ? ' · nama wilayah pada dataset DEMO bersifat sintetis'
          : ` · daftar wilayah snapshot ini berisi ${String(registryRegionCount)} kabupaten/kota`}
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
