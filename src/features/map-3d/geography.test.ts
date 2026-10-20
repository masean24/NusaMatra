import { DEMO_GEO_REGIONS } from '@/data/fixtures/demoGeoRegions';
import {
  DEMO_ILLUSTRATIVE_GEOGRAPHY,
  approximateFeatureCenter,
  lonLatToPlanar,
  planarToLonLat,
  validateAndAdaptGeography,
} from './index';

// Ported from the handoff package (src/tests/geography.test.ts), plus host regression tests.
describe('3D engine geography', () => {
  it('round-trips lon/lat through the planar projection', () => {
    const original = { lon: 106.8456, lat: -6.2088 };
    const planar = lonLatToPlanar(original.lon, original.lat);
    const back = planarToLonLat(planar.x, planar.z);
    expect(back.lon).toBeCloseTo(original.lon, 5);
    expect(back.lat).toBeCloseTo(original.lat, 5);
  });

  it('accepts the explicit DEMO dataset in DEMO mode', () => {
    expect(validateAndAdaptGeography(DEMO_ILLUSTRATIVE_GEOGRAPHY, 'DEMO').features.length).toBeGreaterThan(0);
  });

  it('rejects DEMO data in LIVE mode', () => {
    expect(() => validateAndAdaptGeography(DEMO_ILLUSTRATIVE_GEOGRAPHY, 'LIVE')).toThrow();
  });

  it('rejects LIVE-labelled data in DEMO mode', () => {
    const dataset = structuredClone(DEMO_ILLUSTRATIVE_GEOGRAPHY);
    dataset.metadata.dataMode = 'LIVE';
    dataset.metadata.isAuthoritative = true;
    expect(() => validateAndAdaptGeography(dataset, 'DEMO')).toThrow();
  });

  it('focuses on the real geometry when focus hints are absent', () => {
    const first = DEMO_ILLUSTRATIVE_GEOGRAPHY.features[0];
    if (!first) throw new Error('DEMO geography has no features');
    const feature = structuredClone(first);
    delete feature.properties.focusLon;
    delete feature.properties.focusLat;
    const center = approximateFeatureCenter(feature);
    expect(center.lon).toBeGreaterThan(95);
    expect(center.lon).toBeLessThan(110);
  });

  // Host regression: the handoff version threw a ReferenceError here (variable used before declaration).
  it('returns the DEMO illustration when no dataset is supplied in DEMO mode', () => {
    expect(validateAndAdaptGeography(undefined, 'DEMO')).toBe(DEMO_ILLUSTRATIVE_GEOGRAPHY);
    expect(validateAndAdaptGeography(null, 'DEMO')).toBe(DEMO_ILLUSTRATIVE_GEOGRAPHY);
  });

  it('refuses to run LIVE without a verified dataset', () => {
    expect(() => validateAndAdaptGeography(undefined, 'LIVE')).toThrow(/LIVE/);
  });

  it('keeps the host keyboard list identical to the engine DEMO regions', () => {
    expect(
      DEMO_ILLUSTRATIVE_GEOGRAPHY.features.map(({ properties }) => ({
        regionId: properties.regionId,
        displayName: properties.displayName,
      })),
    ).toEqual(DEMO_GEO_REGIONS);
  });
});
