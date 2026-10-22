/**
 * Checks a composite (weighted-average) ranking returned by the Data Hub against its own parts,
 * so a backend calculation or coverage error is DETECTED and reported, never silently repaired in
 * the frontend. Pure: no UI, no network.
 *
 * Each issue either blocks the ranking (`block`: it cannot be trusted as returned) or only has to be
 * disclosed next to it (`disclose`: the ranking is sound for the regions it covers, but the user
 * must be told what it leaves out).
 */
import { TOTAL_BASIS_POINTS } from './weights';

/** Largest gap between the reported score and the weighted sum of its (2-decimal) components. */
export const SCORE_TOLERANCE = 0.05;
/** Composite and component scores are on a 0–100 scale. */
const SCORE_MIN = 0;
const SCORE_MAX = 100;

export interface CompositeRowInput {
  readonly regionId: string;
  readonly rankPosition: number | null;
  readonly compositeScore: number | null;
  /** Normalised 0–100 score per weighted indicator; `null` = unavailable. */
  readonly componentScores: Readonly<Record<string, number | null>>;
}

export interface CompositeIntegrityInput {
  /** The weights as the response echoes them (`weights_basis_points`). */
  readonly weightsBasisPoints: Readonly<Record<string, number>>;
  /** What the response says its coverage is (`total_regions`). */
  readonly reportedTotalRegions: number;
  readonly rows: readonly CompositeRowInput[];
  /** The region registry's own size for the same snapshot and filter, when known. */
  readonly registryRegionCount?: number | null;
  /** The weights the request sent; the echo must match them exactly. */
  readonly requestedWeights?: Readonly<Record<string, number>> | null;
  /** Guide v2 provenance; `null`/absent = not reported (v1), and the echoed weights are used. */
  readonly effectiveWeightsBasisPoints?: Readonly<Record<string, number>> | null;
  readonly unavailableIndicatorIds?: readonly string[] | null;
  readonly renormalized?: boolean | null;
  /** 2-digit province code the request was limited to; every region code must start with it. */
  readonly filterProvinceId?: string | null;
}

export type CompositeIssueCode =
  | 'WEIGHTS_NOT_100_PERCENT'
  | 'WEIGHTS_ECHO_MISMATCH'
  | 'EFFECTIVE_WEIGHTS_NOT_100_PERCENT'
  | 'RENORMALIZATION_INCONSISTENT'
  | 'REPORTED_COUNT_MISMATCH'
  | 'REGISTRY_COUNT_MISMATCH'
  | 'DUPLICATE_REGION'
  | 'SCORE_OUT_OF_RANGE'
  | 'SCORE_MISMATCH'
  | 'RANK_ORDER'
  | 'RANK_BEYOND_POPULATION'
  | 'MISSING_COMPONENT'
  | 'CRITERION_WITHOUT_DATA'
  | 'PROVINCE_FILTER_MISMATCH';

export type CompositeIssueSeverity = 'block' | 'disclose';

export interface CompositeIssue {
  readonly code: CompositeIssueCode;
  readonly severity: CompositeIssueSeverity;
  /** Indonesian, shown to the user as the reason a ranking is withheld or qualified. */
  readonly message: string;
  /** Rows affected (or the size of the gap, for count mismatches). */
  readonly count: number;
  /** Up to a few affected region codes, so a report can name concrete counterexamples. */
  readonly examples?: readonly string[];
}

export interface CompositeIntegrity {
  /** No blocking issue: the ranking may be shown, with any `disclose` issues next to it. */
  readonly ok: boolean;
  readonly issues: readonly CompositeIssue[];
  /** Largest |reported − recomputed| over all complete rows with a score; 0 when there are none. */
  readonly maxScoreError: number;
  /** The weights the scores were checked against: effective weights when reported. */
  readonly weightsUsed: Readonly<Record<string, number>>;
}

const MAX_EXAMPLES = 5;
const n = (value: number) => String(value);
const sumOf = (weights: Readonly<Record<string, number>>) =>
  Object.values(weights).reduce((sum, value) => sum + value, 0);

function sameWeights(a: Readonly<Record<string, number>>, b: Readonly<Record<string, number>>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => (a[key] ?? 0) === (b[key] ?? 0));
}

/**
 * Effective weights must be the requested weights of the indicators that have data, scaled to
 * 10 000. Integer rounding may move each one by at most 1 basis point.
 */
