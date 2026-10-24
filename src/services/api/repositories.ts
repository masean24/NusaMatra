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
  mapSnapshotDetailData,
  mapSnapshotsData,
  toBackendRegionLevelQuery,
  validateAndBuildCompositeWeights,
} from './domainMappers';
import { mapEarthquakeFeed, type EarthquakeFeedDTO } from './earthquakes';
import {
  mapCompositePresetsData,
  mapIndicatorCoverageData,
  type CompositePresetsDTO,
  type IndicatorCoverageDTO,
} from './labContract';
import { DataHubHttpClient } from './httpClient';
import { assertPinned, pinQuery } from './snapshotPinning';
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
  SnapshotDetailDTO,
  SnapshotPin,
  SystemHealthDTO,
  WeightedCriterionInput,
} from './wireTypes';

/**
 * v2.2: pins a request to one snapshot (`?snapshot=<id>`); the response must repeat its id and digest
 * or the call fails (`assertPinned`). Absent = the Data Hub's active snapshot, unverified.
 */
interface Pinnable {
  readonly snapshot?: SnapshotPin | null | undefined;
}

export interface SearchRegionsInput extends Pinnable {
  readonly dataMode: DataMode;
  readonly query?: string | undefined;
  readonly adminLevel?: AdminLevel | undefined;
  readonly parentRegionId?: string | null | undefined;
  readonly signal?: AbortSignal | undefined;
}

export interface GetRegionDetailInput extends Pinnable {
  readonly dataMode: DataMode;
  readonly regionId: string;
  readonly signal?: AbortSignal | undefined;
}

export interface GetIndicatorsInput extends Pinnable {
  readonly dataMode: DataMode;
  readonly category?: string | undefined;
  readonly query?: string | undefined;
  readonly signal?: AbortSignal | undefined;
}

export interface GetIndicatorValuesInput extends Pinnable {
  readonly dataMode: DataMode;
  readonly indicatorId: string;
  readonly signal?: AbortSignal | undefined;
}

export interface RunExploratoryCompositeInput extends Pinnable {
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

