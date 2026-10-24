/**
 * Lab Prioritas inputs from the Data Hub (Production Integration Guide v2), validated at the
 * boundary: which indicators hold data in a mode (`GET /api/v1/indicators/coverage`) and the
 * scenario presets (`GET /api/v1/indicators/composite-presets`). Malformed parts are rejected,
 * never repaired; a preset whose weights do not add up to exactly 10 000 is dropped and counted.
 */
import { ApiError } from './apiError';
import type { AdaptedResponseMeta } from './wireTypes';

export interface IndicatorCoverageEntryDTO {
  readonly indicatorId: string;
  readonly name: string | null;
  readonly category: string | null;
  /** The Data Hub holds at least one value for this indicator in this mode. */
  readonly available: boolean;
  /** Regions with a value. */
  readonly coverageCount: number;
  readonly coveragePct: number | null;
}

/**
 * v2.2 INDICATOR counts. `completenessPct` = indicators with data / framework size (29/33 = 87.9);
 * `availableDataPct` = indicators marked available that really hold data (29/29 = 100). Neither is a
 * region count: region coverage is `IndicatorCoverageDTO.regionCoveragePct`.
 */
export interface IndicatorCountsDTO {
  readonly totalIndicators: number;
  readonly availableIndicators: number;
  readonly unavailableIndicators: number;
  readonly completenessPct: number | null;
  readonly availableDataPct: number | null;
}

export interface IndicatorCoverageDTO {
  readonly snapshotId: string;
  readonly totalIndicators: number;
  /** Regions in the snapshot's registry, when the Data Hub states it. */
  readonly totalRegions: number | null;
  readonly byIndicator: Readonly<Record<string, IndicatorCoverageEntryDTO>>;
  /** v2.2 indicator counts as the Data Hub states them; `null` = not reported (v2.1). */
  readonly indicatorCounts: IndicatorCountsDTO | null;
  /** v2.2 share (0-100) of REGIONS with at least one observation; `null` = not reported. */
  readonly regionCoveragePct: number | null;
}

/**
 * NATIONAL availability of a preset's indicators in the mode (`availability`). This says how much of
 * the PRESET'S WEIGHT sits on indicators that hold data at all. It is a different thing from the
 * per-region `coverage_pct` of a composite row, which says how much of the (already renormalized)
 * weight one region has values for. The two must never be mixed up in code or in wording.
 */
export interface PresetAvailabilityDTO {
  readonly availableIndicators: readonly string[];
  /** Weighted indicators with no data in this mode; their weight is renormalized over the others. */
  readonly unavailableIndicators: readonly string[];
  /** Share (0-100) of regions with a value, per indicator, as the Data Hub reports it. */
  readonly indicatorCoveragePct: Readonly<Record<string, number>>;
  /** The preset weights renormalized over the available indicators: integer bps summing to 10 000. */
  readonly effectiveWeightsBasisPoints: Readonly<Record<string, number>>;
  /** Share (0-100) of the preset's weight that sits on indicators with national data (`coverage_weight_pct`). */
  readonly requestedWeightAvailabilityPct: number;
  /** The Data Hub's own verdict on whether the preset can be ranked in this mode. */
  readonly rankable: boolean;
}

export interface CompositePresetDTO {
  readonly presetId: string;
  readonly label: string;
  readonly description: string | null;
  readonly category: string | null;
  readonly targetFocus: string | null;
  /** Integer basis points summing to exactly 10 000. */
  readonly weightsBasisPoints: Readonly<Record<string, number>>;
  /** `null` = the Data Hub did not report availability for this preset (it is then unverified, not "rankable"). */
  readonly availability: PresetAvailabilityDTO | null;
}

export interface CompositePresetsDTO {
  readonly presets: readonly CompositePresetDTO[];
  /** Presets left out because they did not match the contract (shown to the user as a count). */
  readonly rejectedCount: number;
}

const TOTAL_BASIS_POINTS = 10_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
const finite = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;
const count = (value: unknown): number | null => {
  const number = finite(value);
  return number !== null && Number.isInteger(number) && number >= 0 ? number : null;
};

function malformed(meta: AdaptedResponseMeta, message: string): ApiError {
  return new ApiError(500, 'MALFORMED_ENVELOPE', meta.serverRequestId, 'network.unavailable', {
    serverMessage: message,
  });
}

