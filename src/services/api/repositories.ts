// Nusa Matra Data Hub adapter.

import {
  mapBoundariesData,
  mapCompositeQueryData,
  mapDatasetsData,
  mapEnvelope,
  mapHealthResponse,
  mapIndicatorCatalogData,
  mapIndicatorValuesData,
  mapRegionDetailData,
  mapRegionsListData,
  mapSnapshotsData,
  toBackendRegionLevelQuery,
  validateAndBuildCompositeWeights,
} from './domainMappers';
import { mapEarthquakeFeed, type EarthquakeFeedDTO } from './earthquakes';
import { DataHubHttpClient } from './httpClient';
import type {
  AdaptedEnvelope,
  AdminLevel,
  BoundaryCollectionDTO,
  DataHubDatasetDTO,
  DataHubIndicatorDTO,
  DataHubRegionDTO,
  DataHubSnapshotDTO,
  DataMode,
  ExploratoryCompositeResultDTO,
  IndicatorCatalogDTO,
  IndicatorValuesMapDTO,
  RegionProfileDTO,
  SystemHealthDTO,
  WeightedCriterionInput,
} from './wireTypes';

export interface SearchRegionsInput {
  readonly dataMode: DataMode;
  readonly query?: string | undefined;
  readonly adminLevel?: AdminLevel | undefined;
  readonly parentRegionId?: string | null | undefined;
  readonly signal?: AbortSignal | undefined;
}

export interface GetRegionDetailInput {
  readonly dataMode: DataMode;
  readonly regionId: string;
  readonly signal?: AbortSignal | undefined;
}

export interface GetIndicatorsInput {
  readonly dataMode: DataMode;
  readonly category?: string | undefined;
  readonly query?: string | undefined;
  readonly signal?: AbortSignal | undefined;
}

export interface GetIndicatorValuesInput {
  readonly dataMode: DataMode;
  readonly indicatorId: string;
  readonly signal?: AbortSignal | undefined;
}

export interface RunExploratoryCompositeInput {
  readonly dataMode: DataMode;
  readonly criteria: readonly WeightedCriterionInput[];
  readonly filterProvinceId?: string | null | undefined;
  readonly signal?: AbortSignal | undefined;
}

export interface GetBoundariesInput {
  readonly dataMode: DataMode;
  readonly adminLevel: AdminLevel;
  readonly format?: 'geojson' | 'topojson' | undefined;
  readonly resolution?: 'low' | 'high' | undefined;
  readonly provinceId?: string | null | undefined;
  readonly signal?: AbortSignal | undefined;
}

/**
 * Deterministic cache key builders so TanStack Query / custom caches never mix
 * DEMO and LIVE responses or different snapshots/regions (docs/08-API-SPECIFICATION.md Section 17.1).
 */
export const DataHubCacheKeys = {
  health: () => ['nusa-matra', 'v1', 'health'] as const,
  snapshots: (dataMode: DataMode) => ['nusa-matra', 'v1', dataMode, 'snapshots'] as const,
  datasets: (dataMode: DataMode) => ['nusa-matra', 'v1', dataMode, 'datasets'] as const,
  regionsSearch: (input: Omit<SearchRegionsInput, 'signal'>) =>
    [
      'nusa-matra',
      'v1',
      input.dataMode,
      'regions',
      input.adminLevel ?? 'ALL_KAB_KOTA',
      input.parentRegionId ?? 'ALL_PROVINCES',
      (input.query ?? '').trim().toLowerCase(),
    ] as const,
  regionDetail: (dataMode: DataMode, regionId: string, snapshotId = 'ACTIVE_UNPINNED') =>
    ['nusa-matra', 'v1', dataMode, snapshotId, 'region-detail', regionId] as const,
  indicatorsCatalog: (dataMode: DataMode, category?: string, query?: string) =>
    [
      'nusa-matra',
      'v1',
      dataMode,
      'indicators',
      category ?? 'ALL_CATEGORIES',
      (query ?? '').trim().toLowerCase(),
    ] as const,
  indicatorValues: (dataMode: DataMode, indicatorId: string, snapshotId = 'ACTIVE_UNPINNED') =>
    ['nusa-matra', 'v1', dataMode, snapshotId, 'indicator-values', indicatorId] as const,
  compositePreview: (
    dataMode: DataMode,
    criteria: readonly WeightedCriterionInput[],
    filterProvinceId?: string | null,
  ) => {
    const canonicalWeights = [...criteria]
      .filter((c) => c.basisPoints > 0)
      .sort((a, b) => a.indicatorId.localeCompare(b.indicatorId))
      .map((c) => `${c.indicatorId}:${c.basisPoints}`)
      .join('|');
    return [
      'nusa-matra',
      'v1',
      dataMode,
      'composite-preview',
      filterProvinceId ?? 'NATIONAL',
      canonicalWeights,
    ] as const;
  },
  boundaries: (
    dataMode: DataMode,
    adminLevel: AdminLevel,
    provinceId?: string | null,
    resolution: 'low' | 'high' = 'low',
  ) => ['nusa-matra', 'v1', dataMode, 'boundaries', adminLevel, provinceId ?? 'ALL', resolution] as const,
};

