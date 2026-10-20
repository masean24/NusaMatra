import { describe, it, expect } from 'vitest';
import { lonLatToPlanar, planarToLonLat, DEMO_ILLUSTRATIVE_GEOGRAPHY, validateAndAdaptGeography, approximateFeatureCenter } from '../index';

describe('Nusa Matra geography', () => {
  it('round-trips lon/lat', () => {
    const original = { lon: 106.8456, lat: -6.2088 };
    const p = lonLatToPlanar(original.lon, original.lat);
    const back = planarToLonLat(p.x, p.z);
    expect(back.lon).toBeCloseTo(original.lon, 5);
    expect(back.lat).toBeCloseTo(original.lat, 5);
  });
  it('allows explicit DEMO input in DEMO mode', () => {
    expect(validateAndAdaptGeography(DEMO_ILLUSTRATIVE_GEOGRAPHY, 'DEMO').features.length).toBeGreaterThan(0);
  });
  it('rejects DEMO data in LIVE mode', () => {
    expect(() => validateAndAdaptGeography(DEMO_ILLUSTRATIVE_GEOGRAPHY, 'LIVE')).toThrow();
  });
  it('rejects mismatched LIVE data in DEMO mode', () => {
    const dataset = structuredClone(DEMO_ILLUSTRATIVE_GEOGRAPHY);
    dataset.metadata.dataMode = 'LIVE';
    dataset.metadata.isAuthoritative = true;
    expect(() => validateAndAdaptGeography(dataset, 'DEMO')).toThrow();
  });
  it('focuses on actual provided geometry if focus props are absent', () => {
    const feature = structuredClone(DEMO_ILLUSTRATIVE_GEOGRAPHY.features[0]);
    delete feature.properties.focusLon;
    delete feature.properties.focusLat;
    const center = approximateFeatureCenter(feature);
    expect(center.lon).toBeGreaterThan(95);
    expect(center.lon).toBeLessThan(110);
  });
});
