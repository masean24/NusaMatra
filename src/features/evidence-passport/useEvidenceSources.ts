import type { DataMode } from '@/services/api';
import type { RawCompositeSources } from './compositeTypes';
import type { RawEvidenceSources } from './evidenceTypes';
import { supporting, useSourceLoader, type SourcesState } from './useSourceLoader';

export type EvidenceSourcesState = SourcesState<RawEvidenceSources>;

/**
 * Loads what a region or comparison passport needs: the profile of each region (required) and the
 * catalog, datasets and snapshot list (supporting). A failed supporting request becomes `null`, which
 * the record reports as a gap; a failed profile fails the whole passport instead of showing part of it.
 * The mode is passed explicitly to every request.
 */
export function useEvidenceSources(
  regionIds: readonly string[],
  mode: DataMode,
  enabled: boolean,
): { readonly state: EvidenceSourcesState; readonly retry: () => void } {
  return useSourceLoader(
    `${mode}|region|${regionIds.join(',')}`,
    async (repository, signal): Promise<RawEvidenceSources> => {
      const [profiles, catalog, datasets, snapshots, coverage] = await Promise.all([
        Promise.all(
          regionIds.map((regionId) => repository.getRegionDetail({ dataMode: mode, regionId, signal })),
        ),
        supporting(repository.getIndicatorCatalog({ dataMode: mode, signal })),
        supporting(repository.getDatasets(mode, signal)),
        supporting(repository.getSnapshots(mode, signal)),
        // The coverage matrix exists only for LIVE; DEMO has no such response.
        mode === 'LIVE'
          ? supporting(repository.getIndicatorCoverage({ dataMode: mode, signal }))
          : Promise.resolve(null),
      ]);
      return { requestedMode: mode, profiles, catalog, datasets, snapshots, coverage };
    },
    enabled,
  );
}

export type CompositeSourcesState = SourcesState<RawCompositeSources>;

/**
 * Loads a Lab passport: the composite query with the weights from the link (required, through the
 * same repository call as Lab Prioritas) and the presets, catalog, datasets and snapshots (supporting).
 */
export function useCompositeSources(
  weights: Readonly<Record<string, number>>,
  provinceId: string | null,
  mode: DataMode,
  enabled: boolean,
): { readonly state: CompositeSourcesState; readonly retry: () => void } {
  const weightKey = Object.entries(weights)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, bps]) => `${id}:${String(bps)}`)
    .join(',');
  return useSourceLoader(
    `${mode}|lab|${provinceId ?? 'nasional'}|${weightKey}`,
    async (repository, signal): Promise<RawCompositeSources> => {
      const [composite, presets, catalog, datasets, snapshots, coverage, regions] = await Promise.all([
        repository.runExploratoryCompositeQuery({
          dataMode: mode,
          criteria: Object.entries(weights).map(([indicatorId, basisPoints]) => ({
            indicatorId,
            basisPoints,
          })),
          filterProvinceId: provinceId,
          signal,
        }),
        supporting(repository.getCompositePresets({ dataMode: mode, signal })),
        supporting(repository.getIndicatorCatalog({ dataMode: mode, signal })),
        supporting(repository.getDatasets(mode, signal)),
        supporting(repository.getSnapshots(mode, signal)),
        mode === 'LIVE'
          ? supporting(repository.getIndicatorCoverage({ dataMode: mode, signal }))
          : Promise.resolve(null),
        // The same registry call Lab uses to list provinces; only needed to name a province filter.
        provinceId === null
          ? Promise.resolve(null)
          : supporting(repository.searchRegions({ dataMode: mode, query: '', signal })),
      ]);
      return { requestedMode: mode, composite, presets, catalog, datasets, snapshots, coverage, regions };
    },
    enabled,
  );
}