export function mapIndicatorCoverageData(rawData: unknown, meta: AdaptedResponseMeta): IndicatorCoverageDTO {
  if (!isRecord(rawData) || !isRecord(rawData.indicators)) {
    throw malformed(meta, 'Coverage payload must contain an "indicators" object');
  }
  const byIndicator: Record<string, IndicatorCoverageEntryDTO> = {};
  for (const [indicatorId, entry] of Object.entries(rawData.indicators)) {
    if (!isRecord(entry) || typeof entry.available !== 'boolean') {
      throw malformed(meta, `Coverage entry for ${indicatorId} has no boolean "available"`);
    }
    const coverageCount = count(entry.coverage_count);
    if (coverageCount === null)
      throw malformed(meta, `Coverage entry for ${indicatorId} has no coverage_count`);
    // "available" must agree with the count; a contradiction is a contract error, not a guess.
    if (entry.available !== coverageCount > 0) {
      throw malformed(
        meta,
        `Coverage entry for ${indicatorId} is available=${String(entry.available)} with ${String(coverageCount)} regions`,
      );
    }
    byIndicator[indicatorId] = {
      indicatorId,
      name: text(entry.name),
      category: text(entry.category),
      available: entry.available,
      coverageCount,
      coveragePct: finite(entry.coverage_pct),
    };
  }
  const coverageMeta = isRecord(rawData.coverage) ? rawData.coverage : null;
  const totalIndicators = count(rawData.total_indicators) ?? Object.keys(byIndicator).length;
  return {
    snapshotId: text(rawData.snapshot_id) ?? meta.snapshotId,
    totalIndicators,
    totalRegions: count(rawData.total_regions) ?? count(coverageMeta?.total_regions) ?? null,
    byIndicator,
    indicatorCounts: indicatorCountsOf(rawData, byIndicator, totalIndicators, meta),
    regionCoveragePct: percent(rawData.region_coverage_pct),
  };
}

const percent = (value: unknown): number | null => {
  const number = finite(value);
  return number !== null && number >= 0 && number <= 100 ? number : null;
};

/** v2.2 counts, checked against the per-indicator entries: a count the entries contradict is refused. */
function indicatorCountsOf(
  rawData: Record<string, unknown>,
  byIndicator: Readonly<Record<string, IndicatorCoverageEntryDTO>>,
  totalIndicators: number,
  meta: AdaptedResponseMeta,
): IndicatorCountsDTO | null {
  const available = count(rawData.available_indicators_count);
  if (available === null) return null;
  const counted = Object.values(byIndicator).filter((entry) => entry.available).length;
  const unavailable = count(rawData.empty_indicators_count) ?? totalIndicators - available;
  if (available !== counted || available + unavailable !== totalIndicators) {
    throw malformed(
      meta,
      `Coverage counts (${String(available)} available, ${String(unavailable)} empty of ${String(totalIndicators)}) contradict the ${String(counted)} available entries`,
    );
  }
  return {
    totalIndicators,
    availableIndicators: available,
    unavailableIndicators: unavailable,
    completenessPct: percent(rawData.indicator_completeness_pct),
    availableDataPct: percent(rawData.available_indicator_data_pct),
  };
}

function toPreset(raw: unknown): CompositePresetDTO | null {
  if (!isRecord(raw)) return null;
  const presetId = text(raw.preset_id) ?? text(raw.id);
  const label = text(raw.name) ?? text(raw.label) ?? text(raw.title);
  const rawWeights = isRecord(raw.weights)
    ? raw.weights
    : isRecord(raw.weights_basis_points)
      ? raw.weights_basis_points
      : null;
  if (!presetId || !label || !rawWeights) return null;
  const weights: Record<string, number> = {};
  for (const [indicatorId, value] of Object.entries(rawWeights)) {
    const bps = count(value);
    if (bps === null || bps > TOTAL_BASIS_POINTS) return null;
    if (bps > 0) weights[indicatorId] = bps;
  }
  const total = Object.values(weights).reduce((sum, bps) => sum + bps, 0);
  if (total !== TOTAL_BASIS_POINTS) return null;

  // `availability` absent = not reported (kept as null, never read as rankable). Present but wrong =
  // the whole preset is rejected: a verdict on rankability that contradicts itself cannot be trusted.
  let availability: PresetAvailabilityDTO | null = null;
  if (raw.availability !== undefined && raw.availability !== null) {
    availability = toAvailability(raw.availability, weights);
    if (!availability) return null;
  }
  return {
    presetId,
    label,
    description: text(raw.description),
    category: text(raw.category),
    targetFocus: text(raw.target_focus),
    weightsBasisPoints: weights,
    availability,
  };
}