/**
 * High-level repository facade for the Nusa Matra FastAPI Data Hub (v0.1.0).
 * Implements:
 * 1. Region search & listing (`GET /api/v1/regions`)
 * 2. Region detail profile (`GET /api/v1/regions/{region_id}`)
 * 3. Indicator catalog (`GET /api/v1/indicators`) & regional values (`GET /api/v1/indicators/{id}/values`)
 * 4. Lab Prioritas DEMO composite query (`POST /api/v1/indicators/composite-query`)
 * 5. Boundary placeholder check (`GET /api/v1/boundaries/kabupaten` & `/provinsi`)
 * 6. Snapshots, Datasets, and System Health
 */
export class NusaMatraDataHubRepository {
  private readonly client: DataHubHttpClient;

  constructor(client: DataHubHttpClient) {
    this.client = client;
  }

  async getHealth(signal?: AbortSignal): Promise<SystemHealthDTO> {
    return this.client.get(
      '/api/v1/health',
      {
        parse: (raw, ctx) => mapHealthResponse(raw, ctx),
      },
      { signal },
    );
  }

  async searchRegions(input: SearchRegionsInput): Promise<AdaptedEnvelope<readonly DataHubRegionDTO[]>> {
    const trimmedQuery = input.query?.trim();
    const levelParam = toBackendRegionLevelQuery(input.adminLevel);

    return this.client.get(
      '/api/v1/regions',
      {
        parse: (raw, ctx) =>
          mapEnvelope(raw, input.dataMode, ctx, (data, meta) =>
            mapRegionsListData(data, meta, input.adminLevel),
          ),
      },
      {
        dataMode: input.dataMode,
        signal: input.signal,
        query: {
          level: levelParam,
          parent_id: input.parentRegionId ?? undefined,
          q: trimmedQuery && trimmedQuery.length > 0 ? trimmedQuery : undefined,
        },
      },
    );
  }

  async getRegionDetail(input: GetRegionDetailInput): Promise<AdaptedEnvelope<RegionProfileDTO>> {
    const encodedId = encodeURIComponent(input.regionId.trim());
    return this.client.get(
      `/api/v1/regions/${encodedId}`,
      {
        parse: (raw, ctx) =>
          mapEnvelope(raw, input.dataMode, ctx, (data, meta) => mapRegionDetailData(data, meta)),
      },
      {
        dataMode: input.dataMode,
        signal: input.signal,
      },
    );
  }

  async getIndicatorCatalog(input: GetIndicatorsInput): Promise<AdaptedEnvelope<IndicatorCatalogDTO>> {
    const envelope = await this.client.get(
      '/api/v1/indicators',
      {
        parse: (raw, ctx) =>
          mapEnvelope(raw, input.dataMode, ctx, (data, meta) => mapIndicatorCatalogData(data, meta)),
      },
      {
        dataMode: input.dataMode,
        signal: input.signal,
      },
    );

    const categoryFilter = input.category?.trim();
    const textFilter = input.query?.trim().toLowerCase();

    if (!categoryFilter && !textFilter) {
      return envelope;
    }

    const filteredItems: DataHubIndicatorDTO[] = envelope.data.items.filter((item) => {
      if (categoryFilter && item.category !== categoryFilter) {
        return false;
      }
      if (textFilter) {
        const matchesId = item.indicatorId.toLowerCase().includes(textFilter);
        const matchesLabel = item.labelId.toLowerCase().includes(textFilter);
        const matchesDesc = item.description.toLowerCase().includes(textFilter);
        return matchesId || matchesLabel || matchesDesc;
      }
      return true;
    });

    const filteredByCategory: Record<string, DataHubIndicatorDTO[]> = {};
    for (const item of filteredItems) {
      const group = filteredByCategory[item.category] ?? [];
      group.push(item);
      filteredByCategory[item.category] = group;
    }

    return {
      meta: envelope.meta,
      data: {
        items: filteredItems,
        byCategory: filteredByCategory,
        categories: Object.keys(filteredByCategory),
      },
    };
  }

