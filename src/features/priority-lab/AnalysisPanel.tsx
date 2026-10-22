import { useCallback, useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/Button/Button';
import { assessCompositeIntegrity, type CompositeIntegrity } from '@/domain/prioritization';
import { isLiveBlockedError, useDataHub, useDataHubResource } from '@/features/data-hub';
import { ApiError, type DataHubRegionDTO, type ExploratoryCompositeResultDTO } from '@/services/api';
import { integrityInputFromResult } from './compositeCheck';
import { weightsKey } from './criteria';
import { ContributionChart, RankingChart, WeightChart } from './LabCharts';
import { IssueList, LabDetails } from './LabDetails';
import { rankMovement, type IndicatorOption } from './labModel';
import { StatusPanel } from './StatusPanel';
import { useDirectionCheck, type DirectionCheck } from './useDirectionCheck';
import styles from './PriorityLab.module.css';

const PAGE_SIZE = 10;

interface AnalysisPanelProps {
  /** The sliders' weights, for the weight chart (updates while dragging). */
  readonly chosen: Readonly<Record<string, number>>;
  /** The weights to calculate with (debounced). */
  readonly weights: Readonly<Record<string, number>>;
  readonly isSettling: boolean;
  readonly provinceId: string | null;
  readonly registry: readonly DataHubRegionDTO[];
  readonly options: readonly IndicatorOption[];
  readonly labelOf: (id: string) => string;
  readonly seriesOf: (id: string) => number;
}

/** The last result shown and the one before it, kept while new weights are calculated. */
interface ShownHistory {
  readonly current: ExploratoryCompositeResultDTO | null;
  readonly previous: ExploratoryCompositeResultDTO | null;
}

/**
 * Runs the Data Hub's composite query for the settled weights, checks it, and shows it in order:
 * weights, status, ranking, one region's breakdown, then the details. In LIVE a result that fails a
 * blocking check, or whose components run against their indicator's direction, is never charted.
 */
export function AnalysisPanel(props: AnalysisPanelProps) {
  const { chosen, weights, isSettling, provinceId, registry, options, labelOf, seriesOf } = props;
  const { dataMode } = useDataHub();
  const live = dataMode === 'LIVE';
  const ready = Object.keys(weights).length > 0;

  const ranking = useDataHubResource(
    `${weightsKey(weights)}|${provinceId ?? 'all'}`,
    (repository, mode, signal) =>
      repository.runExploratoryCompositeQuery({
        dataMode: mode,
        criteria: Object.entries(weights).map(([indicatorId, basisPoints]) => ({ indicatorId, basisPoints })),
        filterProvinceId: provinceId,
        signal,
      }),
    ready,
  );
  const result = ranking.state.status === 'success' ? ranking.state.data.data : null;
  const scopeCount = result?.filterProvinceId
    ? registry.filter((region) => region.parentRegionId === result.filterProvinceId).length
    : registry.length;
  const integrity = result
    ? assessCompositeIntegrity(integrityInputFromResult(result, scopeCount > 0 ? scopeCount : null, weights))
    : null;
  const direction = useDirectionCheck(
    live && result && integrity?.ok ? result : null,
    integrity?.weightsUsed ?? {},
    options,
  );
  const checks = direction.state.status === 'success' ? direction.state.data : null;
  const wrongDirection = checks?.filter((check) => check.verdict.status === 'inconsistent') ?? [];

  const blocked = live && integrity !== null && !integrity.ok;
  const checking = live && integrity?.ok === true && direction.state.status === 'loading';
  const directionBlocked = live && wrongDirection.length > 0;
  const validated = result !== null && integrity !== null && !blocked && !checking && !directionBlocked;
  const current = !isSettling && ranking.state.status === 'success';

  // Rank moves are described against the result shown before (same scope only).
  const [history, setHistory] = useState<ShownHistory>({ current: null, previous: null });
  const recordShown = useCallback((shown: ExploratoryCompositeResultDTO) => {
    setHistory((before) =>
      before.current === shown ? before : { current: shown, previous: before.current },
    );
  }, []);

  return (
    <div className={styles.analysis}>
      <WeightChart
        chosen={chosen}
        used={current && validated ? integrity.weightsUsed : null}
        labelOf={labelOf}
        seriesOf={seriesOf}
      />

      <AnalysisStatus
        ready={ready}
        isSettling={isSettling}
        state={ranking.state}
        onRetry={ranking.retry}
        result={result}
        integrity={integrity}
        registry={registry}
        checking={checking}
        wrongDirection={wrongDirection}
        directionFailed={live && direction.state.status === 'error'}
        onRetryDirection={direction.retry}
        labelOf={labelOf}
      />

      {current && validated && (
        <RankingWorkspace
          result={result}
          integrity={integrity}
          previous={history.current === result ? history.previous : history.current}
          onShown={recordShown}
          labelOf={labelOf}
          seriesOf={seriesOf}
        />
      )}

      {ready && (
        <LabDetails
          options={options}
          chosenIds={Object.keys(chosen)}
          result={current ? result : null}
          integrity={current ? integrity : null}
          registry={registry}
          checks={current ? checks : null}
        />
      )}
    </div>
  );
}

interface AnalysisStatusProps {
  readonly ready: boolean;
  readonly isSettling: boolean;
  readonly state: ReturnType<typeof useDataHubResource<unknown>>['state'];
  readonly onRetry: () => void;
  readonly result: ExploratoryCompositeResultDTO | null;
  readonly integrity: CompositeIntegrity | null;
  readonly registry: readonly DataHubRegionDTO[];
  readonly checking: boolean;
  readonly wrongDirection: readonly DirectionCheck[];
  readonly directionFailed: boolean;
  readonly onRetryDirection: () => void;
  readonly labelOf: (id: string) => string;
}

/** One status at a time, in plain words; the technical facts are one click away. */
function AnalysisStatus(props: AnalysisStatusProps) {
  const { ready, isSettling, state, onRetry, result, integrity, registry, checking, wrongDirection } = props;
  const { dataMode } = useDataHub();
  const live = dataMode === 'LIVE';

  if (!ready) {
    return (
      <StatusPanel tone="warning" title="Pilih minimal satu kriteria">
        Peringkat dihitung setelah ada kriteria berdata.
      </StatusPanel>
    );
  }
  if (isSettling || state.status === 'loading' || state.status === 'idle') {
    return <StatusPanel tone="loading" title="Menghitung peringkat…" />;
  }
  if (state.status === 'error' || state.status === 'unconfigured') {
    const error = state.status === 'error' ? state.error : null;
    if (isLiveBlockedError(error, dataMode)) {
      return <p className={styles.quietNote}>Tidak ada data LIVE untuk ditampilkan di sini.</p>;
    }
    return (
      <StatusPanel
        tone="error"
        title="Perhitungan belum berhasil"
        details={
          error instanceof ApiError ? (
            <p>
              Kode {error.code} · HTTP {String(error.status)}
              {error.serverMessage ? ` · ${error.serverMessage}` : ''}
            </p>
          ) : undefined
        }
        action={
          state.status === 'error' ? (
            <Button variant="secondary" onClick={onRetry}>
              Coba lagi
            </Button>
          ) : undefined
        }
      >
        Data Hub tidak memberi hasil. Tidak ada peringkat lain yang ditampilkan sebagai gantinya.
      </StatusPanel>
    );
  }
  if (!result || !integrity) return null;

  const blocking = integrity.issues.filter((issue) => issue.severity === 'block');
  if (live && !integrity.ok) {
    const missingData = blocking.some(
      (issue) => issue.code === 'MISSING_COMPONENT' || issue.code === 'CRITERION_WITHOUT_DATA',
    );
    return (
      <StatusPanel
        tone="blocked"
        title="Peringkat belum dapat ditampilkan"
        details={<BlockedDetails issues={blocking} registry={registry} />}
      >
        {missingData
          ? 'Sebagian data wilayah belum lengkap. Hasil ditahan agar tidak menyesatkan.'
          : 'Hasil dari Data Hub tidak konsisten. Hasil ditahan agar tidak menyesatkan.'}
      </StatusPanel>
    );
  }
  if (checking) return <StatusPanel tone="loading" title="Memeriksa hasil terhadap data sumber…" />;
  if (live && wrongDirection.length > 0) {
    return (
      <StatusPanel
        tone="blocked"
        title="Peringkat belum dapat ditampilkan"
        details={
          <ul role="list" className={styles.issueList}>
            {wrongDirection.map(({ indicatorId, verdict }) => (
              <li key={indicatorId}>
                {props.labelOf(indicatorId)}: {verdict.status === 'inconsistent' ? verdict.reason : ''}
                {verdict.status === 'inconsistent' && ` Contoh kode wilayah: ${verdict.examples.join(', ')}.`}
              </li>
            ))}
          </ul>
        }
      >
        Arah skor tidak cocok dengan data sumber. Hasil ditahan agar tidak menyesatkan.
      </StatusPanel>
    );
  }

  const excluded = integrity.issues.find((issue) => issue.code === 'REGISTRY_COUNT_MISMATCH');
  const province = result.filterProvinceId
    ? (registry.find((region) => region.parentRegionId === result.filterProvinceId)?.provinceName ??
      `provinsi ${result.filterProvinceId}`)
    : null;
  const counted = `${String(result.items.length)} wilayah${province ? ` di ${province}` : ''} dihitung`;
  if (!live) {
    return (
      <StatusPanel
        tone={integrity.ok ? 'demo' : 'warning'}
        title={integrity.ok ? 'Data simulasi (DEMO)' : 'Hasil simulasi tidak konsisten'}
        details={integrity.ok ? undefined : <BlockedDetails issues={blocking} registry={registry} />}
      >
        {counted}. Nama wilayah sintetis; bukan data atau rekomendasi resmi.
      </StatusPanel>
    );
  }
  return (
    <StatusPanel
      tone={props.directionFailed ? 'warning' : 'ok'}
      title="Hasil siap dan sudah diperiksa"
      action={
        props.directionFailed ? (
          <Button variant="secondary" onClick={props.onRetryDirection}>
            Periksa arah skor lagi
          </Button>
        ) : undefined
      }
    >
      {counted} dari data resmi LIVE (snapshot {result.snapshotId}).
      {excluded && ` ${String(excluded.count)} wilayah belum lengkap datanya dan tidak ikut.`}
      {props.directionFailed && ' Pemeriksaan arah skor belum selesai.'}
    </StatusPanel>
  );
}

function BlockedDetails({
  issues,
  registry,
}: {
  readonly issues: CompositeIntegrity['issues'];
  readonly registry: readonly DataHubRegionDTO[];
}) {
  return (
    <>
      <IssueList issues={issues} registry={registry} />
      <p>Data Hub perlu memperbaikinya. Antarmuka tidak menghitung ulang atau menutup selisih ini.</p>
    </>
  );
}

type Order = 'best' | 'hardest';

interface RankingWorkspaceProps {
  readonly result: ExploratoryCompositeResultDTO;
  readonly integrity: CompositeIntegrity;
  readonly previous: ExploratoryCompositeResultDTO | null;
  readonly onShown: (result: ExploratoryCompositeResultDTO) => void;
  readonly labelOf: (id: string) => string;
  readonly seriesOf: (id: string) => number;
}

/** The validated ranking as a bar chart, with sort, search and paging, and the selected region's breakdown. */
function RankingWorkspace({
  result,
  integrity,
  previous,
  onShown,
  labelOf,
  seriesOf,
}: RankingWorkspaceProps) {
  const [shown, setShown] = useState(PAGE_SIZE);
  const [order, setOrder] = useState<Order>('best');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const searchId = useId();

  const moves = rankMovement(previous, result);
  useEffect(() => {
    onShown(result);
  }, [result, onShown]);

  const scored = result.items.filter((item) => item.rankPosition !== null);
  const ordered = order === 'best' ? scored : [...scored].reverse();
  const needle = query.trim().toLowerCase();
  const matching = needle
    ? ordered.filter((item) => item.regionDisplayName.toLowerCase().includes(needle))
    : ordered;
  const rows = matching.slice(0, shown);
  const selected = scored.find((item) => item.regionId === selectedId) ?? rows[0] ?? null;

  return (
    <div className={styles.results}>
      <section className={`${styles.card} ${styles.rankingCard}`} aria-label="Daftar peringkat">
        <div className={styles.rankingHead}>
          <h2 className={styles.cardTitle}>Peringkat wilayah</h2>
          <div className={styles.segmented} role="group" aria-label="Urutan tampilan">
            {(['best', 'hardest'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={order === value}
                onClick={() => {
                  setOrder(value);
                  setShown(PAGE_SIZE);
                  setSelectedId(null);
                }}
              >
                {value === 'best' ? 'Kondisi terbaik dulu' : 'Kondisi paling berat dulu'}
              </button>
            ))}
          </div>
        </div>
        <p className={styles.cardLead}>
          Skor 0–100: makin tinggi, makin baik kondisinya pada kriteria pilihan Anda. Ini perbandingan
          relatif, bukan penilaian mutlak.
        </p>
        <div className={styles.searchRow}>
          <label htmlFor={searchId} className={styles.visuallyHidden}>
            Cari wilayah dalam peringkat
          </label>
          <input
            id={searchId}
            type="search"
            className={styles.input}
            value={query}
            placeholder="Cari kabupaten/kota"
            onChange={(event) => {
              setQuery(event.target.value);
              setShown(PAGE_SIZE);
            }}
          />
          <p className={styles.muted} role="status">
            {needle
              ? `${String(matching.length)} hasil pencarian`
              : `${String(rows.length)} dari ${String(scored.length)} wilayah`}
          </p>
        </div>
        {rows.length === 0 ? (
          <p className={styles.muted}>Tidak ada wilayah yang cocok dengan “{query}”.</p>
        ) : (
          <RankingChart
            rows={rows}
            selectedId={selected?.regionId ?? null}
            onSelect={setSelectedId}
            moves={moves}
          />
        )}
        {shown < matching.length && (
          <Button
            variant="secondary"
            onClick={() => {
              setShown((current) => current + PAGE_SIZE);
            }}
          >
            Tampilkan {Math.min(PAGE_SIZE, matching.length - shown)} lagi
          </Button>
        )}
      </section>
      {selected && (
        <ContributionChart
          item={selected}
          weightsUsed={integrity.weightsUsed}
          labelOf={labelOf}
          seriesOf={seriesOf}
        />
      )}
    </div>
  );
}