const stringList = (value: unknown): string[] | null =>
  Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : null;

/** Tolerance for the percentage the Data Hub reports (one decimal) against the one derived from the weights. */
const WEIGHT_PCT_TOLERANCE = 0.1;

/**
 * Reads `availability` and checks it against the preset's own weights: the available and unavailable
 * indicators must be exactly the weighted ones, `coverage_weight_pct` must equal the weight share of
 * the available ones, and `effective_weights` must be those weights scaled to exactly 10 000 (within
 * 1 bp of integer rounding). Anything else returns null.
 */
function toAvailability(
  raw: unknown,
  weights: Readonly<Record<string, number>>,
): PresetAvailabilityDTO | null {
  if (!isRecord(raw) || typeof raw.rankable !== 'boolean') return null;
  const available = stringList(raw.available_indicators);
  const unavailable = stringList(raw.unavailable_indicators);
  const weightPct = finite(raw.coverage_weight_pct);
  if (!available || !unavailable || weightPct === null || weightPct < 0 || weightPct > 100) return null;
  if (!isRecord(raw.effective_weights) || !isRecord(raw.indicator_coverage_pct)) return null;

  const weighted = Object.keys(weights);
  const listed = [...available, ...unavailable];
  if (
    new Set(listed).size !== listed.length ||
    listed.length !== weighted.length ||
    !weighted.every((id) => listed.includes(id))
  ) {
    return null;
  }

  const availableBps = available.reduce((sum, id) => sum + (weights[id] ?? 0), 0);
  if (Math.abs((availableBps * 100) / TOTAL_BASIS_POINTS - weightPct) > WEIGHT_PCT_TOLERANCE) return null;

  const effective: Record<string, number> = {};
  for (const [id, value] of Object.entries(raw.effective_weights)) {
    const bps = count(value);
    if (bps === null || bps > TOTAL_BASIS_POINTS) return null;
    effective[id] = bps;
  }
  if (available.length === 0) {
    if (Object.keys(effective).length > 0 || raw.rankable) return null;
  } else {
    const effectiveTotal = Object.values(effective).reduce((sum, bps) => sum + bps, 0);
    if (effectiveTotal !== TOTAL_BASIS_POINTS) return null;
    const sameIds =
      Object.keys(effective).length === available.length && available.every((id) => id in effective);
    const proportional = available.every(
      (id) => Math.abs((effective[id] ?? 0) - ((weights[id] ?? 0) * TOTAL_BASIS_POINTS) / availableBps) <= 1,
    );
    if (!sameIds || !proportional) return null;
  }

  const indicatorCoveragePct: Record<string, number> = {};
  for (const [id, value] of Object.entries(raw.indicator_coverage_pct)) {
    const pct = finite(value);
    if (pct === null || pct < 0 || pct > 100) return null;
    indicatorCoveragePct[id] = pct;
  }
  return {
    availableIndicators: available,
    unavailableIndicators: unavailable,
    indicatorCoveragePct,
    effectiveWeightsBasisPoints: effective,
    requestedWeightAvailabilityPct: weightPct,
    rankable: raw.rankable,
  };
}

/**
 * The guide names this endpoint but does not show its payload, so the accepted shape is stated here:
 * a list (as `data` or `data.presets`) of `{ id | preset_id, name | label | title, description?,
 * weights | weights_basis_points, availability? }`. Anything else is rejected and counted. Production
 * (captured 2026-10-23) sends `data` as a direct array with `preset_id`, `title`, `category`,
 * `target_focus`, `weights` and `availability`.
 */
export function mapCompositePresetsData(rawData: unknown, meta: AdaptedResponseMeta): CompositePresetsDTO {
  const list = Array.isArray(rawData)
    ? rawData
    : isRecord(rawData) && Array.isArray(rawData.presets)
      ? rawData.presets
      : null;
  if (!list) throw malformed(meta, 'Presets payload must be a list');
  const presets: CompositePresetDTO[] = [];
  for (const raw of list) {
    const preset = toPreset(raw);
    if (preset) presets.push(preset);
  }
  return { presets, rejectedCount: list.length - presets.length };
}
