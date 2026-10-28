import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { ButtonLink } from '@/components/ui/Button/Button';
import { classifyCoverage } from '@/domain/prioritization';
import { formatDecimalId } from '@/features/data-hub';
import { prefersReducedMotion } from '@/features/motion';
import type { ExploratoryRegionRankDTO } from '@/services/api';
import { contributions, imputedCriteria, percentLabel, qualityFlagLabel } from './labModel';
import styles from './PriorityLab.module.css';

/** Composite scores always with two decimals (Indonesian comma), e.g. 72,80. */
function formatScore(score: number): string {
  return score.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Six series colours (theme tokens); a criterion keeps its colour across the three charts. */
export const SERIES_COUNT = 6;

interface SeriesProps {
  readonly labelOf: (id: string) => string;
  /** 0..SERIES_COUNT-1, stable per criterion. */
  readonly seriesOf: (id: string) => number;
}

interface RankingChartProps {
  readonly rows: readonly ExploratoryRegionRankDTO[];
  /** The one region whose breakdown is open, if any. */
  readonly openId: string | null;
  readonly onToggle: (regionId: string) => void;
  /** The breakdown shown under an open row. */
  readonly renderDetail: (item: ExploratoryRegionRankDTO) => ReactNode;
  /** Rank change since the previous result (positive = up). */
  readonly moves: ReadonlyMap<string, number>;
  /** The Data Hub's per-region coverage threshold, to tell a complete region from a partial one. */
  readonly minCoveragePct: number | null;
}

/**
 * After a recalculation, rows that changed place glide from their old position to the new one
 * (FLIP: measure, invert with a transform, play to none), on the "Halus" spring. Positions are
 * read relative to the list, so scrolling never counts as a move; only rows whose region changed
 * place animate, and the rows themselves are never re-created. Reduced motion jumps.
 */
function useRowMoves(listRef: RefObject<HTMLOListElement | null>, rows: readonly ExploratoryRegionRankDTO[]) {
  const positions = useRef(new Map<string, number>());
  const order = rows.map((row) => row.regionId).join(',');
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const easing =
      getComputedStyle(document.documentElement).getPropertyValue('--nm-spring-halus').trim() || 'ease-out';
    const next = new Map<string, number>();
    for (const element of list.children) {
      if (!(element instanceof HTMLElement) || !element.dataset.regionId) continue;
      const top = element.offsetTop;
      next.set(element.dataset.regionId, top);
      const before = positions.current.get(element.dataset.regionId);
      if (before === undefined || Math.abs(before - top) < 1 || prefersReducedMotion()) continue;
      element.animate([{ transform: `translateY(${String(before - top)}px)` }, { transform: 'none' }], {
        duration: 460,
        easing,
      });
    }
    positions.current = next;
  }, [listRef, order]);
}

/**
 * Horizontal bars, one row per region, as an accordion: a row opens its breakdown right under it, one
 * region at a time. The rank is the Data Hub's own (1 = highest need; equal scores share a rank). A region
 * built from only some of the criteria, or using a province-level estimate, says so in words on its row.
 * The row's toggle holds only text; the breakdown's links sit beside it, never inside a button.
 */
