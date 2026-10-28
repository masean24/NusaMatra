import {
  DATA_HUB_PERCENTILE_ORIENTATION,
  describeUnit,
  readIndicator,
  type DisplayUnit,
  type IndicatorReading,
  type PercentileOrientation,
} from '@/domain/indicators';
import { describeObservation } from '@/features/data-hub';
import type {
  DataHubIndicatorDTO,
  IndicatorCatalogDTO,
  RegionProfileDTO,
  RegionProfileIndicatorValueDTO,
} from '@/services/api';

/**
 * Indicators shown first, in this order, because ordinary readers recognise them: human
 * development, poverty, child stunting, disaster risk, schooling and electricity. Only those the
 * region actually has a value for are used; the rest of the summary is filled from the other
 * indicators in the Data Hub's order. Nothing is invented for a missing one.
 */
const SUMMARY_PRIORITY = [
  'soc_hdi',
  'soc_poverty_rate',
  'hlt_stunting_prevalence',
  'dis_multihazard_index',
  'edu_expected_years_schooling',
  'inf_electrification_pct',
] as const;

export const SUMMARY_SIZE = 4;

export interface InsightIndicator {
  readonly id: string;
  readonly label: string;
  readonly category: string;
  readonly hasValue: boolean;
  /** The source's own number as text ("9,89"), never a score. */
  readonly valueText: string;
  readonly unit: DisplayUnit;
  readonly referenceYear: number | null;
  readonly agencyCode: string;
  readonly sourceUrl: string | null;
  readonly datasetTitle: string | null;
  readonly reading: IndicatorReading;
  /** 0–100 score the Data Hub derived from the value (higher = more need); not the value itself. */
  readonly normalizedScore: string | null;
  readonly percentile: string | null;
  readonly nationalRank: number | null;
  readonly definition: string | null;
  readonly derivationFormula: string | null;
  readonly qualityFlag: string | null;
  readonly isDemoExample: boolean;
}

export interface EvidenceSource {
  readonly datasetId: string;
  readonly agencyCode: string;
  readonly datasetTitle: string | null;
  readonly portalUrl: string | null;
  readonly years: readonly number[];
  readonly indicatorCount: number;
}

export interface RegionInsight {
  readonly summary: readonly InsightIndicator[];
  readonly groups: readonly (readonly [string, readonly InsightIndicator[]])[];
  readonly evidence: readonly EvidenceSource[];
  readonly indicatorCount: number;
}

const toNumber = (decimal: string | null): number | null => {
  if (decimal === null) return null;
  const parsed = Number(decimal);
  return Number.isFinite(parsed) ? parsed : null;
};

function toInsightIndicator(
  item: RegionProfileIndicatorValueDTO,
  definition: DataHubIndicatorDTO | undefined,
  orientation: PercentileOrientation,
): InsightIndicator {
  const hasValue = item.value.status === 'AVAILABLE';
  const value = item.value.status === 'AVAILABLE' ? Number(item.value.decimal) : null;
  const catalogMax = toNumber(definition?.stats?.max ?? null);
  const observedMax = Math.max(
    ...[value, catalogMax].filter((entry): entry is number => entry !== null),
    -Infinity,
  );

  return {
    id: item.indicatorId,
    label: item.indicatorName,
    category: item.category,
    hasValue,
    valueText: describeObservation(item.value),
    unit: describeUnit(item.unit, Number.isFinite(observedMax) ? observedMax : null),
    referenceYear: item.referenceYear,
    agencyCode: item.provenance.agencyCode,
    sourceUrl: item.provenance.officialUrl,
    datasetTitle: definition?.provenance.datasetTitle ?? null,
    reading: readIndicator({
      polarity: definition?.polarity ?? 'unknown',
      percentile: toNumber(item.nationalPercentileDecimal),
      percentileOrientation: orientation,
      qualityFlag: item.qualityFlag,
      hasValue,
    }),
    normalizedScore: item.normalizedScoreDecimal,
    percentile: item.nationalPercentileDecimal,
    nationalRank: item.nationalRank,
    definition: definition?.description ?? null,
    derivationFormula: definition?.derivationFormula ?? null,
    qualityFlag: item.qualityFlag,
    isDemoExample: item.isDemoExample,
  };
}

/** Everything the panel shows, derived from the profile and the catalog without altering any value. */
export function buildRegionInsight(
  profile: RegionProfileDTO,
  catalog: IndicatorCatalogDTO | null,
  /** The profile response's `meta.score_direction` (contract v2.4); `null` when not stated. */
  scoreDirection: string | null = null,
): RegionInsight {
  // v2.4 states what the percentile means: with `higher_is_need` it is a need percentile, so a
  // verdict may be drawn. Without that statement no verdict is drawn (UNVERIFIED).
  const orientation: PercentileOrientation =
    scoreDirection === 'higher_is_need' ? 'NEED_SHARE' : DATA_HUB_PERCENTILE_ORIENTATION;
  const definitions = new Map((catalog?.items ?? []).map((item) => [item.indicatorId, item]));
  const indicators = profile.indicators.map((item) =>
    toInsightIndicator(item, definitions.get(item.indicatorId), orientation),
  );

  const withValue = indicators.filter((indicator) => indicator.hasValue);
  const preferred = SUMMARY_PRIORITY.flatMap((id) => withValue.filter((indicator) => indicator.id === id));
  const rest = withValue.filter((indicator) => !preferred.includes(indicator));
  const summary = [...preferred, ...rest].slice(0, SUMMARY_SIZE);

  const groups = new Map<string, InsightIndicator[]>();
  for (const indicator of indicators) {
    const group = groups.get(indicator.category) ?? [];
    group.push(indicator);
    groups.set(indicator.category, group);
  }

  const sources = new Map<
    string,
    { source: Omit<EvidenceSource, 'years' | 'indicatorCount'>; years: Set<number>; count: number }
  >();
  for (const item of profile.indicators) {
    const definition = definitions.get(item.indicatorId);
    const key = item.provenance.datasetId;
    const entry = sources.get(key) ?? {
      source: {
        datasetId: key,
        agencyCode: item.provenance.agencyCode,
        datasetTitle: definition?.provenance.datasetTitle ?? null,
        portalUrl: definition?.provenance.officialPortalUrl ?? item.provenance.officialUrl,
      },
      years: new Set<number>(),
      count: 0,
    };
    if (item.referenceYear !== null) entry.years.add(item.referenceYear);
    entry.count += 1;
    sources.set(key, entry);
  }

  return {
    summary,
    groups: [...groups.entries()],
    evidence: [...sources.values()].map(({ source, years, count }) => ({
      ...source,
      years: [...years].sort((a, b) => a - b),
      indicatorCount: count,
    })),
    indicatorCount: indicators.length,
  };
}
