/**
 * Checks a composite (weighted-average) ranking returned by the Data Hub against its own parts,
 * so a backend calculation or coverage error is DETECTED and reported, never silently repaired in
 * the frontend. Pure: no UI, no network.
 */
import { TOTAL_BASIS_POINTS } from './weights';

/** Largest gap between the reported score and the weighted sum of its (2-decimal) components. */
export const SCORE_TOLERANCE = 0.05;

export interface CompositeRowInput {
  readonly regionId: string;
  readonly rankPosition: number | null;
  readonly compositeScore: number | null;
  /** Normalised 0–100 score per weighted indicator; `null` = unavailable. */
  readonly componentScores: Readonly<Record<string, number | null>>;
}

export interface CompositeIntegrityInput {
  readonly weightsBasisPoints: Readonly<Record<string, number>>;
  /** What the response says its coverage is (`total_regions`). */
  readonly reportedTotalRegions: number;
  readonly rows: readonly CompositeRowInput[];
  /** The region registry's own size for the same snapshot, when known (514 kabupaten/kota in DEMO). */
  readonly registryRegionCount?: number | null;
}

export type CompositeIssueCode =
  | 'WEIGHTS_NOT_100_PERCENT'
  | 'REPORTED_COUNT_MISMATCH'
  | 'REGISTRY_COUNT_MISMATCH'
  | 'DUPLICATE_REGION'
  | 'SCORE_MISMATCH'
  | 'RANK_ORDER'
  | 'MISSING_COMPONENT'
  | 'CRITERION_WITHOUT_DATA';

export interface CompositeIssue {
  readonly code: CompositeIssueCode;
  /** Indonesian, shown to the user as the reason a ranking is withheld or flagged. */
  readonly message: string;
  /** Rows affected (or the size of the gap, for count mismatches). */
  readonly count: number;
}

export interface CompositeIntegrity {
  readonly ok: boolean;
  readonly issues: readonly CompositeIssue[];
  /** Largest |reported − recomputed| over all rows with a score; 0 when there are none. */
  readonly maxScoreError: number;
}

const n = (value: number) => String(value);

export function assessCompositeIntegrity(input: CompositeIntegrityInput): CompositeIntegrity {
  const issues: CompositeIssue[] = [];
  const { weightsBasisPoints, rows } = input;
  const indicatorIds = Object.keys(weightsBasisPoints);

  const weightTotal = Object.values(weightsBasisPoints).reduce((sum, value) => sum + value, 0);
  if (weightTotal !== TOTAL_BASIS_POINTS) {
    issues.push({
      code: 'WEIGHTS_NOT_100_PERCENT',
      message: `Bobot yang dikembalikan berjumlah ${n(weightTotal)} basis poin, bukan ${n(TOTAL_BASIS_POINTS)}.`,
      count: Math.abs(weightTotal - TOTAL_BASIS_POINTS),
    });
  }

  if (input.reportedTotalRegions !== rows.length) {
    issues.push({
      code: 'REPORTED_COUNT_MISMATCH',
      message: `Respons menyebut ${n(input.reportedTotalRegions)} wilayah tetapi hanya memuat ${n(rows.length)}.`,
      count: Math.abs(input.reportedTotalRegions - rows.length),
    });
  }
  const registry = input.registryRegionCount ?? null;
  if (registry !== null && registry !== rows.length) {
    issues.push({
      code: 'REGISTRY_COUNT_MISMATCH',
      message: `Peringkat memuat ${n(rows.length)} wilayah, sedangkan daftar wilayah snapshot ini ${n(registry)}: cakupannya tidak lengkap.`,
      count: Math.abs(registry - rows.length),
    });
  }

  const seen = new Set<string>();
  let duplicates = 0;
  let missingComponents = 0;
  let zeroFilled = 0;
  let scoreMismatches = 0;
  let maxScoreError = 0;
  for (const row of rows) {
    if (seen.has(row.regionId)) duplicates += 1;
    seen.add(row.regionId);
    if (row.compositeScore === null) continue;

    let weightedSum = 0;
    let complete = true;
    for (const id of indicatorIds) {
      const component = row.componentScores[id];
      if (component === null || component === undefined) {
        complete = false;
        continue;
      }
      weightedSum += (component * (weightsBasisPoints[id] ?? 0)) / TOTAL_BASIS_POINTS;
    }
    if (!complete) {
      // A score built from fewer components than were weighted is not a like-for-like average. If it
      // only reproduces with the empty component counted as 0, the backend treated "no data" as 0.
      missingComponents += 1;
      if (Math.abs(row.compositeScore - weightedSum) <= SCORE_TOLERANCE) zeroFilled += 1;
      continue;
    }
    const error = Math.abs(row.compositeScore - weightedSum);
    maxScoreError = Math.max(maxScoreError, error);
    if (error > SCORE_TOLERANCE) scoreMismatches += 1;
  }
  // A weighted criterion with no value for any region contributes nothing, yet still takes its share of the weight.
  const withoutData = indicatorIds.filter(
    (id) => rows.length > 0 && rows.every((row) => (row.componentScores[id] ?? null) === null),
  );
  if (withoutData.length > 0) {
    issues.push({
      code: 'CRITERION_WITHOUT_DATA',
      message: `Kriteria berikut berbobot tetapi tidak punya data untuk satu pun wilayah: ${withoutData.join(', ')}.`,
      count: withoutData.length,
    });
  }
  if (duplicates > 0) {
    issues.push({
      code: 'DUPLICATE_REGION',
      message: `${n(duplicates)} wilayah muncul lebih dari sekali.`,
      count: duplicates,
    });
  }
  if (missingComponents > 0) {
    issues.push({
      code: 'MISSING_COMPONENT',
      message:
        `${n(missingComponents)} wilayah punya skor gabungan tanpa semua skor komponen berbobot.` +
        (zeroFilled === missingComponents
          ? ' Skor itu hanya cocok bila data yang kosong dihitung sebagai 0, padahal data kosong bukan nol.'
          : ' Skor itu tidak bisa dihitung ulang dari komponennya.'),
      count: missingComponents,
    });
  }
  if (scoreMismatches > 0) {
    issues.push({
      code: 'SCORE_MISMATCH',
      message: `${n(scoreMismatches)} skor gabungan tidak sama dengan jumlah berbobot skor komponennya (selisih terbesar ${maxScoreError.toFixed(2)}).`,
      count: scoreMismatches,
    });
  }

  let rankViolations = 0;
  let previousScore = Number.POSITIVE_INFINITY;
  rows
    .filter((row) => row.compositeScore !== null)
    .forEach((row, index) => {
      const score = row.compositeScore ?? 0;
      if (row.rankPosition !== index + 1 || score > previousScore + 1e-9) rankViolations += 1;
      previousScore = score;
    });
  if (rankViolations > 0) {
    issues.push({
      code: 'RANK_ORDER',
      message: `Urutan peringkat tidak konsisten dengan skor pada ${n(rankViolations)} baris.`,
      count: rankViolations,
    });
  }

  return { ok: issues.length === 0, issues, maxScoreError };
}
