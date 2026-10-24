/**
 * What a confirmed direction anomaly means for the ranking that is about to be shown. Pure.
 *
 * A `partial` direction verdict names imputed observations whose published score does not follow their
 * raw value (production 2026-10-23: Lanny Jaya 9507, `inf_safe_water_pct`, raw 32.89 → score 100 where
 * min–max gives 78.89). That is a KNOWN inconsistency, not missing evidence, so it fails closed for every
 * ranking output it can reach:
 * - the region is in the listed ranking and the indicator carries a positive effective weight for it:
 *   its composite score, and with it the order of the list, is distorted → the ranking is withheld;
 * - the region is outside a province-filtered list: the listed provincial scores do not use it, but
 *   `national_rank` is computed over the whole country, where it is ranked → national ranks are withheld.
 * Nothing is corrected, removed or renumbered here. `unverified`/`unverifiable` (insufficient evidence)
 * is a different case and stays a warning; `inconsistent` (independent observations out of order) is
 * blocked elsewhere and untouched.
 */
import type { DirectionVerdict } from './componentDirection';

export interface DirectionImpactCheck {
  readonly indicatorId: string;
  /** Verdict over the regions of the ranking itself. */
  readonly verdict: DirectionVerdict;
  /** Verdict over every region of the indicator (national), or `null` when it could not be made. */
  readonly nationalVerdict: DirectionVerdict | null;
}

export interface DirectionImpactRow {
  readonly regionId: string;
  /** The region's own scaled weights (v2.1); `null` = not reported, then the scenario weight is assumed. */
  readonly effectiveWeights: Readonly<Record<string, number>> | null;
}

export interface DirectionImpactInput {
  readonly checks: readonly DirectionImpactCheck[];
  /** Ranked rows as returned (never filtered or renumbered by this check). */
  readonly rows: readonly DirectionImpactRow[];
  /** Effective scenario weights in basis points; an indicator weighted 0 cannot distort anything. */
  readonly weightsUsed: Readonly<Record<string, number>>;
  /** Province filter of the ranking; `null` = national. */
  readonly filterProvinceId: string | null;
}

export interface DirectionAnomaly {
  readonly indicatorId: string;
  readonly regionId: string;
  readonly raw: number;
  readonly score: number;
}

export type DirectionImpact =
  | { readonly status: 'clear' }
  /** A listed region's score uses a known-inconsistent component: the ranking cannot be shown as valid. */
  | { readonly status: 'ranking_withheld'; readonly anomalies: readonly DirectionAnomaly[] }
  /** The list is unaffected, but its national ranks are computed with an affected region elsewhere. */
  | { readonly status: 'national_rank_withheld'; readonly anomalies: readonly DirectionAnomaly[] };

const anomaliesOf = (indicatorId: string, verdict: DirectionVerdict | null): DirectionAnomaly[] =>
  verdict?.status === 'partial'
    ? verdict.unverified.map((item) => ({
        indicatorId,
        regionId: item.regionId,
        raw: item.raw,
        score: item.score,
      }))
    : [];

export function assessDirectionImpact(input: DirectionImpactInput): DirectionImpact {
  const rowsById = new Map(input.rows.map((row) => [row.regionId, row]));
  const inRanking: DirectionAnomaly[] = [];
  const outside: DirectionAnomaly[] = [];

  for (const check of input.checks) {
    const scenarioWeight = input.weightsUsed[check.indicatorId] ?? 0;
    if (scenarioWeight <= 0) continue;

    for (const anomaly of anomaliesOf(check.indicatorId, check.verdict)) {
      const row = rowsById.get(anomaly.regionId);
      // Fail closed: without a per-region weight the scenario weight is what the score used.
      const weight = row?.effectiveWeights ? (row.effectiveWeights[check.indicatorId] ?? 0) : scenarioWeight;
      if (weight > 0) inRanking.push(anomaly);
    }

    // A national list already contains every ranked region, so only a filtered one can be reached from outside.
    if (input.filterProvinceId === null) continue;
    for (const anomaly of anomaliesOf(check.indicatorId, check.nationalVerdict)) {
      if (!rowsById.has(anomaly.regionId)) outside.push(anomaly);
    }
  }

  if (inRanking.length > 0) return { status: 'ranking_withheld', anomalies: inRanking };
  if (outside.length > 0) return { status: 'national_rank_withheld', anomalies: outside };
  return { status: 'clear' };
}
