/**
 * Checks a composite (weighted-average) ranking returned by the Data Hub against its own parts,
 * so a backend calculation or coverage error is DETECTED and reported, never silently repaired in
 * the frontend. Pure: no UI, no network.
 *
 * Each issue either blocks the ranking (`block`: it cannot be trusted as returned) or only has to be
 * disclosed next to it (`disclose`: the ranking is sound for the regions it covers, but the user
 * must be told what it leaves out).
 *
 * Contract v2.1 (`score_direction: higher_is_need`): a higher score means a higher intervention need and
 * rank 1 is the highest need. Every ranked region carries its own `effective_weights_region` (10 000 bps
 * over the components it actually has); its score is reconstructed with THOSE weights. Two different
 * "coverages" exist and are kept apart on purpose:
 * - per-region `coverage_pct` (how much of the nationally available weight THIS region has data for);
 * - requested-weight availability (how much of the weight the USER asked for sits on indicators that
 *   have data nationally at all). Only the second one drives the Nusa Matra frontend policy gate.
 */
import { TOTAL_BASIS_POINTS } from './weights';

/**
 * Largest gap between the reported score and the weighted sum of its (2-decimal) components for the
 * legacy (pre-v2.1, global weights) path. Kept as it was; v2.1 rows use `scoreToleranceFor`.
 */
export const SCORE_TOLERANCE = 0.05;

/** The only score orientation this frontend understands. */
export const EXPECTED_SCORE_DIRECTION = 'higher_is_need';

/**
 * NUSA MATRA FRONTEND PRODUCT POLICY, not a Data Hub rule: a ranking is only presented when at least
 * this share (percent) of the weight the user asked for sits on indicators with national data. Below it
 * most of the user's scenario would be silently replaced by the remaining criteria.
 */
export const FRONTEND_MIN_REQUESTED_WEIGHT_PCT = 70;

/** Composite and component scores are on a 0–100 scale. */
const SCORE_MIN = 0;
const SCORE_MAX = 100;

/** Reported coverage is rounded to one decimal; allow that much against the value derived from the weights. */
const COVERAGE_PCT_TOLERANCE = 0.1;
/** A region's weights are integers: rounding may move each one by at most 1 basis point. */
const WEIGHT_ROUNDING_BPS = 1;

/**
 * Largest gap between a region's reported score and Σ component × effective_weights_region / 10 000, for a
 * region built from `componentCount` components. Derived, not tuned:
 * - the composite is rounded to 2 decimals: ≤ 0.005;
 * - each component is rounded to 2 decimals (≤ 0.005) and the weights sum to 1, so their effect on the
 *   weighted sum is ≤ 0.005 in total;
 * - each of the `componentCount` weights is rounded to an integer bp (≤ 0.5 bp = 0.00005), which moves the sum by
 *   at most 100 × 0.00005 = 0.005 per component.
 * So the bound is 0.01 + 0.005 × componentCount (0.03 for four components). On the captured 2026-10-23
 * production responses (~1 500 ranked regions) the largest observed gap is 0.005.
 */
export function scoreToleranceFor(componentCount: number): number {
  return 0.01 + 0.005 * componentCount;
}

export type CoverageTier = 'complete' | 'partial' | 'insufficient' | 'unreported';

/**
 * Tier of a region by its OWN reported `coverage_pct`: 100 = complete (headline-eligible); between the
 * backend threshold and 100 = partial (weights were redistributed over what exists; show the badge and
 * the omitted criteria); below the threshold = insufficient (the Data Hub must not have ranked it).
 */
export function classifyCoverage(coveragePct: number | null, minCoveragePct: number | null): CoverageTier {
  if (coveragePct === null) return 'unreported';
  if (coveragePct >= 100 - 1e-9) return 'complete';
  if (minCoveragePct !== null && coveragePct < minCoveragePct) return 'insufficient';
  return 'partial';
}

