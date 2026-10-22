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

export interface IndicatorCoverageDTO {
  readonly snapshotId: string;
  readonly totalIndicators: number;
  /** Regions in the snapshot's registry, when the Data Hub states it. */
  readonly totalRegions: number | null;
  readonly byIndicator: Readonly<Record<string, IndicatorCoverageEntryDTO>>;
}

export interface CompositePresetDTO {
  readonly presetId: string;
  readonly label: string;
  readonly description: string | null;
  /** Integer basis points summing to exactly 10 000. */
  readonly weightsBasisPoints: Readonly<Record<string, number>>;
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
  return {
    snapshotId: text(rawData.snapshot_id) ?? meta.snapshotId,
    totalIndicators: count(rawData.total_indicators) ?? Object.keys(byIndicator).length,
    totalRegions: count(rawData.total_regions) ?? count(coverageMeta?.total_regions) ?? null,
    byIndicator,
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
  return { presetId, label, description: text(raw.description), weightsBasisPoints: weights };
}

/**
 * The guide names this endpoint but does not show its payload, so the accepted shape is stated here:
 * a list (as `data` or `data.presets`) of `{ id | preset_id, name | label | title, description?,
 * weights | weights_basis_points }`. Anything else is rejected and counted.
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
