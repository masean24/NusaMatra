// Adapter test (colocated).

import { describe, expect, it } from 'vitest';
import {
  mapBoundariesData,
  mapCompositeQueryData,
  mapDatasetsData,
  mapEnvelope,
  mapHealthResponse,
  mapIndicatorCatalogData,
  mapIndicatorValuesData,
  mapRawObservationValue,
  mapRegionDetailData,
  mapRegionsListData,
  mapSnapshotsData,
  validateAndBuildCompositeWeights,
} from './domainMappers';
import type { HttpResponseContext } from './httpClient';

const defaultCtx: HttpResponseContext = {
  status: 200,
  requestId: null,
  dataFallback: null,
  serverMode: 'DEMO',
  clientReceivedAt: '2026-10-20T16:00:00.000Z',
};

describe('Domain Mappers — Observed Runtime Payloads', () => {
  it('decodes health.json directly without ApiResponse envelope', () => {
    const rawHealth = {
      status: 'healthy',
      version: '0.1.0',
      mode: 'DEMO',
      active_snapshot: '2026.10.0-wia-demo',
      database: {
        status: 'connected',
        tables: {
          dim_regions: 552,
          dim_indicators: 33,
          fact_indicator_values: 15934,
          data_snapshots: 1,
        },
        detail: null,
      },
      redis: 'not_configured',
      static_fallback_ready: true,
    };

    const health = mapHealthResponse(rawHealth, defaultCtx);
    expect(health.status).toBe('healthy');
    expect(health.dataMode).toBe('DEMO');
    expect(health.activeSnapshotId).toBe('2026.10.0-wia-demo');
    expect(health.database.tables?.dim_regions).toBe(552);
  });

  it('handles empty search results (q=bogor) honestly without inventing Kabupaten Bogor', () => {
    const rawEmptySearch = {
      status: 'success',
      meta: {
        snapshot_id: '2026.10.0-wia-demo',
        mode: 'DEMO',
        boundary_version: 'BIG-Kepmendagri-300.2.2-2430-2025',
        total_count: 0,
      },
      data: [],
    };

    const result = mapEnvelope(rawEmptySearch, 'DEMO', defaultCtx, (data, meta) =>
      mapRegionsListData(data, meta),
    );

    expect(result.data).toEqual([]);
    expect(result.meta.totalCount).toBe(0);
    expect(result.meta.serverRequestId).toBeNull();
  });

  it('maps non-empty regions list (regions_nonempty.json) preserving kabupaten/kota distinction and DEMO names', () => {
    const rawNonEmptyRegions = {
      status: 'success',
      meta: {
        snapshot_id: '2026.10.0-wia-demo',
        mode: 'DEMO',
        boundary_version: 'BIG-Kepmendagri-300.2.2-2430-2025',
        total_count: 2,
      },
      data: [
        {
          region_id: '3201',
          parent_region_id: '32',
          province_name: 'Provinsi Jawa Barat',
          level: 'kabupaten',
          name: 'Kabupaten Demo Jabar 1',
          short_name: 'Demo Jabar 1',
          codes: {
            kemendagri: '32.01',
            bps: '3201',
            kemendikdasmen: '020100',
          },
          island_group: 'Jawa',
          area_km2: 14998.63,
          anchor_point: { lng: 107.70407, lat: -7.657987 },
          bbox: [107.30407, -7.957987, 108.10407, -7.357987],
        },
        {
          region_id: '3271',
          parent_region_id: '32',
          province_name: 'Provinsi Jawa Barat',
          level: 'kota',
          name: 'Kota Demo Jabar 1',
          short_name: 'Kota Jabar 1',
          codes: {
            kemendagri: '32.71',
            bps: '3271',
            kemendikdasmen: '026100',
          },
          island_group: 'Jawa',
          area_km2: 230.66,
          anchor_point: { lng: 108.106474, lat: -6.655205 },
          bbox: [107.956474, -6.755205, 108.256474, -6.555205],
        },
      ],
    };

    const allResult = mapEnvelope(rawNonEmptyRegions, 'DEMO', defaultCtx, (data, meta) =>
      mapRegionsListData(data, meta),
    );
    expect(allResult.data).toHaveLength(2);
    expect(allResult.data[0]?.nameId).toBe('Kabupaten Demo Jabar 1');
    expect(allResult.data[0]?.adminLevel).toBe('REGENCY');
    expect(allResult.data[0]?.isSyntheticDemoName).toBe(true);
    expect(allResult.data[1]?.adminLevel).toBe('CITY');

    const citiesOnly = mapEnvelope(rawNonEmptyRegions, 'DEMO', defaultCtx, (data, meta) =>
      mapRegionsListData(data, meta, 'CITY'),
    );
    expect(citiesOnly.data).toHaveLength(1);
    expect(citiesOnly.data[0]?.regionId).toBe('3271');
  });

  it('preserves measured 0 vs null missing in mapRawObservationValue (API-INV-03)', () => {
    expect(mapRawObservationValue(0, 'DEMO_EXAMPLE')).toEqual({
      status: 'AVAILABLE',
      decimal: '0',
    });
    expect(mapRawObservationValue(null, 'DEMO_EXAMPLE')).toEqual({
      status: 'MISSING',
      decimal: null,
      reasonCode: 'NOT_PUBLISHED',
    });
    expect(mapRawObservationValue(null, 'SUPPRESSED')).toEqual({
      status: 'SUPPRESSED',
      decimal: null,
      reasonCode: 'PUBLISHER_SUPPRESSION',
    });
  });

  it('maps region_detail.json and preserves DEMO_EXAMPLE provenance', () => {
    const rawDetail = {
      status: 'success',
      meta: {
        snapshot_id: '2026.10.0-wia-demo',
        mode: 'DEMO',
        boundary_version: null,
        total_count: null,
      },
      data: {
        region: {
          region_id: '3201',
          parent_region_id: '32',
          province_name: 'Provinsi Jawa Barat',
          level: 'kabupaten',
          name: 'Kabupaten Demo Jabar 1',
          short_name: 'Demo Jabar 1',
          codes: { kemendagri: '32.01', bps: '3201', kemendikdasmen: '020100' },
          island_group: 'Jawa',
          area_km2: 14998.63,
          anchor_point: { lng: 107.70407, lat: -7.657987 },
          bbox: [107.30407, -7.957987, 108.10407, -7.357987],
        },
        composite_scores: {
          overall_priority_index: 45.2,
          disaster_risk: 43.5,
          socioeconomic: 24.2,
          education_access: 39.0,
          healthcare_access: 42.1,
          infrastructure: 84.3,
          data_reliability: 42.9,
        },
        indicators: [
          {
            indicator_id: 'meta_dapodik_sync_rate',
            indicator_name: 'Persentase Pengiriman Data Sinkronisasi Dapodik',
            category: 'data_reliability',
            raw_value: 70.6875,
            unit: 'percent (%)',
            normalized_score: 97.81,
            national_percentile: 1.17,
            national_rank: 7,
            reference_year: 2026,
            quality_flag: 'DEMO_EXAMPLE',
            provenance: {
              dataset_id: 'kemendikdasmen_dapodik_2026',
              agency_code: 'KEMENDIKDASMEN',
              official_url: 'https://dapo.kemendikdasmen.go.id/',
            },
          },
        ],
      },
    };

    const mapped = mapEnvelope(rawDetail, 'DEMO', defaultCtx, mapRegionDetailData);
    expect(mapped.data.region.regionId).toBe('3201');
    expect(mapped.data.compositeScores?.overallPriorityIndex).toBe('45.2');
    expect(mapped.data.indicators[0]?.isDemoExample).toBe(true);
    expect(mapped.data.indicators[0]?.observation.origin).toBe('DEMO');
    expect(mapped.data.indicators[0]?.observation.qualityIssueCodes).toContain('DEMO_EXAMPLE');
  });

  it('maps indicators.json and indicator_values.json keeping 0 distinct from null', () => {
    const rawIndicators = {
      status: 'success',
      meta: {
        snapshot_id: '2026.10.0-wia-demo',
        mode: 'DEMO',
        boundary_version: null,
        total_count: 1,
      },
      data: {
        socioeconomic: [
          {
            indicator_id: 'soc_poverty_rate',
            indicator_name: 'Persentase Penduduk Miskin (P0)',
            category: 'socioeconomic',
            unit: 'percent (%)',
            polarity: 'negative',
            availability_status: 'DIRECT',
            description: 'Persentase Penduduk Miskin (P0)',
            provenance: {
              dataset_id: 'bps_kemiskinan_2025',
              agency_code: 'BPS',
              dataset_title: 'Data Kemiskinan Kabupaten/Kota 2025',
              official_portal_url: 'https://webapi.bps.go.id/developer/',
            },
          },
        ],
      },
    };

    const catalog = mapEnvelope(rawIndicators, 'DEMO', defaultCtx, mapIndicatorCatalogData);
    expect(catalog.data.items).toHaveLength(1);
    expect(catalog.data.items[0]?.preferredDirection).toBe('HIGHER_IS_WORSE');

    const rawValues = {
      status: 'success',
      meta: {
        snapshot_id: '2026.10.0-wia-demo',
        mode: 'DEMO',
        boundary_version: null,
        total_count: null,
      },
      data: {
        indicator: rawIndicators.data.socioeconomic[0],
        values_by_region: {
          '1101': {
            raw: 32.304,
            norm: 80.09,
            pct: 83.24,
            rank: 87,
            flag: 'DEMO_EXAMPLE',
          },
          '1102': {
            raw: 0,
            norm: 0,
            pct: 0,
            rank: 514,
            flag: 'DEMO_EXAMPLE',
          },
          '1103': {
            raw: null,
            norm: null,
            pct: null,
            rank: null,
            flag: 'DEMO_EXAMPLE',
          },
        },
      },
    };

    const valuesMap = mapEnvelope(rawValues, 'DEMO', defaultCtx, mapIndicatorValuesData);
    expect(valuesMap.data.valuesByRegion['1101']?.value).toEqual({
      status: 'AVAILABLE',
      decimal: '32.304',
    });
    expect(valuesMap.data.valuesByRegion['1102']?.value).toEqual({
      status: 'AVAILABLE',
      decimal: '0',
    });
    expect(valuesMap.data.valuesByRegion['1103']?.value).toEqual({
      status: 'MISSING',
      decimal: null,
      reasonCode: 'NOT_PUBLISHED',
    });
  });

  it('validates composite weights (sum === 10000) and maps composite_valid.json without inventing runId or contributions', () => {
    expect(() =>
      validateAndBuildCompositeWeights([{ indicatorId: 'soc_poverty_rate', basisPoints: 9000 }]),
    ).toThrow(/10000/);

    const validWeights = validateAndBuildCompositeWeights([
      { indicatorId: 'dis_multihazard_index', basisPoints: 3500 },
      { indicatorId: 'soc_poverty_rate', basisPoints: 2500 },
      { indicatorId: 'edu_damaged_classrooms_pct', basisPoints: 2000 },
      { indicatorId: 'hlt_stunting_prevalence', basisPoints: 2000 },
    ]);
    expect(validWeights.dis_multihazard_index).toBe(3500);

    const rawComposite = {
      status: 'success',
      meta: {
        snapshot_id: '2026.10.0-wia-demo',
        mode: 'DEMO',
        boundary_version: null,
        total_count: null,
      },
      data: {
        total_regions: 514,
        weights_basis_points: validWeights,
        regions: [
          {
            region_id: '1811',
            region_name: 'Kabupaten Demo Lampung 11',
            composite_score: 91.1,
            rank: 1,
            component_scores: {
              dis_multihazard_index: 98.34,
              edu_damaged_classrooms_pct: 96.88,
              hlt_stunting_prevalence: 97.45,
              soc_poverty_rate: 71.27,
            },
          },
        ],
      },
    };

    const mapped = mapEnvelope(rawComposite, 'DEMO', defaultCtx, mapCompositeQueryData);
    expect(mapped.data.runId).toBeNull();
    expect(mapped.data.isExploratoryPreview).toBe(true);
    expect(mapped.data.weightedContributionsAvailable).toBe(false);
    expect(mapped.data.contributions).toBeNull();
    expect(mapped.data.items[0]?.compositeScoreDecimal).toBe('91.1');
    expect(mapped.data.items[0]?.componentScoresDecimal.dis_multihazard_index).toBe('98.34');
  });

  it('flags Point-only boundaries (boundaries_kabupaten.json) with canExtrudePolygons: false', () => {
    const rawBoundaries = {
      status: 'success',
      meta: {
        snapshot_id: '2026.10.0-wia-demo',
        mode: 'DEMO',
        boundary_version: 'BIG-Kepmendagri-300.2.2-2430-2025',
        total_count: 1,
      },
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              region_id: '3201',
              parent_region_id: '32',
              name: 'Kabupaten Demo Jabar 1',
              kemendagri_code: '32.01',
              bps_code: '3201',
              label_lng: 107.70407,
              label_lat: -7.657987,
            },
            geometry: {
              type: 'Point',
              coordinates: [107.70407, -7.657987],
            },
            bbox: [107.30407, -7.957987, 108.10407, -7.357987],
          },
        ],
        geometry_status: {
          geometry_available: false,
          geometry_type_returned: 'Point',
          source: 'DEMO_PLACEHOLDER',
          boundary_version: 'BIG-Kepmendagri-300.2.2-2430-2025',
          data_mode: 'DEMO',
          note: 'MVP DEMO returns label-point geometry only',
        },
        request_params: {
          format: 'geojson',
          resolution: 'low',
        },
      },
    };

    const boundaries = mapEnvelope(rawBoundaries, 'DEMO', defaultCtx, mapBoundariesData);
    expect(boundaries.data.geometryStatus.geometryAvailable).toBe(false);
    expect(boundaries.data.geometryStatus.geometryTypeReturned).toBe('Point');
    expect(boundaries.data.geometryStatus.canExtrudePolygons).toBe(false);
  });

  it('flags non-hexadecimal snapshot and dataset checksums as placeholders', () => {
    const rawSnapshots = {
      status: 'success',
      meta: {
        snapshot_id: '2026.10.0-wia-demo',
        mode: 'DEMO',
      },
      data: [
        {
          snapshot_id: '2026.10.0-wia-demo',
          label: 'WIA 2026 Demo Showcase Dataset',
          environment_tag: 'DEMO',
          is_active_default: true,
          boundary_version: 'BIG-Kepmendagri-300.2.2-2430-2025',
          created_at: '2026-10-20 15:48:56',
          published_at: '2026-10-20 15:48:56',
          manifest_checksum: 'd3m0d3m0d3m0d3m0d3m0d3m0d3m0d3m0d3m0d3m0d3m0d3m0d3m0d3m0d3m0d3m0',
          notes: 'DEMO/EXAMPLE data only.',
          indicator_completeness_pct: 100.0,
        },
      ],
    };

    const snapshots = mapEnvelope(rawSnapshots, 'DEMO', defaultCtx, mapSnapshotsData);
    expect(snapshots.data[0]?.verifiedDigestSha256).toBeNull();
    expect(snapshots.data[0]?.isChecksumPlaceholder).toBe(true);

    const rawDatasets = {
      status: 'success',
      meta: {
        snapshot_id: '2026.10.0-wia-demo',
        mode: 'DEMO',
      },
      data: [
        {
          dataset_id: 'bps_kemiskinan_2025',
          agency_code: 'BPS',
          agency_name: 'Badan Pusat Statistik',
          dataset_title: 'Data Kemiskinan Kabupaten/Kota 2025 (Susenas Maret)',
          official_portal_url: 'https://webapi.bps.go.id/developer/',
          api_or_download_url:
            'https://webapi.bps.go.id/v1/api/list/model/data/domain/0000/var/kemiskinan/key/DEMO/',
          access_method: 'REST_API',
          license_name: 'Data Terbuka BPS',
          update_frequency: 'Tahunan',
          last_ingested_at: '2026-10-20 15:48:56',
          raw_sha256: 'demo_placeholder_00000000000000000000000000000000000000000000000',
        },
      ],
    };

    const datasets = mapEnvelope(rawDatasets, 'DEMO', defaultCtx, mapDatasetsData);
    expect(datasets.data[0]?.verifiedSha256).toBeNull();
    expect(datasets.data[0]?.isChecksumPlaceholder).toBe(true);
  });
});
