import { fixtureJson } from '@/test/dataHubFixtures';
import { mapBoundariesData, mapEnvelope, type BoundaryCollectionDTO } from '@/services/api';
import { buildLiveGeography } from './liveGeography';

const context = {
  status: 200,
  requestId: null,
  dataFallback: 'NONE',
  serverMode: 'LIVE',
  clientReceivedAt: '2026-10-22T00:00:00.000Z',
} as const;

function liveBoundaries(): { boundaries: BoundaryCollectionDTO; snapshotId: string } {
  const envelope = mapEnvelope(fixtureJson('live/boundaries_sample'), 'LIVE', context, (data, meta) =>
    mapBoundariesData(data, meta),
  );
  return { boundaries: envelope.data, snapshotId: envelope.meta.snapshotId };
}

describe('buildLiveGeography (captured LIVE boundaries)', () => {
  it('accepts the official BIG polygons the Data Hub labels REAL_OFFICIAL', () => {
    const { boundaries } = liveBoundaries();
    expect(boundaries.geometryStatus.dataMode).toBe('LIVE');
    expect(boundaries.geometryStatus.canExtrudePolygons).toBe(true);
    expect(boundaries.features.map((feature) => feature.properties.regionId)).toEqual([
      '3371',
      '1375',
      '1374',
    ]);
  });

  it('keeps region ids, names and BPS codes of the registry and tags the dataset as authoritative LIVE', () => {
    const { boundaries, snapshotId } = liveBoundaries();
    const geography = buildLiveGeography(boundaries, snapshotId) as {
      metadata: Record<string, unknown>;
      features: { properties: { regionId: string; displayName: string; regionCode?: string } }[];
    };
    expect(geography.metadata).toMatchObject({
      dataMode: 'LIVE',
      isAuthoritative: true,
      snapshotId: '2026.10.0-official-live',
      boundaryEditionId: 'BIG-Kepmendagri-300.2.2-2430-2025',
      codeSystem: 'BPS',
    });
    expect(geography.features[0]?.properties).toEqual({
      regionId: '3371',
      displayName: expect.stringMatching(/^Kota /) as string,
      regionCode: '3371',
    });
  });

  it('refuses a collection that is not official LIVE polygons', () => {
    const { boundaries, snapshotId } = liveBoundaries();
    const demo: BoundaryCollectionDTO = {
      ...boundaries,
      geometryStatus: { ...boundaries.geometryStatus, dataMode: 'DEMO' },
    };
    const pointOnly: BoundaryCollectionDTO = {
      ...boundaries,
      geometryStatus: { ...boundaries.geometryStatus, canExtrudePolygons: false },
    };
    const unversioned: BoundaryCollectionDTO = {
      ...boundaries,
      geometryStatus: { ...boundaries.geometryStatus, boundaryVersion: null },
    };
    expect(buildLiveGeography(demo, snapshotId)).toBeNull();
    expect(buildLiveGeography(pointOnly, snapshotId)).toBeNull();
    expect(buildLiveGeography(unversioned, snapshotId)).toBeNull();
  });
});