  async getIndicatorValues(input: GetIndicatorValuesInput): Promise<AdaptedEnvelope<IndicatorValuesMapDTO>> {
    const encodedIndicatorId = encodeURIComponent(input.indicatorId.trim());
    return this.client.get(
      `/api/v1/indicators/${encodedIndicatorId}/values`,
      {
        parse: (raw, ctx) =>
          mapEnvelope(raw, input.dataMode, ctx, (data, meta) => mapIndicatorValuesData(data, meta)),
      },
      {
        dataMode: input.dataMode,
        signal: input.signal,
      },
    );
  }

  async runExploratoryCompositeQuery(
    input: RunExploratoryCompositeInput,
  ): Promise<AdaptedEnvelope<ExploratoryCompositeResultDTO>> {
    // Client-side pre-validation of basis points (sum === 10000, integer, no duplicates)
    const weights = validateAndBuildCompositeWeights(input.criteria);

    return this.client.post(
      '/api/v1/indicators/composite-query',
      {
        weights,
        filter_province_id: input.filterProvinceId ?? null,
      },
      {
        parse: (raw, ctx) =>
          mapEnvelope(raw, input.dataMode, ctx, (data, meta) => mapCompositeQueryData(data, meta)),
      },
      {
        dataMode: input.dataMode,
        signal: input.signal,
      },
    );
  }

  /**
   * BMKG earthquake epicentres (`GET /api/v1/earthquakes/geojson`). Not an envelope: a GeoJSON
   * collection whose mode is read from the response header. Always revalidated with the server: the
   * feed changes every minute, and older deployments marked it cacheable for an hour.
   */
  async getEarthquakeFeed(input: {
    readonly dataMode: DataMode;
    readonly signal?: AbortSignal | undefined;
  }): Promise<EarthquakeFeedDTO> {
    return this.client.get(
      '/api/v1/earthquakes/geojson',
      { parse: (raw, ctx) => mapEarthquakeFeed(raw, ctx, input.dataMode) },
      { dataMode: input.dataMode, signal: input.signal, cache: 'no-cache' },
    );
  }

  async getBoundaries(input: GetBoundariesInput): Promise<AdaptedEnvelope<BoundaryCollectionDTO>> {
    const isProvince = input.adminLevel === 'PROVINCE';
    const path = isProvince ? '/api/v1/boundaries/provinsi' : '/api/v1/boundaries/kabupaten';

    return this.client.get(
      path,
      {
        parse: (raw, ctx) =>
          mapEnvelope(raw, input.dataMode, ctx, (data, meta) => mapBoundariesData(data, meta)),
      },
      {
        dataMode: input.dataMode,
        signal: input.signal,
        query: isProvince
          ? {
              format: input.format ?? 'geojson',
            }
          : {
              format: input.format ?? 'geojson',
              resolution: input.resolution ?? 'low',
              province_id: input.provinceId ?? undefined,
            },
      },
    );
  }

  async getSnapshots(
    dataMode: DataMode,
    signal?: AbortSignal,
  ): Promise<AdaptedEnvelope<readonly DataHubSnapshotDTO[]>> {
    return this.client.get(
      '/api/v1/snapshots',
      {
        parse: (raw, ctx) => mapEnvelope(raw, dataMode, ctx, (data, meta) => mapSnapshotsData(data, meta)),
      },
      {
        dataMode,
        signal,
      },
    );
  }

  async getDatasets(
    dataMode: DataMode,
    signal?: AbortSignal,
  ): Promise<AdaptedEnvelope<readonly DataHubDatasetDTO[]>> {
    return this.client.get(
      '/api/v1/datasets',
      {
        parse: (raw, ctx) => mapEnvelope(raw, dataMode, ctx, (data, meta) => mapDatasetsData(data, meta)),
      },
      {
        dataMode,
        signal,
      },
    );
  }
}

/** The app's single repository, built from the validated public configuration. */
export function createDataHubRepository(baseUrl: string): NusaMatraDataHubRepository {
  return new NusaMatraDataHubRepository(new DataHubHttpClient({ baseUrl }));
}