/**
 * Share (0–100) of the user's REQUESTED weight that sits on indicators with national data, from the
 * weights as echoed and the indicators the response declares unavailable. `null` when nothing is weighted.
 */
export function requestedWeightAvailabilityPct(
  requested: Readonly<Record<string, number>>,
  unavailable: readonly string[],
): number | null {
  const entries = Object.entries(requested).filter(([, bps]) => bps > 0);
  const total = entries.reduce((sum, [, bps]) => sum + bps, 0);
  if (total === 0) return null;
  const available = entries.reduce((sum, [id, bps]) => sum + (unavailable.includes(id) ? 0 : bps), 0);
  return (available * 100) / total;
}

export interface CompositeRowInput {
  readonly regionId: string;
  readonly rankPosition: number | null;
  readonly compositeScore: number | null;
  /** Normalised 0–100 score per weighted indicator; `null` = unavailable. */
  readonly componentScores: Readonly<Record<string, number | null>>;
  /** v2.1: position among all nationally eligible regions; `null`/absent = not reported. */
  readonly nationalRank?: number | null;
  /** v2.1: per-region coverage (0–100); `null`/absent = not reported. */
  readonly coveragePct?: number | null;
  readonly componentsUsed?: readonly string[] | null;
  readonly missingIndicators?: readonly string[] | null;
  /** v2.1: weights (10 000 bps) over the components this region has; the score is checked against these. */
  readonly effectiveWeightsRegion?: Readonly<Record<string, number>> | null;
  /** v2.1: quality flag per used component. */
  readonly qualityFlags?: Readonly<Record<string, string>> | null;
}

/** A region the Data Hub declined to rank (v2.1 `insufficient_data`). */
export interface InsufficientRowInput {
  readonly regionId: string;
  readonly coveragePct: number | null;
  readonly componentsUsed: readonly string[];
}

export interface CompositeIntegrityInput {
  /** The weights as the response echoes them (`weights_basis_points`). */
  readonly weightsBasisPoints: Readonly<Record<string, number>>;
  /** What the response says its coverage is (`total_regions`). */
  readonly reportedTotalRegions: number;
  readonly rows: readonly CompositeRowInput[];
  /**
   * The region registry's own size for the same snapshot and filter, when known. Compared with the
   * ranked rows PLUS the insufficient-data rows: together they account for the registry.
   */
  readonly registryRegionCount?: number | null;
  /** The weights the request sent; the echo must match them exactly. */
  readonly requestedWeights?: Readonly<Record<string, number>> | null;
  /** Guide v2 provenance; `null`/absent = not reported (v1), and the echoed weights are used. */
  readonly effectiveWeightsBasisPoints?: Readonly<Record<string, number>> | null;
  readonly unavailableIndicatorIds?: readonly string[] | null;
  readonly renormalized?: boolean | null;
  /** 2-digit province code the request was limited to; every region code must start with it. */
  readonly filterProvinceId?: string | null;
  /** `LIVE` makes a missing `score_direction` blocking; `DEMO` only discloses it. Absent = not judged. */
  readonly dataMode?: 'LIVE' | 'DEMO' | null;
  /** v2.1 `score_direction`; `null`/absent = not reported (v1). Anything but `higher_is_need` blocks. */
  readonly scoreDirection?: string | null;
  readonly totalEligibleNational?: number | null;
  readonly totalExcluded?: number | null;
  /** Backend per-region coverage threshold (percent) and minimum observed components. */
  readonly minCoveragePct?: number | null;
  readonly minComponents?: number | null;
  readonly insufficientRows?: readonly InsufficientRowInput[];
  /** The Data Hub's verdict for the preset these weights equal, if they equal one. `false` blocks. */
  readonly declaredRankable?: boolean | null;
  /**
   * Frontend product policy (see `FRONTEND_MIN_REQUESTED_WEIGHT_PCT`); defaults to it, `null` switches
   * the policy off.
   */
  readonly minRequestedWeightPct?: number | null;
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
  | 'PROVINCE_FILTER_MISMATCH'
  | 'SCORE_DIRECTION_MISMATCH'
  | 'SCORE_DIRECTION_UNREPORTED'
  | 'REGION_WEIGHTS_MISSING'
  | 'REGION_WEIGHTS_NOT_100_PERCENT'
  | 'REGION_WEIGHTS_INCONSISTENT'
  | 'REGION_COMPONENTS_INCONSISTENT'
  | 'COVERAGE_MISMATCH'
  | 'RANKED_BELOW_THRESHOLD'
  | 'NATIONAL_RANK_INCONSISTENT'
  | 'ELIGIBLE_COUNT_INCONSISTENT'
  | 'INSUFFICIENT_REGION_RANKED'
  | 'INSUFFICIENT_NOT_JUSTIFIED'
  | 'REQUESTED_WEIGHT_AVAILABILITY_LOW'
  | 'PRESET_NOT_RANKABLE'
  | 'PARTIAL_COVERAGE'
  | 'IMPUTED_PROVINCE_DATA';

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
  /**
   * NATIONAL availability of the weight the user requested (percent), from the declared unavailable
   * indicators; `null` when the response does not declare them. NOT a per-region coverage.
   */
  readonly requestedWeightAvailabilityPct: number | null;
  /** Ranked regions by their own coverage: complete (100) and partial (reweighted). */
  readonly coverageTiers: { readonly complete: number; readonly partial: number };
}

