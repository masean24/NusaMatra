import type { DataMode, NusaMatraDataHubRepository } from '@/services/api';
import type { RawCompositeSources } from './compositeTypes';
import type { RawEvidenceSources } from './evidenceTypes';
import { pinOf, resolvePassportSnapshot } from './snapshotResolution';
import { supporting, useSourceLoader, type SourcesState } from './useSourceLoader';

export type EvidenceSourcesState = SourcesState<RawEvidenceSources>;

/**
 * What a region or comparison passport needs: the profile of each region (required) and the catalog,
 * datasets and coverage (supporting). The snapshot is resolved first and every request is pinned to
 * it; a response from any other snapshot fails the whole passport. A failed supporting request becomes
 * `null`, which the record reports as a gap. The mode is passed explicitly to every request.
 */
export async function loadEvidenceSources(
  repository: NusaMatraDataHubRepository,
  regionIds: readonly string[],
  mode: DataMode,
  linkSnapshotId: string | null | undefined,
  signal?: AbortSignal,
): Promise<RawEvidenceSources> {
  const { pinning, list } = await resolvePassportSnapshot(repository, mode, linkSnapshotId, signal);
  const snapshot = pinOf(pinning);
  const [profiles, catalog, datasets, coverage] = await Promise.all([
    Promise.all(
      regionIds.map((regionId) => repository.getRegionDetail({ dataMode: mode, regionId, signal, snapshot })),
    ),
    supporting(repository.getIndicatorCatalog({ dataMode: mode, signal, snapshot })),
    supporting(repository.getDatasets(mode, signal, snapshot)),
    // The coverage matrix exists only for LIVE; DEMO has no such response.
    mode === 'LIVE'
      ? supporting(repository.getIndicatorCoverage({ dataMode: mode, signal, snapshot }))
      : Promise.resolve(null),
  ]);
  return { requestedMode: mode, pinning, profiles, catalog, datasets, snapshots: list, coverage };
}

export function useEvidenceSources(
  regionIds: readonly string[],
  mode: DataMode,
  linkSnapshotId: string | null | undefined,
  enabled: boolean,
): { readonly state: EvidenceSourcesState; readonly retry: () => void } {
  return useSourceLoader(
    `${mode}|${linkSnapshotId ?? 'aktif'}|region|${regionIds.join(',')}`,
    (repository, signal) => loadEvidenceSources(repository, regionIds, mode, linkSnapshotId, signal),
    enabled,
  );
}

export type CompositeSourcesState = SourcesState<RawCompositeSources>;

/**
 * A Lab passport: the composite query with the weights from the link (required, through the same
 * repository call as Lab Prioritas) and the presets, catalog, datasets, coverage, region registry and,
 * in LIVE, the values of each weighted indicator (supporting). Pinned like `loadEvidenceSources`.
 */
export async function loadCompositeSources(
  repository: NusaMatraDataHubRepository,
  weights: Readonly<Record<string, number>>,
  provinceId: string | null,
  mode: DataMode,
  linkSnapshotId: string | null | undefined,
  signal?: AbortSignal,
): Promise<RawCompositeSources> {
  const { pinning, list } = await resolvePassportSnapshot(repository, mode, linkSnapshotId, signal);
  const snapshot = pinOf(pinning);
  const [composite, presets, catalog, datasets, coverage, regions] = await Promise.all([
    repository.runExploratoryCompositeQuery({
      dataMode: mode,
      criteria: Object.entries(weights).map(([indicatorId, basisPoints]) => ({ indicatorId, basisPoints })),
      filterProvinceId: provinceId,
      signal,
      snapshot,
    }),
    supporting(repository.getCompositePresets({ dataMode: mode, signal, snapshot })),
    supporting(repository.getIndicatorCatalog({ dataMode: mode, signal, snapshot })),
    supporting(repository.getDatasets(mode, signal, snapshot)),
    mode === 'LIVE'
      ? supporting(repository.getIndicatorCoverage({ dataMode: mode, signal, snapshot }))
      : Promise.resolve(null),
    // The same registry call Lab uses to list provinces; only needed to name a province filter.
    provinceId === null
      ? Promise.resolve(null)
      : supporting(repository.searchRegions({ dataMode: mode, query: '', signal, snapshot })),
  ]);
  // LIVE: the published values of every weighted indicator, for the direction check (as in Lab).
  const weighted = Object.keys(weights).filter((id) => (weights[id] ?? 0) > 0);
  const indicatorValues =
    mode === 'LIVE'
      ? Object.fromEntries(
          await Promise.all(
            weighted.map(
              async (indicatorId) =>
                [
                  indicatorId,
                  await supporting(
                    repository.getIndicatorValues({ dataMode: mode, indicatorId, signal, snapshot }),
                  ),
                ] as const,
            ),
          ),
        )
      : null;
  return {
    requestedMode: mode,
    pinning,
    composite,
    presets,
    catalog,
    datasets,
    snapshots: list,
    coverage,
    regions,
    indicatorValues,
  };
}

export function useCompositeSources(
  weights: Readonly<Record<string, number>>,
  provinceId: string | null,
  mode: DataMode,
  linkSnapshotId: string | null | undefined,
  enabled: boolean,
): { readonly state: CompositeSourcesState; readonly retry: () => void } {
  const weightKey = Object.entries(weights)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, bps]) => `${id}:${String(bps)}`)
    .join(',');
  return useSourceLoader(
    `${mode}|${linkSnapshotId ?? 'aktif'}|lab|${provinceId ?? 'nasional'}|${weightKey}`,
    (repository, signal) =>
      loadCompositeSources(repository, weights, provinceId, mode, linkSnapshotId, signal),
    enabled,
  );
}
