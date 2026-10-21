import type { BoundaryCollectionDTO } from '@/services/api';
import { describeBoundaryReadiness } from './boundaryReadiness';

function collection(overrides: Partial<BoundaryCollectionDTO['geometryStatus']>): BoundaryCollectionDTO {
  return {
    type: 'FeatureCollection',
    features: [],
    requestParams: { format: 'geojson', resolution: 'low' },
    geometryStatus: {
      geometryAvailable: false,
      geometryTypeReturned: 'Point',
      source: 'DEMO_PLACEHOLDER',
      boundaryVersion: 'BIG-Kepmendagri-300.2.2-2430-2025',
      dataMode: 'DEMO',
      note: null,
      canExtrudePolygons: false,
      ...overrides,
    },
  };
}

describe('describeBoundaryReadiness', () => {
  it('says Point-only boundaries are not polygons and keeps the map illustrative', () => {
    const readiness = describeBoundaryReadiness(collection({}));
    expect(readiness.hasPolygons).toBe(false);
    expect(readiness.detail).toMatch(/Point/);
    expect(readiness.detail).toMatch(/bukan poligon/);
    expect(readiness.detail).toMatch(/tetap ilustratif/);
  });

  it('reports polygons only when the adapter says they can be extruded', () => {
    const readiness = describeBoundaryReadiness(
      collection({ geometryAvailable: true, geometryTypeReturned: 'MultiPolygon', canExtrudePolygons: true }),
    );
    expect(readiness.hasPolygons).toBe(true);
    expect(readiness.detail).toMatch(/belum memakainya/);
  });
});