const MAX_EXAMPLES = 5;
const n = (value: number) => String(value);
const sumOf = (weights: Readonly<Record<string, number>>) =>
  Object.values(weights).reduce((sum, value) => sum + value, 0);

function sameWeights(a: Readonly<Record<string, number>>, b: Readonly<Record<string, number>>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => (a[key] ?? 0) === (b[key] ?? 0));
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...left].every((item) => right.has(item));
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
    return Math.abs((effective[id] ?? 0) - exact) > WEIGHT_ROUNDING_BPS;
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

/** Region findings collected while walking the rows, reported once per code with counterexamples. */
interface RowFindings {
  readonly duplicates: string[];
  readonly outOfRange: string[];
  /** Score present, but a weighted component is empty (legacy path) / used component empty (v2.1). */
  readonly missing: string[];
  zeroFilled: number;
  readonly mismatched: string[];
  readonly weightsMissing: string[];
  readonly weightsNot100: string[];
  readonly weightsInconsistent: string[];
  readonly componentsInconsistent: string[];
  readonly coverageMismatch: string[];
  readonly belowThreshold: string[];
  readonly partial: string[];
  readonly imputed: string[];
  complete: number;
  maxScoreError: number;
}

export function assessCompositeIntegrity(input: CompositeIntegrityInput): CompositeIntegrity {
  const issues: CompositeIssue[] = [];
  const add = (
    severity: CompositeIssueSeverity,
    code: CompositeIssueCode,
    message: string,
    count: number,
    examples?: string[],
  ) => {
    issues.push({ code, severity, message, count, ...(examples ? { examples } : {}) });
  };
  const block = (code: CompositeIssueCode, message: string, count: number, examples?: string[]) => {
    add('block', code, message, count, examples);
  };
  const { weightsBasisPoints: echoed, rows } = input;
  const insufficientRows = input.insufficientRows ?? [];
  const direction = input.scoreDirection ?? null;
  const minCoverage = input.minCoveragePct ?? null;
  const minComponents = input.minComponents ?? null;

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

  // Score orientation: the whole ranking is read as "higher = higher need"; anything else, or a LIVE
  // response that does not say, cannot be read safely.
  if (direction !== null && direction !== EXPECTED_SCORE_DIRECTION) {
    block(
      'SCORE_DIRECTION_MISMATCH',
      `Data Hub menyatakan arah skor "${direction}", bukan "${EXPECTED_SCORE_DIRECTION}" (skor tinggi = kebutuhan intervensi tinggi). Peringkat tidak dapat dibaca dengan aman.`,
      1,
    );
  } else if (direction === null && input.dataMode === 'LIVE') {
    block(
      'SCORE_DIRECTION_UNREPORTED',
      `Respons LIVE tidak menyebut arah skor (score_direction). Tanpa itu, skor tinggi bisa berarti kondisi baik atau kebutuhan tinggi, jadi peringkat ditahan.`,
      1,
    );
  } else if (direction === null && input.dataMode === 'DEMO') {
    add(
      'disclose',
      'SCORE_DIRECTION_UNREPORTED',
      'Respons simulasi ini tidak menyebut arah skor (score_direction); arah dibaca sebagai kebutuhan intervensi.',
      1,
    );
  }

  if (input.declaredRankable === false) {
    block(
      'PRESET_NOT_RANKABLE',
      'Data Hub menandai skenario ini tidak dapat diperingkat (rankable = false) karena sebagian besar kriterianya belum punya data. Hasil peringkat ditahan, meskipun server tetap mengembalikannya.',
      1,
    );
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

  // NATIONAL availability of the requested weight: a Nusa Matra frontend policy, separate from any
  // per-region coverage.
  const availabilityPct =
    input.unavailableIndicatorIds != null
      ? requestedWeightAvailabilityPct(echoed, input.unavailableIndicatorIds)
      : null;
  const policyMinimum =
    input.minRequestedWeightPct === undefined
      ? FRONTEND_MIN_REQUESTED_WEIGHT_PCT
      : input.minRequestedWeightPct;
  if (availabilityPct !== null && policyMinimum !== null && availabilityPct < policyMinimum - 1e-9) {
    block(
      'REQUESTED_WEIGHT_AVAILABILITY_LOW',
      `Kebijakan antarmuka Nusa Matra (bukan aturan Data Hub): peringkat hanya ditampilkan bila minimal ${n(policyMinimum)}% bobot pilihan Anda jatuh pada indikator yang punya data nasional. Di sini hanya ${availabilityPct.toFixed(1)}%; sisanya akan diganti diam-diam oleh kriteria lain.`,
      1,
    );
  }

  if (input.reportedTotalRegions !== rows.length) {
    block(
      'REPORTED_COUNT_MISMATCH',
      `Respons menyebut ${n(input.reportedTotalRegions)} wilayah tetapi hanya memuat ${n(rows.length)}.`,
      Math.abs(input.reportedTotalRegions - rows.length),
    );
  }

  const province = input.filterProvinceId ?? null;
  const eligible = input.totalEligibleNational ?? null;
  if (eligible !== null) {
    const unfilteredMismatch = province === null && eligible !== rows.length;
    if (eligible < rows.length || unfilteredMismatch) {
      block(
        'ELIGIBLE_COUNT_INCONSISTENT',
        eligible < rows.length
          ? `Respons menyebut ${n(eligible)} wilayah layak secara nasional, lebih sedikit dari ${n(rows.length)} wilayah yang diperingkat.`
          : `Tanpa filter provinsi, respons menyebut ${n(eligible)} wilayah layak secara nasional tetapi memuat ${n(rows.length)} baris peringkat.`,
        Math.abs(eligible - rows.length),
      );
    }
  }
  if (
    input.totalExcluded != null &&
    input.insufficientRows !== undefined &&
    input.totalExcluded !== insufficientRows.length
  ) {
    block(
      'ELIGIBLE_COUNT_INCONSISTENT',
      `Respons menyebut ${n(input.totalExcluded)} wilayah dikecualikan, tetapi merinci ${n(insufficientRows.length)}.`,
      Math.abs(input.totalExcluded - insufficientRows.length),
    );
  }

  const registry = input.registryRegionCount ?? null;
  const accountedFor = rows.length + insufficientRows.length;
  if (registry !== null && registry !== accountedFor) {
    issues.push({
      code: 'REGISTRY_COUNT_MISMATCH',
      // Sound for the regions it covers, provided every covered row passes the checks below.
      severity: registry > accountedFor ? 'disclose' : 'block',
      message:
        registry > accountedFor
          ? `${n(registry - accountedFor)} dari ${n(registry)} wilayah tidak tercantum di peringkat maupun di daftar data belum cukup; peringkat hanya berlaku untuk ${n(rows.length)} wilayah yang dihitung.`
          : `Peringkat dan daftar data belum cukup memuat ${n(accountedFor)} wilayah, lebih banyak dari ${n(registry)} wilayah di daftar snapshot ini.`,
      count: Math.abs(registry - accountedFor),
    });
  }

  if (province !== null) {
    const outside = [...rows, ...insufficientRows]
      .filter((row) => !row.regionId.startsWith(province))
      .map((row) => row.regionId);
    if (outside.length > 0) {
      block(
        'PROVINCE_FILTER_MISMATCH',
        `${n(outside.length)} wilayah di luar provinsi ${province} ikut dalam peringkat yang difilter.`,
        outside.length,
        outside.slice(0, MAX_EXAMPLES),
      );
    }
  }

  const found: RowFindings = {
    duplicates: [],
    outOfRange: [],
    missing: [],
    zeroFilled: 0,
    mismatched: [],
    weightsMissing: [],
    weightsNot100: [],
    weightsInconsistent: [],
    componentsInconsistent: [],
    coverageMismatch: [],
    belowThreshold: [],
    partial: [],
    imputed: [],
    complete: 0,
    maxScoreError: 0,
  };
  // `missing_indicators` lists every REQUESTED indicator the region lacks, including those with no national data.
  const requestedIds = Object.keys(echoed).filter((id) => (echoed[id] ?? 0) > 0);
  const globalTotal = sumOf(Object.fromEntries(indicatorIds.map((id) => [id, weightsUsed[id] ?? 0])));
  const inRange = (value: number) => Number.isFinite(value) && value >= SCORE_MIN && value <= SCORE_MAX;

  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.regionId)) found.duplicates.push(row.regionId);
    seen.add(row.regionId);
    if (row.compositeScore === null) continue;

    const regionWeights = row.effectiveWeightsRegion ?? null;
    if (regionWeights === null && direction !== null) {
      // Declared v2.1, but this row cannot be rebuilt from its own weights.
      found.weightsMissing.push(row.regionId);
      continue;
    }

    const allComponents = indicatorIds.map((id) => row.componentScores[id] ?? null);
    if (!inRange(row.compositeScore) || allComponents.some((value) => value !== null && !inRange(value))) {
      found.outOfRange.push(row.regionId);
      continue;
    }

    if (regionWeights === null) {
      checkLegacyRow(row, indicatorIds, weightsUsed, found);
    } else {
      checkRegionRow(
        row,
        regionWeights,
        { indicatorIds, requestedIds, weightsUsed, globalTotal, minCoverage, minComponents },
        found,
      );
    }
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
  const report = (code: CompositeIssueCode, list: readonly string[], message: string) => {
    if (list.length > 0) block(code, message, list.length, list.slice(0, MAX_EXAMPLES));
  };
  report(
    'DUPLICATE_REGION',
    found.duplicates,
    `${n(found.duplicates.length)} wilayah muncul lebih dari sekali.`,
  );
  report(
    'SCORE_OUT_OF_RANGE',
    found.outOfRange,
    `${n(found.outOfRange.length)} wilayah punya skor di luar rentang 0–100 atau bukan angka.`,
  );
  report(
    'REGION_WEIGHTS_MISSING',
    found.weightsMissing,
    `${n(found.weightsMissing.length)} wilayah diberi skor tanpa bobot per wilayah (effective_weights_region), sehingga skornya tidak dapat dihitung ulang.`,
  );
  report(
    'REGION_WEIGHTS_NOT_100_PERCENT',
    found.weightsNot100,
    `${n(found.weightsNot100.length)} wilayah punya bobot per wilayah yang tidak berjumlah tepat ${n(TOTAL_BASIS_POINTS)} basis poin.`,
  );
  report(
    'REGION_WEIGHTS_INCONSISTENT',
    found.weightsInconsistent,
    `${n(found.weightsInconsistent.length)} wilayah punya bobot per wilayah yang tidak sebanding dengan bobot efektif, atau memuat indikator di luar permintaan.`,
  );
  report(
    'REGION_COMPONENTS_INCONSISTENT',
    found.componentsInconsistent,
    `${n(found.componentsInconsistent.length)} wilayah punya daftar komponen (components_used / missing_indicators) yang tidak cocok dengan skor komponennya.`,
  );
  report(
    'COVERAGE_MISMATCH',
    found.coverageMismatch,
    `${n(found.coverageMismatch.length)} wilayah punya cakupan (coverage_pct) yang tidak cocok dengan bobot komponen yang dipakainya.`,
  );
  report(
    'RANKED_BELOW_THRESHOLD',
    found.belowThreshold,
    `${n(found.belowThreshold.length)} wilayah diberi peringkat padahal cakupannya di bawah ambang ${minCoverage === null ? '' : `${n(minCoverage)}% `}atau komponennya kurang dari ${minComponents === null ? 'minimum' : n(minComponents)}; seharusnya masuk daftar data belum cukup.`,
  );
  if (found.missing.length > 0) {
    block(
      'MISSING_COMPONENT',
      `${n(found.missing.length)} wilayah punya skor gabungan tanpa semua skor komponen berbobot.` +
        (found.zeroFilled === found.missing.length
          ? ' Skor itu hanya cocok bila data yang kosong dihitung sebagai 0, padahal data kosong bukan nol.'
          : ' Skor itu tidak bisa dihitung ulang dari komponennya.'),
      found.missing.length,
      found.missing.slice(0, MAX_EXAMPLES),
    );
  }
  if (found.mismatched.length > 0) {
    block(
      'SCORE_MISMATCH',
      `${n(found.mismatched.length)} skor gabungan tidak sama dengan jumlah berbobot skor komponennya (selisih terbesar ${found.maxScoreError.toFixed(2)}).`,
      found.mismatched.length,
      found.mismatched.slice(0, MAX_EXAMPLES),
    );
  }

  // Ranks run 1..n in score order (highest need first). Equal scores may share a rank (1, 1, 3): the next
  // distinct score then takes its position. Server ranks are checked, never replaced.
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

  checkNationalRank(scored, province, eligible, direction !== null, block);
  checkInsufficientRows(insufficientRows, seen, minCoverage, minComponents, block);

  if (found.partial.length > 0) {
    add(
      'disclose',
      'PARTIAL_COVERAGE',
      `${n(found.partial.length)} wilayah dihitung dari sebagian kriteria saja (cakupan 70% hingga di bawah 100%, bobot dialihkan ke kriteria yang datanya ada). Skornya tetap bisa dibandingkan, tetapi bukan dari kriteria yang sama dengan wilayah berdata lengkap.`,
      found.partial.length,
      found.partial.slice(0, MAX_EXAMPLES),
    );
  }
  if (found.imputed.length > 0) {
    add(
      'disclose',
      'IMPUTED_PROVINCE_DATA',
      `${n(found.imputed.length)} wilayah memakai nilai yang diperkirakan dari tingkat provinsi (IMPUTED_PROVINCE) untuk sedikitnya satu kriteria. Itu bukan pengukuran tingkat kabupaten/kota, berapa pun cakupannya.`,
      found.imputed.length,
      found.imputed.slice(0, MAX_EXAMPLES),
    );
  }

  return {
    ok: issues.every((issue) => issue.severity !== 'block'),
    issues,
    maxScoreError: found.maxScoreError,
    weightsUsed,
    requestedWeightAvailabilityPct: availabilityPct,
    coverageTiers: { complete: found.complete, partial: found.partial.length },
  };
}

