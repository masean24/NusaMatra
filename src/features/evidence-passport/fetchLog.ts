import type { AdaptedEnvelope } from '@/services/api';
import type { RawCompositeSources } from './compositeTypes';
import type { LabEvidenceQuery } from './evidenceQuery';
import type { FetchedResponse, RawEvidenceSources } from './evidenceTypes';
import type { SnapshotPinning } from './snapshotResolution';

/** What every request of one record shared: its mode and, when pinned, its `snapshot` parameter. */
interface RequestContext {
  readonly requestedMode: string;
  readonly pinnedSnapshotId: string | null;
}

const contextOf = (raw: {
  readonly requestedMode: string;
  readonly pinning: SnapshotPinning;
}): RequestContext => ({
  requestedMode: raw.requestedMode,
  pinnedSnapshotId: raw.pinning.status === 'PINNED' ? raw.pinning.pin.snapshotId : null,
});

function fetchedFrom(
  resource: string,
  envelope: AdaptedEnvelope<unknown>,
  request: Pick<FetchedResponse, 'method' | 'path'> & Partial<Pick<FetchedResponse, 'query' | 'body'>>,
  context: RequestContext,
  pinned = true,
): FetchedResponse {
  const { meta } = envelope;
  return {
    resource,
    method: request.method,
    path: request.path,
    query: {
      ...request.query,
      ...(pinned && context.pinnedSnapshotId ? { snapshot: context.pinnedSnapshotId } : {}),
      mode: context.requestedMode.toLowerCase(),
    },
    body: request.body ?? null,
    mode: meta.dataMode,
    snapshotId: meta.snapshotId,
    contentSha256: meta.contentSha256,
    boundaryVersion: meta.boundaryVersion,
    receivedByBrowserAt: meta.clientReceivedAt,
    serverRequestId: meta.serverRequestId,
  };
}

/** How the snapshot was resolved: the detail request (pinned) and the list (when asked for). */
function snapshotResponses(
  raw: Pick<RawEvidenceSources, 'pinning' | 'snapshots'>,
  context: RequestContext,
): FetchedResponse[] {
  const { pinning } = raw;
  return [
    ...(raw.snapshots
      ? [
          fetchedFrom(
            'snapshots',
            raw.snapshots,
            { method: 'GET', path: '/api/v1/snapshots' },
            context,
            false,
          ),
        ]
      : []),
    ...(pinning.status === 'PINNED'
      ? [
          fetchedFrom(
            `snapshot-detail:${pinning.pin.snapshotId}`,
            pinning.detail,
            { method: 'GET', path: `/api/v1/snapshots/${pinning.pin.snapshotId}` },
            context,
            false,
          ),
        ]
      : []),
  ];
}

/** The supporting responses both kinds of record share. Failed ones are absent (and listed as gaps). */
function supportingResponses(
  raw: Pick<RawEvidenceSources, 'catalog' | 'datasets' | 'coverage'>,
  context: RequestContext,
): FetchedResponse[] {
  return [
    ...(raw.catalog
      ? [
          fetchedFrom(
            'indicator-catalog',
            raw.catalog,
            { method: 'GET', path: '/api/v1/indicators' },
            context,
          ),
        ]
      : []),
    ...(raw.datasets
      ? [fetchedFrom('datasets', raw.datasets, { method: 'GET', path: '/api/v1/datasets' }, context)]
      : []),
    ...(raw.coverage
      ? [
          fetchedFrom(
            'indicator-coverage',
            raw.coverage,
            { method: 'GET', path: '/api/v1/indicators/coverage' },
            context,
          ),
        ]
      : []),
  ];
}

export function fetchedForRegions(raw: RawEvidenceSources): FetchedResponse[] {
  const context = contextOf(raw);
  return [
    ...snapshotResponses(raw, context),
    ...raw.profiles.map((envelope) =>
      fetchedFrom(
        `region-detail:${envelope.data.region.regionId}`,
        envelope,
        { method: 'GET', path: `/api/v1/regions/${envelope.data.region.regionId}` },
        context,
      ),
    ),
    ...supportingResponses(raw, context),
  ];
}

export function fetchedForComposite(query: LabEvidenceQuery, raw: RawCompositeSources): FetchedResponse[] {
  const context = contextOf(raw);
  return [
    ...snapshotResponses(raw, context),
    fetchedFrom(
      'composite-query',
      raw.composite,
      {
        method: 'POST',
        path: '/api/v1/indicators/composite-query',
        body: { weights: query.weights, filter_province_id: query.provinceId ?? null },
      },
      context,
    ),
    ...(raw.presets
      ? [
          fetchedFrom(
            'composite-presets',
            raw.presets,
            { method: 'GET', path: '/api/v1/indicators/composite-presets' },
            context,
          ),
        ]
      : []),
    ...(raw.regions
      ? [
          fetchedFrom(
            'region-registry',
            raw.regions,
            { method: 'GET', path: '/api/v1/regions', query: { level: 'kabupaten_kota' } },
            context,
          ),
        ]
      : []),
    ...Object.entries(raw.indicatorValues ?? {}).flatMap(([indicatorId, envelope]) =>
      envelope
        ? [
            fetchedFrom(
              `indicator-values:${indicatorId}`,
              envelope,
              { method: 'GET', path: `/api/v1/indicators/${indicatorId}/values` },
              context,
            ),
          ]
        : [],
    ),
    ...supportingResponses(raw, context),
  ];
}
