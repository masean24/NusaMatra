import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
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
  getIndonesianErrorCopy,
  type CompositePresetDTO,
  type DataHubRegionDTO,
  type ExploratoryCompositeResultDTO,
} from '@/services/api';
import { classifyRegionCoverage } from '@/domain/prioritization';
import { integrityInputFromResult } from './compositeCheck';
import { weightsKey } from './criteria';
import { Icon } from '@/components/ui/Icon/Icon';
import { passportHref } from '@/features/evidence-passport';
import { ContributionChart, RankingChart } from './LabCharts';
import { IssueList, LabDetails } from './LabDetails';
import {
  SCORE_SUMMARY,
  declaredRankable,
  matchingPreset,
  directionVerdictText,
  isDirectionUnverified,
  percentLabel,
  rankMovement,
  rankingBasis,
  regionLabel,
  type IndicatorOption,
} from './labModel';
import { describeResultStatus } from './resultStatus';
import { StatusPanel } from './StatusPanel';
import { impactRowsOf } from './directionChecks';
import { useDirectionCheck, type DirectionCheck } from './useDirectionCheck';
import { useRankScroll } from './useRankScroll';
import styles from './PriorityLab.module.css';
import { t } from '@/lib/i18n';

const PAGE_SIZE = 10;

interface AnalysisPanelProps {
  /** The weights the ranking is calculated with: the sliders' last resting position that adds up. */
  readonly weights: Readonly<Record<string, number>>;
  /** The sliders differ from `weights`: the ranking shown still uses the previous weights. */
  readonly stale: boolean;
  /** The new weights are valid and about to be calculated; otherwise they cannot be yet. */
  readonly updating: boolean;
  readonly provinceId: string | null;
  readonly registry: readonly DataHubRegionDTO[];
  readonly options: readonly IndicatorOption[];
  /** Data Hub scenarios, to know whether the weights equal one the Data Hub marks as not rankable. */
  readonly presets: readonly CompositePresetDTO[] | null;
  readonly labelOf: (id: string) => string;
  readonly seriesOf: (id: string) => number;
  /**
   * The settings panel. It is placed after the status (and, in one column, after the top three) so the
   * reading order puts results before the sliders; on desktop the grid moves it into the left column.
   */
  readonly controls: ReactNode;
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
  const { weights, stale, updating, provinceId, registry, options, presets, labelOf, seriesOf, controls } =
    props;
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
  const current = ranking.state.status === 'success';
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

  // While new weights are being calculated (and, in LIVE, checked), the last ranking that passed
  // every check stays on screen, dimmed and marked busy, instead of disappearing; when the new
  // result is validated its rows move into place (owner revision 2026-10-28). An error or a
  // blocked result never keeps the old ranking.
  const fresh =
    current && validated && shownResult ? { result: shownResult, integrity, passportAllowed } : null;
  const [kept, setKept] = useState(fresh);
  if (fresh && (kept?.result !== fresh.result || kept.passportAllowed !== fresh.passportAllowed)) {
    setKept(fresh);
  }
  const refreshing = !fresh && (ranking.state.status === 'loading' || checking);
  const display = fresh ?? (refreshing ? kept : null);

  // Rank moves are described against the result shown before (same scope only).
  const [history, setHistory] = useState<ShownHistory>({ current: null, previous: null });
  const recordShown = useCallback((shown: ExploratoryCompositeResultDTO) => {
    setHistory((before) =>
      before.current === shown ? before : { current: shown, previous: before.current },
    );
  }, []);