/** Pre-v2.1 rows: scored against the global weights; an empty weighted component is a defect. */
function checkLegacyRow(
  row: CompositeRowInput,
  indicatorIds: readonly string[],
  weightsUsed: Readonly<Record<string, number>>,
  found: RowFindings,
): void {
  let weightedSum = 0;
  let complete = true;
  for (const id of indicatorIds) {
    const component = row.componentScores[id] ?? null;
    if (component === null) complete = false;
    else weightedSum += (component * (weightsUsed[id] ?? 0)) / TOTAL_BASIS_POINTS;
  }
  const score = row.compositeScore ?? 0;
  if (!complete) {
    // A score built from fewer components than were weighted is not a like-for-like average. If it
    // only reproduces with the empty component counted as 0, the backend treated "no data" as 0.
    found.missing.push(row.regionId);
    if (Math.abs(score - weightedSum) <= SCORE_TOLERANCE) found.zeroFilled += 1;
    return;
  }
  const error = Math.abs(score - weightedSum);
  found.maxScoreError = Math.max(found.maxScoreError, error);
  if (error > SCORE_TOLERANCE) found.mismatched.push(row.regionId);
}

interface RegionCheckContext {
  readonly indicatorIds: readonly string[];
  readonly requestedIds: readonly string[];
  readonly weightsUsed: Readonly<Record<string, number>>;
  readonly globalTotal: number;
  readonly minCoverage: number | null;
  readonly minComponents: number | null;
}

