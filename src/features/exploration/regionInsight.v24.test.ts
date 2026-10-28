// Contract v2.4 region detail (archive 74dd6b53…): `meta.score_direction: higher_is_need` states
// that `national_percentile` is a need percentile, so the panel may judge a value instead of
// showing "Tidak dinilai".

import regionDetail from '@/services/api/__fixtures__/contract-v2.4/meta_region_detail.json';
import { mapEnvelope, mapRegionDetailData } from '@/services/api/domainMappers';
import type { IndicatorCatalogDTO } from '@/services/api';
import { buildRegionInsight } from './regionInsight';

const envelope = mapEnvelope(
  regionDetail.body,
  'LIVE',
  {
    status: 200,
    requestId: null,
    dataFallback: null,
    serverMode: null,
    clientReceivedAt: '2026-10-28T00:00:00Z',
  },
  (data, meta) => mapRegionDetailData(data, meta),
);

/** The catalog's polarity for each indicator, taken from the sample's own items. */
const catalog = {
  items: (regionDetail.body.data.indicators as { indicator_id: string; polarity: string }[]).map((item) => ({
    indicatorId: item.indicator_id,
    polarity: item.polarity,
    description: '',
    derivationFormula: null,
    provenance: { datasetTitle: null },
  })),
} as unknown as IndicatorCatalogDTO;

const readingOf = (scoreDirection: string | null, id: string) =>
  buildRegionInsight(envelope.data, catalog, scoreDirection)
    .groups.flatMap(([, items]) => items)
    .find((item) => item.id === id)?.reading;

describe('region insight under contract v2.4', () => {
  it('judges from the need percentile when score_direction is higher_is_need', () => {
    // HDI 69,1 has more need than 72,71 % of regions: worse than most.
    expect(readingOf(envelope.meta.scoreDirection, 'soc_hdi')?.verdict).toBe('UNFAVORABLE');
    // Poverty 9,89 % at need percentile 55,95: around the middle.
    expect(readingOf(envelope.meta.scoreDirection, 'soc_poverty_rate')?.verdict).toBe('NEUTRAL');
  });

  it('still draws no verdict when the response does not state the direction', () => {
    expect(readingOf(null, 'soc_hdi')?.label).toBe('Tidak dinilai');
  });
});