  return (
    <div className={styles.analysis}>
      <AnalysisStatus
        ready={ready}
        stale={stale}
        updating={updating}
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

      {display && <TopSummary result={display.result} />}

      {controls}

      {display && (
        <RankingWorkspace
          result={display.result}
          integrity={display.integrity}
          previous={history.current === display.result ? history.previous : history.current}
          onShown={recordShown}
          labelOf={labelOf}
          seriesOf={seriesOf}
          stale={stale}
          refreshing={refreshing}
          updating={updating}
          passportHrefFor={
            // No passport from a ranking that is being replaced: its weights are no longer the
            // ones on screen.
            display.passportAllowed && !refreshing
              ? (focusRegionId) =>
                  passportHref({
                    kind: 'lab',
                    weights,
                    provinceId: display.result.filterProvinceId,
                    mode: display.result.dataMode,
                    snapshotId: display.result.snapshotId,
                    focusRegionId,
                  })
              : null
          }
        />
      )}

      {ready && (
        <LabDetails
          options={options}
          chosenIds={Object.keys(weights)}
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
  readonly stale: boolean;
  readonly updating: boolean;
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
  const { ready, state, onRetry, result, integrity, registry, checking, wrongDirection } = props;
  const { dataMode } = useDataHub();
  const live = dataMode === 'LIVE';

  if (!ready) {
    return (
      <StatusPanel tone="warning" title={t('Pilih minimal satu kriteria')}>
        {t('Peringkat dihitung setelah ada kriteria berdata.')}
      </StatusPanel>
    );
  }
  if (state.status === 'loading' || state.status === 'idle') {
    return <StatusPanel tone="loading" title={t('Menghitung peringkat…')} />;
  }
  if (state.status === 'error' || state.status === 'unconfigured') {
    const error = state.status === 'error' ? state.error : null;
    if (isLiveBlockedError(error, dataMode)) {
      return (
        <p className={styles.quietNote}>
          {t('Tidak ada data LIVE untuk ditampilkan di sini.')}{' '}
          <button type="button" className={styles.quietRetry} onClick={onRetry}>
            {t('Coba lagi')}
          </button>
        </p>
      );
    }
    return (
      <StatusPanel
        tone="error"
        title={t('Perhitungan belum berhasil')}
        details={
          error instanceof ApiError ? (
            <p>
              {t(
                'Kode {0}, HTTP {1}{2}',
                error.code,
                String(error.status),
                error.serverMessage ? `: ${error.serverMessage}` : '',
              )}
            </p>
          ) : undefined
        }
        action={
          state.status === 'error' ? (
            <Button variant="secondary" onClick={onRetry}>
              {t('Coba lagi')}
            </Button>
          ) : undefined
        }
      >
        {t(
          '{0} Tidak ada peringkat lain yang ditampilkan sebagai gantinya.',
          error === null ? t('Data Hub tidak memberi hasil.') : getIndonesianErrorCopy(error),
        )}
      </StatusPanel>
    );
  }
  if (!result || !integrity) return null;

  const blocking = integrity.issues.filter((issue) => issue.severity === 'block');
  if (live && !integrity.ok) {
    return (
      <StatusPanel
        tone="blocked"
        title={t('Peringkat belum dapat ditampilkan')}
        details={<BlockedDetails issues={blocking} registry={registry} />}
      >
        {blockedSummary(blocking, props.activePreset, integrity.requestedWeightAvailabilityPct)}
      </StatusPanel>
    );
  }
  if (checking) return <StatusPanel tone="loading" title={t('Memeriksa hasil terhadap data sumber…')} />;
  if (live && wrongDirection.length > 0) {
    return (
      <StatusPanel
        tone="blocked"
        title={t('Peringkat belum dapat ditampilkan')}
        details={
          <ul role="list" className={styles.issueList}>
            {wrongDirection.map(({ indicatorId, verdict }) => (
              <li key={indicatorId}>
                {props.labelOf(indicatorId)}: {verdict.status === 'inconsistent' ? verdict.reason : ''}
                {verdict.status === 'inconsistent' &&
                  t(' Contoh kode wilayah: {0}.', verdict.examples.join(', '))}
              </li>
            ))}
          </ul>
        }
      >
        {t('Arah skor tidak cocok dengan data sumber. Hasil ditahan agar tidak menyesatkan.')}
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
        title={t('Peringkat ditahan: skor sumber tidak konsisten')}
        details={<AnomalyList anomalies={anomalies} labelOf={props.labelOf} registry={registry} />}
      >
        {t(
          'Skor {0} untuk {1} di Data Hub tidak sesuai dengan nilai mentahnya (nilai estimasi tingkat provinsi). Wilayah itu ada di daftar ini dengan bobot kriteria tersebut, jadi urutannya bisa keliru. Tanpa kriteria itu, atau dengan cakupan provinsi lain, peringkat dapat ditampilkan.',
          criteria,
          regions,
        )}
      </StatusPanel>
    );
  }

  const province = result.filterProvinceId
    ? (registry.find((region) => region.parentRegionId === result.filterProvinceId)?.provinceName ??
      t('provinsi {0}', result.filterProvinceId))
    : null;
  const counted = t(
    '{0} wilayah{1} dihitung',
    String(result.items.length),
    province ? ` di ${province}` : '',
  );
  if (!live) {
    return (
      <StatusPanel
        tone={integrity.ok ? 'demo' : 'warning'}
        title={integrity.ok ? t('Data simulasi (DEMO)') : t('Hasil simulasi tidak konsisten')}
        details={integrity.ok ? undefined : <BlockedDetails issues={blocking} registry={registry} />}
      >
        {t('{0}. Nama wilayah sintetis; bukan data atau rekomendasi resmi.', counted)}
      </StatusPanel>
    );
  }
  const { partial } = integrity.coverageTiers;
  const unverified = props.unverifiedDirection;
  const status = describeResultStatus({
    stale: props.stale,
    directionCheckFailed: props.directionFailed,
    requestedWeightAvailabilityPct: integrity.requestedWeightAvailabilityPct,
    partialRegions: partial,
    imputedRegions: integrity.issues.find((issue) => issue.code === 'IMPUTED_PROVINCE_DATA')?.count ?? 0,
    insufficientRegions: result.insufficient.length,
    unlistedRegions: integrity.issues.find((issue) => issue.code === 'REGISTRY_COUNT_MISMATCH')?.count ?? 0,
    unverifiedDirectionLabels: unverified.map(({ indicatorId }) => props.labelOf(indicatorId)),
    nationalRankWithheldRegions:
      props.impact.status === 'national_rank_withheld'
        ? [...new Set(props.impact.anomalies.map(({ regionId }) => regionLabel(regionId, registry)))]
        : [],
  });
  return (
    <StatusPanel
      tone={props.updating ? 'loading' : status.tone}
      title={props.updating ? t('Memperbarui peringkat…') : status.title}
      notes={status.limitations}
      stats={
        <dl className={styles.statusStats}>
          <div>
            <dt>{t('Wilayah dihitung')}</dt>
            <dd>{result.items.length}</dd>
          </div>
          <div>
            <dt>{t('Dari sebagian kriteria')}</dt>
            <dd>{partial}</dd>
          </div>
          <div>
            <dt>{t('Tidak diperingkat')}</dt>
            <dd>
              {result.insufficient.length > 0 ? (
                <a href="#tidak">{result.insufficient.length}</a>
              ) : (
                result.insufficient.length
              )}
            </dd>
          </div>
        </dl>
      }
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
            {t('Periksa arah skor lagi')}
          </Button>
        ) : undefined
      }
    >
      {status.trust === 'stale'
        ? props.updating
          ? t('Sedang dihitung ulang dari bobot terbaru.')
          : t('Daftar di bawah masih dihitung dari bobot sebelumnya.')
        : t('{0} dari data resmi LIVE.', counted)}
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
    return t(
      'Skenario{0} ditandai Data Hub belum dapat diperingkat di LIVE{1}. Skor yang tetap dikirim server tidak ditampilkan.',
      preset ? ` “${preset.label}”` : '',
      availability
        ? t(
            ' (hanya {0}% bobotnya punya data nasional)',
            availability.requestedWeightAvailabilityPct.toFixed(0),
          )
        : '',
    );
  }
  if (has('REQUESTED_WEIGHT_AVAILABILITY_LOW')) {
    return t(
      'Peringkat hanya ditampilkan bila minimal {0}% bobot pilihan Anda punya data untuk seluruh Indonesia{1}. Aturan ini ditetapkan Nusa Matra agar hasilnya tidak menyesatkan.',
      String(FRONTEND_MIN_REQUESTED_WEIGHT_PCT),
      requestedWeightPct === null ? '' : t('; saat ini {0}%', requestedWeightPct.toFixed(0)),
    );
  }
  if (has('SCORE_DIRECTION_MISMATCH', 'SCORE_DIRECTION_UNREPORTED')) {
    return t(
      'Arah skor dari Data Hub tidak jelas atau berbeda dari kontrak (skor tinggi = kebutuhan tinggi). Hasil ditahan agar tidak menyesatkan.',
    );
  }
  if (has('MISSING_COMPONENT', 'CRITERION_WITHOUT_DATA', 'REGION_WEIGHTS_MISSING')) {
    return t(
      'Sebagian data wilayah belum lengkap atau tidak bisa dihitung ulang. Hasil ditahan agar tidak menyesatkan.',
    );
  }
  return t('Hasil dari Data Hub tidak konsisten. Hasil ditahan agar tidak menyesatkan.');
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
      <p>{t('Data Hub perlu memperbaikinya. Antarmuka tidak menghitung ulang atau menutup selisih ini.')}</p>
    </>
  );
}

