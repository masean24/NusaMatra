import { surfaceClassName } from '@/components/ui/Surface/surfaceClassName';
import type { Ranking } from '@/domain/prioritization';
import { formatDecimal } from '@/lib/format';
import { useFlipReorder } from './useFlipReorder';
import styles from './DemoRanking.module.css';

interface DemoRankingProps<CriterionId extends string> {
  readonly ranking: Ranking<CriterionId>;
  /** Rank each region had in the scenario shown before, to label movement ("naik 1"). */
  readonly previousRanks: ReadonlyMap<string, number> | null;
  readonly reducedMotion: boolean;
}

/* G6: the rows trade places once (FLIP, 320ms) and the change chip pulses once. */
const FLIP_MS = 320;
const EASE_CALM = 'cubic-bezier(0.16, 1, 0.3, 1)';

export function DemoRanking<CriterionId extends string>({
  ranking,
  previousRanks,
  reducedMotion,
}: DemoRankingProps<CriterionId>) {
  const orderKey = ranking.ranked.map((entry) => entry.region.code).join('|');
  const rowRef = useFlipReorder(orderKey, FLIP_MS, EASE_CALM, reducedMotion);

  return (
    <ol role="list" className={styles.list} aria-live="polite">
      {ranking.ranked.map((entry) => {
        const before = previousRanks?.get(entry.region.code);
        const moved = before === undefined ? 0 : before - entry.rank;
        return (
          <li
            key={entry.region.code}
            ref={rowRef(entry.region.code)}
            className={surfaceClassName('control', styles.row)}
          >
            <span className={`kk-number ${styles.rank}`}>{entry.rank}</span>
            <span className={`kk-body-strong ${styles.name}`}>
              {entry.region.name}
              {moved > 0 && <span className={styles.change}>Naik {moved}</span>}
              {moved < 0 && <span className={`${styles.change} ${styles.down}`}>Turun {-moved}</span>}
            </span>
            <span className={`kk-number ${styles.score}`}>
              <span className="visually-hidden">Skor </span>
              {formatDecimal(entry.score)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
