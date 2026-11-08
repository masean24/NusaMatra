import { useSearchParams } from 'react-router';
import { categoryLabel, useDataHub, useDataHubResource, type ResourceState } from '@/features/data-hub';
import { passportHref } from '@/features/evidence-passport/links';
import type { DataMode } from '@/services/api';
import {
  EXAMPLE_CRITERIA,
  buildCompositeExample,
  type CompositeExample,
  type ExampleCriterion,
} from './compositeExample';
import { useExampleRegion } from './exampleRegion';
import { buildIndicatorExample, type IndicatorExample } from './indicatorExample';

/** The example indicator when the link names none (poverty, P0). */
export const DEFAULT_INDICATOR = 'soc_poverty_rate';

/** A part of the page that waits on the Data Hub. */
export type Loadable<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly retry: () => void }
  | { readonly status: 'ready'; readonly value: T };

export interface IndicatorOption {
  readonly value: string;
  readonly label: string;
  readonly group: string;
}

export interface ScoreMethodData {
  readonly dataMode: DataMode;
  readonly regionId: string;
  /** The region's name, or its code until the name has arrived. */
  readonly regionName: string;
  /** Paspor Bukti of the example region, from the profile's own mode and snapshot. */
  readonly passportTo: string | null;
  readonly indicators: Loadable<{
    readonly options: readonly IndicatorOption[];
    readonly chosen: string;
  }>;
  readonly chooseIndicator: (indicatorId: string) => void;
  readonly example: Loadable<IndicatorExample>;
  readonly composite: Loadable<CompositeExample>;
}

function settle<T, R>(state: ResourceState<T>, retry: () => void, map: (data: T) => R): Loadable<R> {
  if (state.status === 'success') return { status: 'ready', value: map(state.data) };
  if (state.status === 'error' || state.status === 'unconfigured') return { status: 'error', retry };
  return { status: 'loading' };
}

/** One criterion's values; the same key as the worked example's, so the request is shared. */
function useCriterionValues(indicatorId: ExampleCriterion) {
  return useDataHubResource(`method|values|${indicatorId}`, (repository, dataMode, signal) =>
    repository.getIndicatorValues({ dataMode, indicatorId, signal }),
  );
}

/**
 * Everything "Cara skor dihitung" shows from the Data Hub: the example region (`?wilayah=`), the
 * example indicator (`?indikator=`, changeable on the page), its worked example and the composite of
 * the four example criteria. The page only explains; every score here is the Data Hub's.
 */
export function useScoreMethod(): ScoreMethodData {
  const { dataMode } = useDataHub();
  const [params, setParams] = useSearchParams();
  const regionId = useExampleRegion();

  const region = useDataHubResource(`method|region|${regionId}`, (repository, mode, signal) =>
    repository.getRegionDetail({ dataMode: mode, regionId, signal }),
  );
  const catalog = useDataHubResource('catalog', (repository, mode, signal) =>
    repository.getIndicatorCatalog({ dataMode: mode, signal }),
  );

  const items = catalog.state.status === 'success' ? catalog.state.data.data.items : [];
  const wanted = params.get('indikator');
  const indicatorId =
    (
      items.find((item) => item.indicatorId === wanted) ??
      items.find((item) => item.indicatorId === DEFAULT_INDICATOR) ??
      items[0]
    )?.indicatorId ?? null;

  const values = useDataHubResource(
    `method|values|${indicatorId ?? ''}`,
    (repository, mode, signal) =>
      repository.getIndicatorValues({ dataMode: mode, indicatorId: indicatorId ?? '', signal }),
    indicatorId !== null,
  );

  // A fixed set of four criteria, so the hooks are called in the same order every render.
  const criteria = {
    soc_hdi: useCriterionValues('soc_hdi'),
    dis_multihazard_index: useCriterionValues('dis_multihazard_index'),
    soc_poverty_rate: useCriterionValues('soc_poverty_rate'),
    hlt_stunting_prevalence: useCriterionValues('hlt_stunting_prevalence'),
  } satisfies Record<ExampleCriterion, unknown>;

  const regionEnvelope = region.state.status === 'success' ? region.state.data : null;
  const regionName = regionEnvelope?.data.region.displayName ?? `kode ${regionId}`;

  return {
    dataMode,
    regionId,
    regionName,
    passportTo: regionEnvelope
      ? passportHref({
          kind: 'wilayah',
          regionId: regionEnvelope.data.region.regionId,
          mode: regionEnvelope.meta.dataMode,
          snapshotId: regionEnvelope.meta.snapshotId,
        })
      : null,
    indicators: settle(catalog.state, catalog.retry, (envelope) => ({
      options: envelope.data.categories.flatMap((category) =>
        (envelope.data.byCategory[category] ?? []).map((item) => ({
          value: item.indicatorId,
          label: item.labelId,
          group: categoryLabel(category),
        })),
      ),
      chosen: indicatorId ?? '',
    })),
    chooseIndicator: (next) => {
      const query = new URLSearchParams(params);
      query.set('indikator', next);
      setParams(query, { replace: true, preventScrollReset: true });
    },
    example:
      catalog.state.status === 'error'
        ? { status: 'error', retry: catalog.retry }
        : settle(values.state, values.retry, (envelope) =>
            buildIndicatorExample(envelope.data, regionId, regionName),
          ),
    composite: compositeOf(criteria, regionId),
  };
}

function compositeOf(
  criteria: Readonly<Record<ExampleCriterion, ReturnType<typeof useCriterionValues>>>,
  regionId: string,
): Loadable<CompositeExample> {
  const failed = EXAMPLE_CRITERIA.find((id) => criteria[id].state.status === 'error');
  if (failed) return { status: 'error', retry: criteria[failed].retry };
  const scores: Partial<Record<ExampleCriterion, number | null>> = {};
  for (const id of EXAMPLE_CRITERIA) {
    const { state } = criteria[id];
    if (state.status !== 'success') return { status: 'loading' };
    const decimal = state.data.data.valuesByRegion[regionId]?.normalizedScoreDecimal ?? null;
    scores[id] = decimal === null ? null : Number(decimal);
  }
  return { status: 'ready', value: buildCompositeExample(scores) };
}
