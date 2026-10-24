import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button/Button';
import {
  FRONTEND_MIN_REQUESTED_WEIGHT_PCT,
  assessCompositeIntegrity,
  assessDirectionImpact,
  type CompositeIntegrity,
  type DirectionImpact,
} from '@/domain/prioritization';
import { formatDecimalId, isLiveBlockedError, useDataHub, useDataHubResource } from '@/features/data-hub';
import {
  ApiError,
  type CompositePresetDTO,
  type DataHubRegionDTO,
  type ExploratoryCompositeResultDTO,
} from '@/services/api';
import { classifyCoverage } from '@/domain/prioritization';
import { integrityInputFromResult } from './compositeCheck';
import { weightsKey } from './criteria';
import { ContributionChart, RankingChart, WeightChart } from './LabCharts';
import { IssueList, LabDetails } from './LabDetails';
import {
  SCORE_MEANING,
  declaredRankable,
  matchingPreset,
  directionVerdictText,
  isDirectionUnverified,
  rankMovement,
  regionLabel,
  type IndicatorOption,
} from './labModel';
import { StatusPanel } from './StatusPanel';
import { impactRowsOf } from './directionChecks';
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
  /** Data Hub scenarios, to know whether the weights equal one the Data Hub marks as not rankable. */
  readonly presets: readonly CompositePresetDTO[] | null;
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
  const { chosen, weights, isSettling, provinceId, registry, options, presets, labelOf, seriesOf } = props;
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
  // A scenario the Data Hub marks rankable = false stays withheld even though the server still returns scores.
  const activePreset = matchingPreset(weights, presets);
  const integrity = result
    ? assessCompositeIntegrity(
        integrityInputFromResult(
          result,
          scopeCount > 0 ? scopeCount : null,
          weights,
          declaredRankable(activePreset),
        ),
      )
    : null;
  const direction = useDirectionCheck(
    live && result && integrity?.ok ? result : null,
    integrity?.weightsUsed ?? {},
    options,
  );
  const checks = direction.state.status === 'success' ? direction.state.data : null;
  const wrongDirection = checks?.filter((check) => check.verdict.status === 'inconsistent') ?? [];
  // Directions that could not be fully verified against the source: shown, never passed silently.
  const unverifiedDirection = checks?.filter((check) => isDirectionUnverified(check.verdict)) ?? [];
  // A KNOWN inconsistency (a published score that does not follow its raw value) that the ranking can
  // reach fails closed: the whole list when a listed region uses it, national ranks when it is elsewhere.
  const impact: DirectionImpact =
    live && checks && result
      ? assessDirectionImpact({
          checks,
          rows: impactRowsOf(result),
          weightsUsed: integrity?.weightsUsed ?? {},
          filterProvinceId: result.filterProvinceId,
        })
      : NO_IMPACT;

  const blocked = live && integrity !== null && !integrity.ok;
  const checking = live && integrity?.ok === true && direction.state.status === 'loading';
  const directionBlocked = live && (wrongDirection.length > 0 || impact.status === 'ranking_withheld');
  const validated = result !== null && integrity !== null && !blocked && !checking && !directionBlocked;
  const current = !isSettling && ranking.state.status === 'success';
  // A Paspor Bukti is only offered for a ranking that is actually shown: every check passed (in LIVE
  // including the direction check against the source) and nothing, such as a non-rankable scenario, blocks it.
  const passportAllowed =
    current &&
    validated &&
    integrity.ok &&
    (!live ||
      (direction.state.status === 'success' &&
        wrongDirection.length === 0 &&
        impact.status !== 'ranking_withheld'));
  // National ranks reached by an anomaly outside the filter are not shown (stated in the status line).
  const nationalRankWithheld = impact.status === 'national_rank_withheld';
  const shownResult = useMemo(
    () =>
      result && nationalRankWithheld
        ? { ...result, items: result.items.map((item) => ({ ...item, nationalRank: null })) }
        : result,
    [result, nationalRankWithheld],
  );

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
        activePreset={activePreset}
        wrongDirection={wrongDirection}
        impact={impact}
        unverifiedDirection={unverifiedDirection}
        directionFailed={live && direction.state.status === 'error'}
        onRetryDirection={direction.retry}
        labelOf={labelOf}
      />

      {current && validated && shownResult && (
        <RankingWorkspace
          result={shownResult}
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
          result={current ? shownResult : null}
          integrity={current ? integrity : null}
          registry={registry}
          checks={current ? checks : null}
          requestedWeights={weights}
          passportAllowed={passportAllowed}
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
  readonly activePreset: CompositePresetDTO | null;
  readonly wrongDirection: readonly DirectionCheck[];
  readonly impact: DirectionImpact;
  readonly unverifiedDirection: readonly DirectionCheck[];
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
    return (
      <StatusPanel
        tone="blocked"
        title="Peringkat belum dapat ditampilkan"
        details={<BlockedDetails issues={blocking} registry={registry} />}
      >
        {blockedSummary(blocking, props.activePreset, integrity.requestedWeightAvailabilityPct)}
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
  if (live && props.impact.status === 'ranking_withheld') {
    const { anomalies } = props.impact;
    const criteria = [...new Set(anomalies.map(({ indicatorId }) => props.labelOf(indicatorId)))].join(', ');
    const regions = [...new Set(anomalies.map(({ regionId }) => regionLabel(regionId, registry)))].join(', ');
    return (
      <StatusPanel
        tone="blocked"
        title="Peringkat ditahan: skor sumber tidak konsisten"
        details={<AnomalyList anomalies={anomalies} labelOf={props.labelOf} registry={registry} />}
      >
        Skor {criteria} untuk {regions} di Data Hub tidak sesuai dengan nilai mentahnya (nilai estimasi
        tingkat provinsi). Wilayah itu ada di daftar ini dengan bobot kriteria tersebut, jadi urutannya bisa
        keliru. Tanpa kriteria itu, atau dengan cakupan provinsi lain, peringkat dapat ditampilkan.
      </StatusPanel>
    );
  }

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
  const unlisted = integrity.issues.find((issue) => issue.code === 'REGISTRY_COUNT_MISMATCH');
  const { partial } = integrity.coverageTiers;
  const unverified = props.unverifiedDirection;
  const imputed = integrity.issues.find((issue) => issue.code === 'IMPUTED_PROVINCE_DATA');
  return (
    <StatusPanel
      tone={
        props.directionFailed ||
        partial > 0 ||
        imputed ||
        unverified.length > 0 ||
        props.impact.status === 'national_rank_withheld'
          ? 'warning'
          : 'ok'
      }
      title="Hasil siap dan sudah diperiksa"
      details={
        unverified.length > 0 ? (
          <ul role="list" className={styles.issueList}>
            {unverified.map(({ indicatorId, verdict }) => (
              <li key={indicatorId}>
                {props.labelOf(indicatorId)}:{' '}
                {directionVerdictText(verdict, (regionId) => regionLabel(regionId, registry))}
              </li>
            ))}
          </ul>
        ) : undefined
      }
      action={
        props.directionFailed ? (
          <Button variant="secondary" onClick={props.onRetryDirection}>
            Periksa arah skor lagi
          </Button>
        ) : undefined
      }
    >
      {counted} dari data resmi LIVE (snapshot {result.snapshotId}).
      {result.insufficient.length > 0 &&
        ` ${String(result.insufficient.length)} wilayah tidak diperingkat karena datanya belum cukup.`}
      {unlisted && ` ${String(unlisted.count)} wilayah lain tidak tercantum di hasil Data Hub.`}
      {partial > 0 && ` ${String(partial)} wilayah dihitung dari sebagian kriteria saja (diberi tanda).`}
      {imputed &&
        ` ${String(imputed.count)} wilayah memakai estimasi tingkat provinsi untuk sebagian kriteria.`}
      {props.directionFailed && ' Pemeriksaan arah skor belum selesai.'}
      {props.impact.status === 'national_rank_withheld' &&
        ` Peringkat nasional tidak ditampilkan: skor sumber ${[...new Set(props.impact.anomalies.map(({ regionId }) => regionLabel(regionId, registry)))].join(', ')} (di luar daftar ini) tidak konsisten, dan peringkat nasional dihitung bersama wilayah itu.`}
      {unverified.length > 0 &&
        ` Arah skor belum terverifikasi penuh terhadap data sumber untuk: ${unverified.map(({ indicatorId }) => props.labelOf(indicatorId)).join(', ')}.`}
    </StatusPanel>
  );
}

/** One plain sentence for why a LIVE ranking is withheld, most specific cause first. */
function blockedSummary(
  blocking: CompositeIntegrity['issues'],
  preset: CompositePresetDTO | null,
  requestedWeightPct: number | null,
): string {
  const has = (...codes: string[]) => blocking.some((issue) => codes.includes(issue.code));
  if (has('PRESET_NOT_RANKABLE')) {
    const availability = preset?.availability;
    return `Skenario${preset ? ` “${preset.label}”` : ''} ditandai Data Hub belum dapat diperingkat di LIVE${
      availability
        ? ` (hanya ${availability.requestedWeightAvailabilityPct.toFixed(0)}% bobotnya punya data nasional)`
        : ''
    }. Skor yang tetap dikirim server tidak ditampilkan.`;
  }
  if (has('REQUESTED_WEIGHT_AVAILABILITY_LOW')) {
    return `Kebijakan antarmuka Nusa Matra (bukan aturan Data Hub): peringkat hanya ditampilkan bila minimal ${String(FRONTEND_MIN_REQUESTED_WEIGHT_PCT)}% bobot pilihan Anda punya data nasional${
      requestedWeightPct === null ? '' : `; saat ini ${requestedWeightPct.toFixed(0)}%`
    }.`;
  }
  if (has('SCORE_DIRECTION_MISMATCH', 'SCORE_DIRECTION_UNREPORTED')) {
    return 'Arah skor dari Data Hub tidak jelas atau berbeda dari kontrak (skor tinggi = kebutuhan tinggi). Hasil ditahan agar tidak menyesatkan.';
  }
  if (has('MISSING_COMPONENT', 'CRITERION_WITHOUT_DATA', 'REGION_WEIGHTS_MISSING')) {
    return 'Sebagian data wilayah belum lengkap atau tidak bisa dihitung ulang. Hasil ditahan agar tidak menyesatkan.';
  }
  return 'Hasil dari Data Hub tidak konsisten. Hasil ditahan agar tidak menyesatkan.';
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

/** `high`: the Data Hub's order (rank 1 = highest need first); `low`: the same list read from the other end. */
type Order = 'high' | 'low';

const ORDER_LABEL: Readonly<Record<Order, string>> = {
  high: 'Prioritas tertinggi dulu',
  low: 'Prioritas terendah dulu',
};

interface RankingWorkspaceProps {
  readonly result: ExploratoryCompositeResultDTO;
  readonly integrity: CompositeIntegrity;
  readonly previous: ExploratoryCompositeResultDTO | null;
  readonly onShown: (result: ExploratoryCompositeResultDTO) => void;
  readonly labelOf: (id: string) => string;
  readonly seriesOf: (id: string) => number;
}

/**
 * The validated ranking as a bar chart, with sort, search and paging, and the selected region's breakdown.
 * Ranks are the Data Hub's own and are never recomputed: filtering or reversing the view does not renumber.
 */
function RankingWorkspace({
  result,
  integrity,
  previous,
  onShown,
  labelOf,
  seriesOf,
}: RankingWorkspaceProps) {
  const [shown, setShown] = useState(PAGE_SIZE);
  const [order, setOrder] = useState<Order>('high');
  const [query, setQuery] = useState('');
  const [completeOnly, setCompleteOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const searchId = useId();
  const completeId = useId();

  const moves = rankMovement(previous, result);
  useEffect(() => {
    onShown(result);
  }, [result, onShown]);

  const scored = result.items.filter((item) => item.rankPosition !== null);
  const hasPartial = integrity.coverageTiers.partial > 0;
  const pool = completeOnly
    ? scored.filter((item) => classifyCoverage(item.coveragePct, result.minCoveragePct) !== 'partial')
    : scored;
  const ordered = order === 'high' ? pool : [...pool].reverse();
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
            {(['high', 'low'] as const).map((value) => (
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
                {ORDER_LABEL[value]}
              </button>
            ))}
          </div>
        </div>
        <p className={styles.cardLead}>{SCORE_MEANING}</p>
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
              : `${String(rows.length)} dari ${String(pool.length)} wilayah`}
          </p>
        </div>
        {hasPartial && (
          <div className={styles.filterRow}>
            <input
              id={completeId}
              type="checkbox"
              checked={completeOnly}
              onChange={(event) => {
                setCompleteOnly(event.target.checked);
                setShown(PAGE_SIZE);
                setSelectedId(null);
              }}
            />
            <label htmlFor={completeId}>Hanya wilayah berdata lengkap (cakupan 100%)</label>
            <p className={styles.hint}>
              {completeOnly
                ? `${String(integrity.coverageTiers.partial)} wilayah berdata sebagian disembunyikan dari tampilan ini; nomor peringkat tetap milik Data Hub dan tidak dihitung ulang.`
                : `${String(integrity.coverageTiers.partial)} wilayah ditandai “Data sebagian”: skornya dihitung dari sebagian kriteria dengan bobot yang dialihkan.`}
            </p>
          </div>
        )}
        {rows.length === 0 ? (
          <p className={styles.muted}>
            {needle
              ? `Tidak ada wilayah yang cocok dengan “${query}”.`
              : 'Tidak ada wilayah untuk ditampilkan.'}
          </p>
        ) : (
          <RankingChart
            rows={rows}
            selectedId={selected?.regionId ?? null}
            onSelect={setSelectedId}
            moves={moves}
            minCoveragePct={result.minCoveragePct}
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
      {result.insufficient.length > 0 && (
        <InsufficientCard
          result={result}
          requestedWeightPct={integrity.requestedWeightAvailabilityPct}
          labelOf={labelOf}
        />
      )}
    </div>
  );
}

/** Regions the Data Hub declined to rank: named, with the coverage that fell short. They never get a rank. */
function InsufficientCard({
  result,
  requestedWeightPct,
  labelOf,
}: {
  readonly result: ExploratoryCompositeResultDTO;
  readonly requestedWeightPct: number | null;
  readonly labelOf: (id: string) => string;
}) {
  const threshold =
    result.minCoveragePct === null
      ? 'ambang cakupannya'
      : `cakupan minimal ${String(result.minCoveragePct)}% dari bobot`;
  return (
    <section className={`${styles.card} ${styles.insufficientCard}`} aria-labelledby="lab-kurang">
      <h2 id="lab-kurang" className={styles.cardTitle}>
        Tidak diperingkat: data belum cukup ({result.insufficient.length})
      </h2>
      <p className={styles.cardLead}>
        Data Hub hanya memeringkat wilayah yang memenuhi {threshold}
        {result.minComponents === null
          ? ''
          : ` dan sedikitnya ${String(result.minComponents)} kriteria berdata`}
        . Wilayah di bawah ini tidak diberi skor maupun peringkat; datanya yang kosong tidak dihitung sebagai
        0. Cakupan di sini adalah bagian bobot yang punya data di wilayah itu
        {requestedWeightPct === null
          ? '.'
          : `, berbeda dari ketersediaan data nasional atas bobot pilihan Anda (${requestedWeightPct.toFixed(0)}%).`}
      </p>
      <ul role="list" className={styles.insufficientList}>
        {result.insufficient.map((region) => (
          <li key={region.regionId}>
            <span className={styles.sourceName}>
              {region.regionDisplayName} ({region.regionId})
            </span>
            <span className={styles.muted}>
              Cakupan{' '}
              {region.coveragePct === null
                ? 'tidak dilaporkan'
                : `${formatDecimalId(String(region.coveragePct))}%`}
              {region.componentsUsed.length > 0 &&
                ` · berdata: ${region.componentsUsed.map(labelOf).join(', ')}`}
              {region.missingIndicators.length > 0 &&
                ` · kosong: ${region.missingIndicators.map(labelOf).join(', ')}`}
              {` · alasan: ${region.reason}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const NO_IMPACT: DirectionImpact = { status: 'clear' };

/** The anomalies behind a withheld result, in plain numbers. */
function AnomalyList({
  anomalies,
  labelOf,
  registry,
}: {
  readonly anomalies: Extract<DirectionImpact, { anomalies: unknown }>['anomalies'];
  readonly labelOf: (id: string) => string;
  readonly registry: readonly DataHubRegionDTO[];
}) {
  return (
    <ul role="list" className={styles.issueList}>
      {anomalies.map(({ indicatorId, regionId, raw, score }) => (
        <li key={`${indicatorId}|${regionId}`}>
          {labelOf(indicatorId)} · {regionLabel(regionId, registry)}: nilai mentah{' '}
          {formatDecimalId(String(raw))}, skor terpublikasi {formatDecimalId(String(score))}. Frontend tidak
          mengoreksi skor ini.
        </li>
      ))}
    </ul>
  );
}