/** v2.1 rows: the score must follow from the region's own components and weights. */
function checkRegionRow(
  row: CompositeRowInput,
  regionWeights: Readonly<Record<string, number>>,
  context: RegionCheckContext,
  found: RowFindings,
): void {
  const { indicatorIds, requestedIds, weightsUsed, globalTotal } = context;
  const usedIds = Object.keys(regionWeights).filter((id) => (regionWeights[id] ?? 0) > 0);

  if (sumOf(regionWeights) !== TOTAL_BASIS_POINTS) {
    found.weightsNot100.push(row.regionId);
    return;
  }

  // The region's weights must be the global effective weights of the indicators it has, rescaled.
  const usedGlobal = usedIds.reduce((sum, id) => sum + (weightsUsed[id] ?? 0), 0);
  const unknownIndicator = usedIds.some((id) => !indicatorIds.includes(id));
  const proportional =
    !unknownIndicator &&
    usedGlobal > 0 &&
    usedIds.every(
      (id) =>
        Math.abs((regionWeights[id] ?? 0) - ((weightsUsed[id] ?? 0) * TOTAL_BASIS_POINTS) / usedGlobal) <=
        WEIGHT_ROUNDING_BPS,
    );
  if (!proportional) {
    found.weightsInconsistent.push(row.regionId);
    return;
  }

  // A null component is "no data", never 0. Weight on a null component means the score was built from nothing.
  const emptyButWeighted = usedIds.filter((id) => (row.componentScores[id] ?? null) === null);
  if (emptyButWeighted.length > 0) {
    found.missing.push(row.regionId);
    return;
  }
  const observed = indicatorIds.filter((id) => (row.componentScores[id] ?? null) !== null);
  const absent = requestedIds.filter((id) => !usedIds.includes(id));
  if (
    !sameSet(observed, usedIds) ||
    row.componentsUsed == null ||
    row.missingIndicators == null ||
    !sameSet(row.componentsUsed, usedIds) ||
    !sameSet(row.missingIndicators, absent)
  ) {
    found.componentsInconsistent.push(row.regionId);
    return;
  }

  // Per-region coverage = the share of the global effective weight this region has data for.
  const expectedCoverage = globalTotal > 0 ? (usedGlobal * 100) / globalTotal : 0;
  if (row.coveragePct == null || Math.abs(row.coveragePct - expectedCoverage) > COVERAGE_PCT_TOLERANCE) {
    found.coverageMismatch.push(row.regionId);
  } else if (
    (context.minCoverage !== null && row.coveragePct < context.minCoverage) ||
    (context.minComponents !== null && usedIds.length < context.minComponents)
  ) {
    found.belowThreshold.push(row.regionId);
  }

  const weightedSum = usedIds.reduce(
    (sum, id) => sum + ((row.componentScores[id] ?? 0) * (regionWeights[id] ?? 0)) / TOTAL_BASIS_POINTS,
    0,
  );
  const error = Math.abs((row.compositeScore ?? 0) - weightedSum);
  found.maxScoreError = Math.max(found.maxScoreError, error);
  if (error > scoreToleranceFor(usedIds.length)) found.mismatched.push(row.regionId);

  if (classifyCoverage(row.coveragePct ?? null, context.minCoverage) === 'complete') found.complete += 1;
  else if (row.coveragePct != null) found.partial.push(row.regionId);
  if (Object.values(row.qualityFlags ?? {}).includes('IMPUTED_PROVINCE')) found.imputed.push(row.regionId);
}

