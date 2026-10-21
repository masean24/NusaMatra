import type { BoundaryCollectionDTO } from '@/services/api';

/** Region ids are BPS kabupaten/kota codes; the Data Hub's region list and boundaries share them. */
const CODE_SYSTEM = 'BPS';

/**
 * Turns the Data Hub's LIVE boundary collection into the dataset the 3D engine validates.
 * Returns `null` unless the adapter confirmed official polygons for the LIVE snapshot, so a
 * point-only or DEMO collection can never reach the map as administrative geometry.
 */
export function buildLiveGeography(boundaries: BoundaryCollectionDTO, snapshotId: string): unknown {
  const { geometryStatus, features } = boundaries;
  if (geometryStatus.dataMode !== 'LIVE' || !geometryStatus.canExtrudePolygons) return null;
  if (geometryStatus.boundaryVersion === null) return null;

  return {
    type: 'FeatureCollection',
    metadata: {
      datasetId: 'big_batas_2026',
      boundaryEditionId: geometryStatus.boundaryVersion,
      codeSystem: CODE_SYSTEM,
      dataMode: 'LIVE',
      isAuthoritative: true,
      provenanceNote: [geometryStatus.source, geometryStatus.note].filter(Boolean).join('. '),
      snapshotId,
    },
    features: features.map((feature) => ({
      type: 'Feature',
      properties: {
        regionId: feature.properties.regionId,
        displayName: feature.properties.name,
        ...(feature.properties.bpsCode ? { regionCode: feature.properties.bpsCode } : {}),
      },
      geometry: feature.geometry,
    })),
  };
}