/** `high`: the Data Hub's order (rank 1 = highest need first); `low`: the same list read from the other end. */
type Order = 'high' | 'low';

const ORDER_LABEL: Readonly<Record<Order, string>> = {
  high: t('Prioritas tertinggi'),
  low: t('Terendah'),
};

interface RankingWorkspaceProps {
  readonly result: ExploratoryCompositeResultDTO;
  readonly integrity: CompositeIntegrity;
  readonly previous: ExploratoryCompositeResultDTO | null;
  readonly onShown: (result: ExploratoryCompositeResultDTO) => void;
  readonly labelOf: (id: string) => string;
  readonly seriesOf: (id: string) => number;
  readonly stale: boolean;
  /** A new calculation is running; this is the last validated ranking, kept on screen meanwhile. */
  readonly refreshing: boolean;
  readonly updating: boolean;
  /** Paspor Bukti for a focused region, or `null` when no passport may be made from this result. */
  readonly passportHrefFor: ((focusRegionId: string) => string) | null;
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
  stale,
  refreshing,
  updating,
  passportHrefFor,
}: RankingWorkspaceProps) {
  const [shown, setShown] = useState(PAGE_SIZE);
  const [order, setOrder] = useState<Order>('high');
  const [query, setQuery] = useState('');
  const [completeOnly, setCompleteOnly] = useState(false);
  // One region's breakdown open at a time; all rows start closed.
  const [openId, setOpenId] = useState<string | null>(null);
  const searchId = useId();
  const completeId = useId();

  const moves = rankMovement(previous, result);
  useEffect(() => {
    onShown(result);
  }, [result, onShown]);

  const scored = result.items.filter((item) => item.rankPosition !== null);
  const hasPartial = integrity.coverageTiers.partial > 0;
  const pool = completeOnly
    ? scored.filter(
        (item) =>
          classifyRegionCoverage(item, result.minCoveragePct, result.unavailableIndicatorIds) !== 'partial',
      )
    : scored;
  const ordered = order === 'high' ? pool : [...pool].reverse();
  const needle = query.trim().toLowerCase();
  const matching = needle
    ? ordered.filter((item) => item.regionDisplayName.toLowerCase().includes(needle))
    : ordered;
  const rows = matching.slice(0, shown);
  const basis = rankingBasis(integrity.weightsUsed);
  const { scrollRef, style: scrollStyle, revealFrom, resetScroll } = useRankScroll(rows.length, PAGE_SIZE);

  return (
    <div className={styles.results}>
      <section
        className={`glass glass--read ${styles.card} ${styles.rankingCard}`}
        aria-labelledby="lab-peringkat"
        aria-busy={refreshing || undefined}
        data-refreshing={refreshing || undefined}
      >
        <div className={styles.rankingHead}>
          <div className={styles.rankingTitleBlock}>
            <h2 id="lab-peringkat" className={styles.cardTitle}>
              {t('Peringkat wilayah')}
            </h2>
            {basis.length > 0 && (
              // What the ranking is based on: the weights actually used, largest first, one per line.
              <>
                <p id="lab-peringkat-dasar" className={styles.rankingBasisLead}>
                  {t('Berdasarkan bobot:')}
                </p>
                <ul role="list" className={styles.rankingBasis} aria-labelledby="lab-peringkat-dasar">
                  {basis.map(([id, basisPoints]) => (
                    <li key={id} className={styles.basisItem}>
                      <span>{labelOf(id)}</span>
                      <strong className="kk-number">{percentLabel(basisPoints)}</strong>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <div className={`glass-seg ${styles.orderToggle}`} role="group" aria-label={t('Urutan tampilan')}>
            {(['high', 'low'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={order === value}
                onClick={() => {
                  setOrder(value);
                  setShown(PAGE_SIZE);
                  setOpenId(null);
                  resetScroll();
                }}
              >
                {ORDER_LABEL[value]}
              </button>
            ))}
          </div>
        </div>
        <p className={styles.cardLead}>{SCORE_SUMMARY}</p>
        {stale && !updating && (
          <div className={styles.staleBanner} role="status">
            <p>{t('Total bobot belum 100%, jadi peringkat masih memakai bobot sebelumnya.')}</p>
          </div>
        )}
        <div className={styles.searchRow}>
          <label htmlFor={searchId} className={styles.visuallyHidden}>
            {t('Cari wilayah dalam peringkat')}
          </label>
          <span className={`glass-field ${styles.searchField}`}>
            <Icon name="search" size={16} className={styles.searchIcon} />
            <input
              id={searchId}
              type="search"
              value={query}
              placeholder={t('Cari kabupaten/kota')}
              onChange={(event) => {
                setQuery(event.target.value);
                setShown(PAGE_SIZE);
                resetScroll();
              }}
            />
          </span>
          <p className={styles.muted} role="status">
            {needle
              ? t('{0} hasil pencarian', String(matching.length))
              : t('{0} dari {1} wilayah', String(rows.length), String(pool.length))}
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
                setOpenId(null);
                resetScroll();
              }}
            />
            <label htmlFor={completeId}>{t('Hanya data lengkap')}</label>
            <p className={styles.hint}>
              {completeOnly
                ? t(
                    '{0} wilayah berdata sebagian disembunyikan dari tampilan ini; nomor peringkat tetap milik Data Hub dan tidak dihitung ulang.',
                    String(integrity.coverageTiers.partial),
                  )
                : t(
                    '{0} wilayah ditandai “Data sebagian”: skornya hanya memakai kriteria yang datanya ada.',
                    String(integrity.coverageTiers.partial),
                  )}
            </p>
          </div>
        )}
        {rows.length === 0 ? (
          <p className={styles.muted}>
            {needle
              ? t('Tidak ada wilayah yang cocok dengan “{0}”.', query)
              : t('Tidak ada wilayah untuk ditampilkan.')}
          </p>
        ) : (
          // The card keeps the height of the first page: further rows scroll inside it.
          <div ref={scrollRef} className={styles.rankScroll} style={scrollStyle}>
            <RankingChart
              rows={rows}
              openId={openId}
              onToggle={(regionId) => {
                setOpenId((current) => (current === regionId ? null : regionId));
              }}
              renderDetail={(item) => (
                <ContributionChart
                  item={item}
                  weightsUsed={integrity.weightsUsed}
                  labelOf={labelOf}
                  seriesOf={seriesOf}
                  passportHref={passportHrefFor?.(item.regionId) ?? null}
                />
              )}
              moves={moves}
              minCoveragePct={result.minCoveragePct}
              unavailableIndicatorIds={result.unavailableIndicatorIds}
            />
          </div>
        )}
        {shown < matching.length && (
          <Button
            variant="secondary"
            onClick={() => {
              revealFrom(shown);
              setShown((current) => current + PAGE_SIZE);
            }}
          >
            {t('Tampilkan {0} lagi', Math.min(PAGE_SIZE, matching.length - shown))}
          </Button>
        )}
      </section>
      {result.insufficient.length > 0 && <InsufficientCard result={result} labelOf={labelOf} />}
    </div>
  );
}

/**
 * One-column layouts only (hidden by CSS on desktop): the first three ranks of a validated result, so the
 * outcome shows before the settings. Rendered only for a result that is shown; a withheld or non-rankable
 * analysis has no summary, its status explains why. Ranks are the Data Hub's own.
 */
function TopSummary({ result }: { readonly result: ExploratoryCompositeResultDTO }) {
  const top = result.items.filter((item) => item.rankPosition !== null).slice(0, 3);
  if (top.length === 0) return null;
  return (
    <section className={`glass ${styles.card} ${styles.topSummary}`} aria-labelledby="lab-teratas">
      <h2 id="lab-teratas" className={styles.cardTitle}>
        {t('Tiga prioritas teratas')}
      </h2>
      <ol role="list" className={styles.topList}>
        {top.map((item) => (
          <li key={item.regionId}>
            <span className={styles.rankNumber}>{item.rankPosition}</span>
            <span>{item.regionDisplayName}</span>
            <span className={styles.rankScore}>
              {item.compositeScoreDecimal === null ? '—' : formatDecimalId(item.compositeScoreDecimal)}
            </span>
          </li>
        ))}
      </ol>
      <p className={styles.hint}>{t('Rincian setiap wilayah ada di daftar peringkat di bawah.')}</p>
    </section>
  );
}

/** Regions the Data Hub declined to rank: named, with the coverage that fell short. They never get a rank. */
function InsufficientCard({
  result,
  labelOf,
}: {
  readonly result: ExploratoryCompositeResultDTO;
  readonly labelOf: (id: string) => string;
}) {
  // The explanation under the heading and the Data Hub's per-region reason are not shown (owner
  // decision 2026-10-27); coverage, the threshold and the missing criteria stay on each row.
  return (
    <section
      id="tidak"
      className={`glass glass--read ${styles.card} ${styles.insufficientCard}`}
      aria-labelledby="lab-kurang"
    >
      <h2 id="lab-kurang" className={styles.cardTitle}>
        {t('Tidak diperingkat: data belum cukup ({0})', result.insufficient.length)}
      </h2>
      <ul role="list" className={styles.insufficientList}>
        {result.insufficient.map((region) => (
          <li key={region.regionId}>
            <span className={styles.sourceName}>
              {region.regionDisplayName} <span className={styles.code}>{region.regionId}</span>
            </span>
            <span className={styles.muted}>
              {t(
                'Cakupan {0}',
                region.coveragePct === null
                  ? t('tidak dilaporkan')
                  : `${formatDecimalId(String(region.coveragePct))}%`,
              )}
              {result.minCoveragePct !== null && t(' (ambang {0}%)', String(result.minCoveragePct))}
            </span>
            {region.coveragePct !== null && (
              <span className={styles.coverageTrack} aria-hidden="true">
                <span style={{ width: `${String(Math.max(0, Math.min(100, region.coveragePct)))}%` }} />
              </span>
            )}
            <span className={styles.rankBadges}>
              {region.componentsUsed.map((id) => (
                <span key={id} className={styles.badge}>
                  ✓ {labelOf(id)}
                </span>
              ))}
              {region.missingIndicators.length > 0 && (
                <span className={`${styles.badge} ${styles.badgeWarn}`}>
                  {t('Kosong: {0}', region.missingIndicators.map(labelOf).join(', '))}
                </span>
              )}
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
          {t(
            '{0} di {1}: nilai mentah {2}, skor terpublikasi {3}. Frontend tidak mengoreksi skor ini.',
            labelOf(indicatorId),
            regionLabel(regionId, registry),
            formatDecimalId(String(raw)),
            formatDecimalId(String(score)),
          )}
        </li>
      ))}
    </ul>
  );
}