type Blocker = (code: CompositeIssueCode, message: string, count: number, examples?: string[]) => void;

/** `national_rank` is the position among all eligible regions: never above `rank`, never out of order. */
function checkNationalRank(
  scored: readonly CompositeRowInput[],
  province: string | null,
  eligible: number | null,
  declaredV21: boolean,
  block: Blocker,
): void {
  const reported = scored.filter((row) => row.nationalRank != null);
  if (reported.length === 0 && !declaredV21) return;
  const bad: string[] = [];
  let previous = 0;
  for (const row of scored) {
    const national = row.nationalRank ?? null;
    const rank = row.rankPosition ?? 0;
    const inconsistent =
      national === null ||
      national < rank ||
      national < previous ||
      (eligible !== null && national > eligible) ||
      (province === null && national !== rank);
    if (inconsistent) bad.push(row.regionId);
    if (national !== null) previous = Math.max(previous, national);
  }
  if (bad.length > 0) {
    block(
      'NATIONAL_RANK_INCONSISTENT',
      `${n(bad.length)} wilayah punya peringkat nasional (national_rank) yang hilang atau tidak konsisten: tidak boleh di atas peringkat dalam daftar, tidak boleh menurun sepanjang daftar, dan tanpa filter provinsi harus sama dengan peringkat.`,
      bad.length,
      bad.slice(0, MAX_EXAMPLES),
    );
  }
}

