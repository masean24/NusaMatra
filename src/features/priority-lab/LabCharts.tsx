import { formatDecimalId } from '@/features/data-hub';
import type { ExploratoryRegionRankDTO } from '@/services/api';
import { contributions, percentLabel } from './labModel';
import styles from './PriorityLab.module.css';

/** Six series colours (theme tokens); a criterion keeps its colour across the three charts. */
export const SERIES_COUNT = 6;

interface SeriesProps {
  readonly labelOf: (id: string) => string;
  /** 0..SERIES_COUNT-1, stable per criterion. */
  readonly seriesOf: (id: string) => number;
}

function Segments({
  weights,
  seriesOf,
}: {
  readonly weights: readonly (readonly [string, number])[];
  readonly seriesOf: (id: string) => number;
}) {
  return (
    <span className={styles.stack} aria-hidden="true">
      {weights
        .filter(([, value]) => value > 0)
        .map(([id, value]) => (
          <span
            key={id}
            className={styles.stackPart}
            data-series={seriesOf(id)}
            style={{ flexGrow: value }}
          />
        ))}
    </span>
  );
}

interface WeightChartProps extends SeriesProps {
  /** The sliders' weights, in basis points. */
  readonly chosen: Readonly<Record<string, number>>;
  /** The weights the last validated calculation used; `null` until there is one. */
  readonly used: Readonly<Record<string, number>> | null;
}

/**
 * Chosen weights as one bar, and the weights the Data Hub used as a second one when they differ.
 * The legend is the text equivalent.
 */
export function WeightChart({ chosen, used, labelOf, seriesOf }: WeightChartProps) {
  const ids = Object.keys(chosen);
  const differs = used !== null && ids.some((id) => (used[id] ?? 0) !== (chosen[id] ?? 0));
  const leftOut = used === null ? [] : ids.filter((id) => (chosen[id] ?? 0) > 0 && (used[id] ?? 0) === 0);

  return (
    <figure className={`${styles.card} ${styles.chart}`}>
      <figcaption className={styles.chartTitle}>Pembagian bobot</figcaption>
      <div className={styles.barRow}>
        <span className={styles.barLabel}>Pilihan Anda</span>
        <Segments weights={ids.map((id) => [id, chosen[id] ?? 0] as const)} seriesOf={seriesOf} />
      </div>
      {differs && (
        <div className={styles.barRow}>
          <span className={styles.barLabel}>Dipakai</span>
          <Segments weights={ids.map((id) => [id, used[id] ?? 0] as const)} seriesOf={seriesOf} />
        </div>
      )}
      <ul role="list" className={styles.legend}>
        {ids.map((id) => (
          <li key={id}>
            <span className={styles.swatch} data-series={seriesOf(id)} aria-hidden="true" />
            <span className={styles.legendName}>{labelOf(id)}</span>
            <span className={styles.legendValue}>
              {percentLabel(chosen[id] ?? 0)}
              {differs && ` → ${(used[id] ?? 0) === 0 ? 'tidak dipakai' : percentLabel(used[id] ?? 0)}`}
            </span>
          </li>
        ))}
      </ul>
      {leftOut.length > 0 && (
        <p className={styles.chartNote}>
          {leftOut.map(labelOf).join(', ')} belum punya data, jadi bobotnya dibagi ke kriteria lain sesuai
          perbandingan pilihan Anda.
        </p>
      )}
    </figure>
  );
}

interface RankingChartProps {
  readonly rows: readonly ExploratoryRegionRankDTO[];
  readonly selectedId: string | null;
  readonly onSelect: (regionId: string) => void;
  /** Rank change since the previous result (positive = up). */
  readonly moves: ReadonlyMap<string, number>;
}

/** Horizontal bars, one row per region; each row selects the region for the breakdown below. */
export function RankingChart({ rows, selectedId, onSelect, moves }: RankingChartProps) {
  return (
    <ol className={styles.rankChart}>
      {rows.map((item) => {
        const score = item.compositeScoreDecimal === null ? null : Number(item.compositeScoreDecimal);
        const move = moves.get(item.regionId) ?? 0;
        return (
          <li key={item.regionId}>
            <button
              type="button"
              className={styles.rankRow}
              aria-pressed={item.regionId === selectedId}
              onClick={() => {
                onSelect(item.regionId);
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
              </span>
              <span className={styles.rankTrack} aria-hidden="true">
                <span style={{ width: `${String(Math.max(0, Math.min(100, score ?? 0)))}%` }} />
              </span>
              <span className={styles.rankScore}>
                {score === null ? 'Tidak dapat dihitung' : formatDecimalId(String(score))}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

interface ContributionChartProps extends SeriesProps {
  readonly item: ExploratoryRegionRankDTO;
  readonly weightsUsed: Readonly<Record<string, number>>;
}

/**
 * What one validated score is made of: each criterion's score × its weight, as one stacked bar and as
 * a table (the text equivalent). Only shown for results that passed the integrity check.
 */
export function ContributionChart({ item, weightsUsed, labelOf, seriesOf }: ContributionChartProps) {
  const rows = contributions(item, weightsUsed);
  const score = item.compositeScoreDecimal === null ? null : Number(item.compositeScoreDecimal);

  return (
    <figure className={`${styles.card} ${styles.chart}`} aria-labelledby={`sumbangan-${item.regionId}`}>
      <figcaption id={`sumbangan-${item.regionId}`} className={styles.chartTitle}>
        Mengapa {item.regionDisplayName} mendapat skor {score === null ? '—' : formatDecimalId(String(score))}
        ?
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
            <th scope="col">Skor 0–100</th>
            <th scope="col">Bobot</th>
            <th scope="col">Sumbangan</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">
                <span className={styles.swatch} data-series={seriesOf(row.id)} aria-hidden="true" />
                {labelOf(row.id)}
              </th>
              <td data-label="Skor">{formatDecimalId(String(row.score))}</td>
              <td data-label="Bobot">{percentLabel(row.weight)}</td>
              <td data-label="Sumbangan">{formatDecimalId(row.points.toFixed(2))}</td>
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
        Sumbangan = skor kriteria × bobot. Jumlahnya bisa selisih 0,01–0,02 karena pembulatan.
      </p>
    </figure>
  );
}