export function RankingChart({
  rows,
  openId,
  onToggle,
  renderDetail,
  moves,
  minCoveragePct,
}: RankingChartProps) {
  const listRef = useRef<HTMLOListElement>(null);
  useRowMoves(listRef, rows);

  return (
    <ol ref={listRef} className={`glass-group ${styles.rankChart}`}>
      {rows.map((item) => {
        const score = item.compositeScoreDecimal === null ? null : Number(item.compositeScoreDecimal);
        const move = moves.get(item.regionId) ?? 0;
        const partial = classifyCoverage(item.coveragePct, minCoveragePct) === 'partial';
        const imputed = imputedCriteria(item).length > 0;
        const open = item.regionId === openId;
        const detailId = `rincian-${item.regionId}`;
        return (
          <li key={item.regionId} data-region-id={item.regionId} data-open={open || undefined}>
            <button
              type="button"
              className={`glass-row ${styles.rankRow}`}
              aria-expanded={open}
              aria-controls={detailId}
              onClick={() => {
                onToggle(item.regionId);
              }}
            >
              <span className={styles.rankNumber}>{item.rankPosition ?? '—'}</span>
              <span className={styles.rankName}>
                {item.regionDisplayName}
                {move !== 0 && (
                  <span className={styles.rankMove}>
                    {move > 0 ? ` ▲ naik ${String(move)}` : ` ▼ turun ${String(-move)}`}
                  </span>
                )}
                {(partial ||
                  imputed ||
                  (item.nationalRank !== null && item.nationalRank !== item.rankPosition)) && (
                  <span className={styles.rankBadges}>
                    {partial && (
                      <span className={`${styles.badge} ${styles.badgeWarn}`}>
                        Data sebagian · {formatDecimalId(String(item.coveragePct))}% bobot
                      </span>
                    )}
                    {imputed && (
                      <span className={`${styles.badge} ${styles.badgeWarn}`}>Estimasi tingkat provinsi</span>
                    )}
                    {item.nationalRank !== null && item.nationalRank !== item.rankPosition && (
                      <span className={styles.badge}>Peringkat nasional {item.nationalRank}</span>
                    )}
                  </span>
                )}
              </span>
              <span className={styles.rankTrack} aria-hidden="true">
                <span style={{ width: `${String(Math.max(0, Math.min(100, score ?? 0)))}%` }} />
              </span>
              <span className={styles.rankScore}>
                {score === null ? 'Tidak dapat dihitung' : formatScore(score)}
              </span>
              <span className={styles.chevron} aria-hidden="true" />
            </button>
            <div id={detailId} className={styles.rankDetail} hidden={!open}>
              {open && renderDetail(item)}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

interface ContributionChartProps extends SeriesProps {
  readonly item: ExploratoryRegionRankDTO;
  readonly weightsUsed: Readonly<Record<string, number>>;
  /** Paspor Bukti for this region, or `null` when the result may not be turned into one. */
  readonly passportHref: string | null;
}

/**
 * What one validated score is made of: each criterion's score × its weight (the region's own effective
 * weight), as one stacked bar and as a table (the text equivalent). Shown inside the region's ranking row,
 * and only for results that passed the integrity check.
 */
export function ContributionChart({
  item,
  weightsUsed,
  labelOf,
  seriesOf,
  passportHref,
}: ContributionChartProps) {
  const rows = contributions(item, weightsUsed);
  const omitted = item.missingIndicators ?? [];
  const partial = omitted.length > 0 && item.coveragePct !== null && item.coveragePct < 100;
  const score = item.compositeScoreDecimal === null ? null : Number(item.compositeScoreDecimal);

  return (
    <figure className={`${styles.chart} ${styles.whyDetail}`} aria-labelledby={`sumbangan-${item.regionId}`}>
      <figcaption id={`sumbangan-${item.regionId}`} className={styles.chartTitle}>
        Mengapa {score === null ? '—' : formatScore(score)}?
        <span className={styles.visuallyHidden}> Rincian skor {item.regionDisplayName}</span>
      </figcaption>
      <span className={styles.contributionTrack} aria-hidden="true">
        {rows.map((row) => (
          <span
            key={row.id}
            className={styles.stackPart}
            data-series={seriesOf(row.id)}
            style={{ width: `${String(Math.max(0, row.points))}%` }}
          />
        ))}
      </span>
      <table className={`${styles.table} ${styles.contributionTable}`}>
        <caption className={styles.visuallyHidden}>
          Sumbangan setiap kriteria ke skor {item.regionDisplayName}
        </caption>
        <thead>
          <tr>
            <th scope="col">Kriteria</th>
            <th scope="col">
              Skor<span className={styles.visuallyHidden}> 0–100</span>
            </th>
            <th scope="col">
              Bobot<span className={styles.visuallyHidden}> wilayah ini</span>
            </th>
            <th scope="col">Sumbangan</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">
                <span className={styles.swatch} data-series={seriesOf(row.id)} aria-hidden="true" />
                {labelOf(row.id)}
                {row.quality !== null && row.quality !== 'VERIFIED' && (
                  <span className={`${styles.badge} ${styles.badgeWarn}`}>
                    {qualityFlagLabel(row.quality)}
                  </span>
                )}
              </th>
              <td data-label="Skor">{formatDecimalId(String(row.score))}</td>
              <td data-label="Bobot">{percentLabel(row.weight)}</td>
              <td data-label="Sumbangan">{formatScore(row.points)}</td>
            </tr>
          ))}
          {omitted.map((id) => (
            <tr key={id}>
              <th scope="row">
                <span className={styles.swatch} data-series={seriesOf(id)} aria-hidden="true" />
                {labelOf(id)}
              </th>
              <td data-label="Skor" colSpan={3}>
                Data tidak tersedia untuk wilayah ini — tidak dihitung, bukan dihitung sebagai 0
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={3}>
              Skor gabungan
            </th>
            <td>{score === null ? '—' : formatDecimalId(String(score))}</td>
          </tr>
        </tfoot>
      </table>
      <p className={styles.chartNote}>
        Sumbangan = skor kriteria × bobot wilayah ini, pada skala 100. Jumlahnya bisa selisih 0,01–0,03 karena
        pembulatan.
        {partial &&
          ` Wilayah ini dihitung dari sebagian kriteria saja (cakupan ${formatDecimalId(String(item.coveragePct))}%): bobot kriteria yang datanya kosong dialihkan ke kriteria lain.`}
        {imputedCriteria(item).length > 0 &&
          ' Sedikitnya satu nilai berasal dari estimasi tingkat provinsi, bukan pengukuran kabupaten/kota.'}
      </p>
      <div className={styles.whyActions}>
        {passportHref && (
          <ButtonLink variant="secondary" to={passportHref}>
            Buka Paspor Bukti
          </ButtonLink>
        )}
        <ButtonLink variant="secondary" to={`/bandingkan?a=${encodeURIComponent(item.regionId)}`}>
          Bandingkan
        </ButtonLink>
      </div>
    </figure>
  );
}