function renormalizationProblem(
  echoed: Readonly<Record<string, number>>,
  effective: Readonly<Record<string, number>>,
  unavailable: readonly string[],
  renormalized: boolean | null,
): string | null {
  const kept = Object.keys(echoed).filter((id) => (echoed[id] ?? 0) > 0 && !unavailable.includes(id));
  const extra = Object.keys(effective).filter((id) => !kept.includes(id) && (effective[id] ?? 0) > 0);
  if (extra.length > 0)
    return `Bobot efektif memuat indikator yang tidak diminta atau dinyatakan kosong: ${extra.join(', ')}.`;
  const unknown = unavailable.filter((id) => !(id in echoed));
  if (unknown.length > 0)
    return `Indikator yang dinyatakan kosong tidak ada di permintaan: ${unknown.join(', ')}.`;
  const keptTotal = kept.reduce((sum, id) => sum + (echoed[id] ?? 0), 0);
  if (keptTotal === 0) return 'Tidak ada indikator berdata yang tersisa untuk diberi bobot.';
  const drifted = kept.filter((id) => {
    const exact = ((echoed[id] ?? 0) * TOTAL_BASIS_POINTS) / keptTotal;
    return Math.abs((effective[id] ?? 0) - exact) > 1;
  });
  if (drifted.length > 0)
    return `Bobot efektif tidak sebanding dengan bobot yang diminta untuk: ${drifted.join(', ')}.`;
  const redistributed = unavailable.some((id) => (echoed[id] ?? 0) > 0);
  if (renormalized !== null && renormalized !== redistributed) {
    return renormalized
      ? 'Respons menyatakan bobot dialihkan, padahal tidak ada indikator berbobot yang kosong.'
      : 'Ada indikator berbobot yang kosong, tetapi respons menyatakan bobot tidak dialihkan.';
  }
  return null;
}