    const envelope = await this.client.get(
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
          ...pinQuery(input.snapshot),
        },
      },
    );
    return assertPinned(envelope, input.snapshot);
  }

  async getRegionDetail(input: GetRegionDetailInput): Promise<AdaptedEnvelope<RegionProfileDTO>> {
    const encodedId = encodeURIComponent(input.regionId.trim());
    const envelope = await this.client.get(
      `/api/v1/regions/${encodedId}`,
      {
        parse: (raw, ctx) =>
          mapEnvelope(raw, input.dataMode, ctx, (data, meta) => mapRegionDetailData(data, meta)),
      },
      {
        dataMode: input.dataMode,
        signal: input.signal,
        query: pinQuery(input.snapshot),
      },
    );
    return assertPinned(envelope, input.snapshot);
  }

  async getIndicatorCatalog(input: GetIndicatorsInput): Promise<AdaptedEnvelope<IndicatorCatalogDTO>> {
    const envelope = assertPinned(
      await this.client.get(
        '/api/v1/indicators',
        {
          parse: (raw, ctx) =>
            mapEnvelope(raw, input.dataMode, ctx, (data, meta) => mapIndicatorCatalogData(data, meta)),
        },
        {
          dataMode: input.dataMode,
          signal: input.signal,
          query: pinQuery(input.snapshot),
        },
      ),
      input.snapshot,
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
    const envelope = await this.client.get(
      `/api/v1/indicators/${encodedIndicatorId}/values`,
      {
        parse: (raw, ctx) =>
          mapEnvelope(raw, input.dataMode, ctx, (data, meta) => mapIndicatorValuesData(data, meta)),
      },
      {
        dataMode: input.dataMode,
        signal: input.signal,
        query: pinQuery(input.snapshot),
      },
    );
    return assertPinned(envelope, input.snapshot);
  }

  async runExploratoryCompositeQuery(
    input: RunExploratoryCompositeInput,
  ): Promise<AdaptedEnvelope<ExploratoryCompositeResultDTO>> {
    // Client-side pre-validation of basis points (sum === 10000, integer, no duplicates)
    const weights = validateAndBuildCompositeWeights(input.criteria);

    const envelope = await this.client.post(
      '/api/v1/indicators/composite-query',
      {
        weights,
        filter_province_id: input.filterProvinceId ?? null,
      },
      {
        parse: (raw, ctx) =>
          mapEnvelope(raw, input.dataMode, ctx, (data, meta) =>
            mapCompositeQueryData(data, meta, input.filterProvinceId ?? null),
          ),
      },
      {
        dataMode: input.dataMode,
        signal: input.signal,
        query: pinQuery(input.snapshot),
      },
    );
    return assertPinned(envelope, input.snapshot);
  }

  /** Which indicators hold data in this mode, and for how many regions (guide v2, BE-03). */
  async getIndicatorCoverage(
    input: {
      readonly dataMode: DataMode;
      readonly signal?: AbortSignal | undefined;
    } & Pinnable,
  ): Promise<AdaptedEnvelope<IndicatorCoverageDTO>> {
    const envelope = await this.client.get(
      '/api/v1/indicators/coverage',
      { parse: (raw, ctx) => mapEnvelope(raw, input.dataMode, ctx, mapIndicatorCoverageData) },
      { dataMode: input.dataMode, signal: input.signal, query: pinQuery(input.snapshot) },
    );
    return assertPinned(envelope, input.snapshot);
  }

  /** Scenario presets the Data Hub publishes; only presets matching the contract are kept. */
  async getCompositePresets(
    input: {
      readonly dataMode: DataMode;
      readonly signal?: AbortSignal | undefined;
    } & Pinnable,
  ): Promise<AdaptedEnvelope<CompositePresetsDTO>> {
    const envelope = await this.client.get(
      '/api/v1/indicators/composite-presets',
      { parse: (raw, ctx) => mapEnvelope(raw, input.dataMode, ctx, mapCompositePresetsData) },
      { dataMode: input.dataMode, signal: input.signal, query: pinQuery(input.snapshot) },
    );
    return assertPinned(envelope, input.snapshot);
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
        // Which snapshot is active changes on deploy; a cached list would pin to an old one.
        cache: 'no-cache',
      },
    );
  }

  /**
   * v2.2 `GET /api/v1/snapshots/{id}`: full metadata of one snapshot. An unknown id is a 404
   * (`SNAPSHOT_NOT_FOUND`); the Data Hub never answers with another snapshot instead.
   */
  async getSnapshotDetail(input: {
    readonly dataMode: DataMode;
    readonly snapshotId: string;
    readonly signal?: AbortSignal | undefined;
  }): Promise<AdaptedEnvelope<SnapshotDetailDTO>> {
    return this.client.get(
      `/api/v1/snapshots/${encodeURIComponent(input.snapshotId)}`,
      {
        parse: (raw, ctx) =>
          mapEnvelope(raw, input.dataMode, ctx, (data, meta) =>
            mapSnapshotDetailData(data, meta, input.snapshotId),
          ),
      },
      { dataMode: input.dataMode, signal: input.signal, cache: 'no-cache' },
    );
  }

  async getDatasets(
    dataMode: DataMode,
    signal?: AbortSignal,
    snapshot?: SnapshotPin | null,
  ): Promise<AdaptedEnvelope<readonly DataHubDatasetDTO[]>> {
    const envelope = await this.client.get(
      '/api/v1/datasets',
      {
        parse: (raw, ctx) => mapEnvelope(raw, dataMode, ctx, (data, meta) => mapDatasetsData(data, meta)),
      },
      {
        dataMode,
        signal,
        query: pinQuery(snapshot),
      },
    );
    return assertPinned(envelope, snapshot);
  }
}

/** The app's single repository, built from the validated public configuration. */
export function createDataHubRepository(baseUrl: string): NusaMatraDataHubRepository {
  return new NusaMatraDataHubRepository(new DataHubHttpClient({ baseUrl }));
}