/** A region the Data Hub did not rank must really fall short of its own thresholds, and must not also be ranked. */
function checkInsufficientRows(
  insufficientRows: readonly InsufficientRowInput[],
  rankedIds: ReadonlySet<string>,
  minCoverage: number | null,
  minComponents: number | null,
  block: Blocker,
): void {
  const both = insufficientRows.filter((row) => rankedIds.has(row.regionId)).map((row) => row.regionId);
  if (both.length > 0) {
    block(
      'INSUFFICIENT_REGION_RANKED',
      `${n(both.length)} wilayah muncul di peringkat sekaligus di daftar data belum cukup.`,
      both.length,
      both.slice(0, MAX_EXAMPLES),
    );
  }
  if (minCoverage === null && minComponents === null) return;
  const unjustified = insufficientRows
    .filter((row) => {
      const lowCoverage = minCoverage !== null && row.coveragePct !== null && row.coveragePct < minCoverage;
      const fewComponents = minComponents !== null && row.componentsUsed.length < minComponents;
      return !lowCoverage && !fewComponents;
    })
    .map((row) => row.regionId);
  if (unjustified.length > 0) {
    block(
      'INSUFFICIENT_NOT_JUSTIFIED',
      `${n(unjustified.length)} wilayah dikecualikan dari peringkat padahal cakupan dan jumlah komponennya memenuhi ambang Data Hub sendiri.`,
      unjustified.length,
      unjustified.slice(0, MAX_EXAMPLES),
    );
  }
}