export function assessCompositeIntegrity(input: CompositeIntegrityInput): CompositeIntegrity {
  const issues: CompositeIssue[] = [];
  const block = (code: CompositeIssueCode, message: string, count: number, examples?: string[]) => {
    issues.push({ code, severity: 'block', message, count, ...(examples ? { examples } : {}) });
  };
  const { weightsBasisPoints: echoed, rows } = input;

  const echoedTotal = sumOf(echoed);
  if (echoedTotal !== TOTAL_BASIS_POINTS) {
    block(
      'WEIGHTS_NOT_100_PERCENT',
      `Bobot yang dikembalikan berjumlah ${n(echoedTotal)} basis poin, bukan ${n(TOTAL_BASIS_POINTS)}.`,
      Math.abs(echoedTotal - TOTAL_BASIS_POINTS),
    );
  }
  if (input.requestedWeights && !sameWeights(input.requestedWeights, echoed)) {
    block('WEIGHTS_ECHO_MISMATCH', 'Bobot yang dikembalikan tidak sama dengan bobot yang dikirim.', 1);
  }

  const effective = input.effectiveWeightsBasisPoints ?? null;
  const unavailable = input.unavailableIndicatorIds ?? [];
  if (effective !== null) {
    const effectiveTotal = sumOf(effective);
    if (effectiveTotal !== TOTAL_BASIS_POINTS) {
      block(
        'EFFECTIVE_WEIGHTS_NOT_100_PERCENT',
        `Bobot yang benar-benar dipakai berjumlah ${n(effectiveTotal)} basis poin, bukan ${n(TOTAL_BASIS_POINTS)}.`,
        Math.abs(effectiveTotal - TOTAL_BASIS_POINTS),
      );
    }
    const problem = renormalizationProblem(echoed, effective, unavailable, input.renormalized ?? null);
    if (problem) block('RENORMALIZATION_INCONSISTENT', problem, 1);
  }
  // Scores are checked against the weights actually used.
  const weightsUsed = effective ?? echoed;
  const indicatorIds = Object.keys(weightsUsed).filter((id) => (weightsUsed[id] ?? 0) > 0);

  if (input.reportedTotalRegions !== rows.length) {
    block(
      'REPORTED_COUNT_MISMATCH',
      `Respons menyebut ${n(input.reportedTotalRegions)} wilayah tetapi hanya memuat ${n(rows.length)}.`,
      Math.abs(input.reportedTotalRegions - rows.length),
    );
  }
  const registry = input.registryRegionCount ?? null;
  if (registry !== null && registry !== rows.length) {
    issues.push({
      code: 'REGISTRY_COUNT_MISMATCH',
      // Sound for the regions it covers, provided every covered row passes the checks below.
      severity: registry > rows.length ? 'disclose' : 'block',
      message:
        registry > rows.length
          ? `${n(registry - rows.length)} dari ${n(registry)} wilayah tidak masuk peringkat; peringkat hanya berlaku untuk ${n(rows.length)} wilayah yang dihitung.`
          : `Peringkat memuat ${n(rows.length)} wilayah, lebih banyak dari ${n(registry)} wilayah di daftar snapshot ini.`,
      count: Math.abs(registry - rows.length),
    });
  }

  const province = input.filterProvinceId ?? null;
  if (province !== null) {
    const outside = rows.filter((row) => !row.regionId.startsWith(province)).map((row) => row.regionId);
    if (outside.length > 0) {
      block(
        'PROVINCE_FILTER_MISMATCH',
        `${n(outside.length)} wilayah di luar provinsi ${province} ikut dalam peringkat yang difilter.`,
        outside.length,
        outside.slice(0, MAX_EXAMPLES),
      );
    }
  }

  const seen = new Set<string>();
  const duplicates: string[] = [];
  const outOfRange: string[] = [];
  const missing: string[] = [];
  let zeroFilled = 0;
  const mismatched: string[] = [];
  let maxScoreError = 0;
  for (const row of rows) {
    if (seen.has(row.regionId)) duplicates.push(row.regionId);
    seen.add(row.regionId);
    if (row.compositeScore === null) continue;

    const components = indicatorIds.map((id) => row.componentScores[id] ?? null);
    const inRange = (value: number) => Number.isFinite(value) && value >= SCORE_MIN && value <= SCORE_MAX;
    if (!inRange(row.compositeScore) || components.some((value) => value !== null && !inRange(value))) {
      outOfRange.push(row.regionId);
      continue;
    }

    let weightedSum = 0;
    let complete = true;
    for (const [index, id] of indicatorIds.entries()) {
      const component = components[index] ?? null;
      if (component === null) complete = false;
      else weightedSum += (component * (weightsUsed[id] ?? 0)) / TOTAL_BASIS_POINTS;
    }
    if (!complete) {
      // A score built from fewer components than were weighted is not a like-for-like average. If it
      // only reproduces with the empty component counted as 0, the backend treated "no data" as 0.
      missing.push(row.regionId);
      if (Math.abs(row.compositeScore - weightedSum) <= SCORE_TOLERANCE) zeroFilled += 1;
      continue;
    }
    const error = Math.abs(row.compositeScore - weightedSum);
    maxScoreError = Math.max(maxScoreError, error);
    if (error > SCORE_TOLERANCE) mismatched.push(row.regionId);
  }

  // A weighted criterion with no value for any region contributes nothing, yet still takes its share of the weight.
  const withoutData = indicatorIds.filter(
    (id) => rows.length > 0 && rows.every((row) => (row.componentScores[id] ?? null) === null),
  );
  if (withoutData.length > 0) {
    block(
      'CRITERION_WITHOUT_DATA',
      `Kriteria berikut berbobot tetapi tidak punya data untuk satu pun wilayah: ${withoutData.join(', ')}.`,
      withoutData.length,
    );
  }
  if (duplicates.length > 0) {
    block(
      'DUPLICATE_REGION',
      `${n(duplicates.length)} wilayah muncul lebih dari sekali.`,
      duplicates.length,
      duplicates.slice(0, MAX_EXAMPLES),
    );
  }
  if (outOfRange.length > 0) {
    block(
      'SCORE_OUT_OF_RANGE',
      `${n(outOfRange.length)} wilayah punya skor di luar rentang 0–100 atau bukan angka.`,
      outOfRange.length,
      outOfRange.slice(0, MAX_EXAMPLES),
    );
  }
  if (missing.length > 0) {
    block(
      'MISSING_COMPONENT',
      `${n(missing.length)} wilayah punya skor gabungan tanpa semua skor komponen berbobot.` +
        (zeroFilled === missing.length
          ? ' Skor itu hanya cocok bila data yang kosong dihitung sebagai 0, padahal data kosong bukan nol.'
          : ' Skor itu tidak bisa dihitung ulang dari komponennya.'),
      missing.length,
      missing.slice(0, MAX_EXAMPLES),
    );
  }
  if (mismatched.length > 0) {
    block(
      'SCORE_MISMATCH',
      `${n(mismatched.length)} skor gabungan tidak sama dengan jumlah berbobot skor komponennya (selisih terbesar ${maxScoreError.toFixed(2)}).`,
      mismatched.length,
      mismatched.slice(0, MAX_EXAMPLES),
    );
  }

  // Ranks run 1..n in score order. Equal scores may share a rank (1, 1, 3): the next distinct score
  // then takes its position.
  const scored = rows.filter((row) => row.compositeScore !== null);
  let rankViolations = 0;
  let beyond = 0;
  scored.forEach((row, index) => {
    const score = row.compositeScore ?? 0;
    const previous = index > 0 ? scored[index - 1] : undefined;
    const sharesPrevious =
      previous !== undefined &&
      previous.compositeScore === score &&
      row.rankPosition === previous.rankPosition;
    if (
      (previous && score > (previous.compositeScore ?? 0) + 1e-9) ||
      (row.rankPosition !== index + 1 && !sharesPrevious)
    ) {
      rankViolations += 1;
    }
    if (row.rankPosition !== null && row.rankPosition > scored.length) beyond += 1;
  });
  if (rankViolations > 0) {
    block(
      'RANK_ORDER',
      `Urutan peringkat tidak konsisten dengan skor pada ${n(rankViolations)} baris.`,
      rankViolations,
    );
  }
  if (beyond > 0) {
    block(
      'RANK_BEYOND_POPULATION',
      `${n(beyond)} wilayah diberi peringkat lebih besar dari jumlah wilayah yang dihitung (${n(scored.length)}).`,
      beyond,
    );
  }

  return { ok: issues.every((issue) => issue.severity !== 'block'), issues, maxScoreError, weightsUsed };
}
