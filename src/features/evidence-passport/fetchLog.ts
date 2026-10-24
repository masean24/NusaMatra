import type { AdaptedEnvelope } from '@/services/api';
import type { RawCompositeSources } from './compositeTypes';
import type { LabEvidenceQuery } from './evidenceQuery';
import type { FetchedResponse, RawEvidenceSources } from './evidenceTypes';

function fetchedFrom(
  resource: string,
  envelope: AdaptedEnvelope<unknown>,
  request: Pick<FetchedResponse, 'method' | 'path'> &
    Partial<Pick<FetchedResponse, 'query' | 'body'>> & { readonly requestedMode: string },
): FetchedResponse {
  const { meta } = envelope;
  return {
    resource,
    method: request.method,
    path: request.path,
    query: { ...request.query, mode: request.requestedMode.toLowerCase() },
    body: request.body ?? null,
    mode: meta.dataMode,
    snapshotId: meta.snapshotId,
    boundaryVersion: meta.boundaryVersion,
    receivedByBrowserAt: meta.clientReceivedAt,
    serverRequestId: meta.serverRequestId,
  };
}

/** The supporting responses both kinds of record share. Failed ones are absent (and listed as gaps). */
function supportingResponses(
  raw: Pick<RawEvidenceSources, 'requestedMode' | 'catalog' | 'datasets' | 'snapshots' | 'coverage'>,
): FetchedResponse[] {
  const { requestedMode } = raw;
  return [
    ...(raw.catalog
      ? [
          fetchedFrom('indicator-catalog', raw.catalog, {
            method: 'GET',
            path: '/api/v1/indicators',
            requestedMode,
          }),
        ]
      : []),
    ...(raw.datasets
      ? [fetchedFrom('datasets', raw.datasets, { method: 'GET', path: '/api/v1/datasets', requestedMode })]
      : []),
    ...(raw.snapshots
      ? [fetchedFrom('snapshots', raw.snapshots, { method: 'GET', path: '/api/v1/snapshots', requestedMode })]
      : []),
    ...(raw.coverage
      ? [
          fetchedFrom('indicator-coverage', raw.coverage, {
            method: 'GET',
            path: '/api/v1/indicators/coverage',
            requestedMode,
          }),
        ]
      : []),
  ];
}

export function fetchedForRegions(raw: RawEvidenceSources): FetchedResponse[] {
  return [
    ...raw.profiles.map((envelope) =>
      fetchedFrom(`region-detail:${envelope.data.region.regionId}`, envelope, {
        method: 'GET',
        path: `/api/v1/regions/${envelope.data.region.regionId}`,
        requestedMode: raw.requestedMode,
      }),
    ),
    ...supportingResponses(raw),
  ];
}

export function fetchedForComposite(query: LabEvidenceQuery, raw: RawCompositeSources): FetchedResponse[] {
  const { requestedMode } = raw;
  return [
    fetchedFrom('composite-query', raw.composite, {
      method: 'POST',
      path: '/api/v1/indicators/composite-query',
      body: { weights: query.weights, filter_province_id: query.provinceId ?? null },
      requestedMode,
    }),
    ...(raw.presets
      ? [
          fetchedFrom('composite-presets', raw.presets, {
            method: 'GET',
            path: '/api/v1/indicators/composite-presets',
            requestedMode,
          }),
        ]
      : []),
    ...(raw.regions
      ? [
          fetchedFrom('region-registry', raw.regions, {
            method: 'GET',
            path: '/api/v1/regions',
            query: { level: 'kabupaten_kota' },
            requestedMode,
          }),
        ]
      : []),
    ...supportingResponses(raw),
  ];
}
