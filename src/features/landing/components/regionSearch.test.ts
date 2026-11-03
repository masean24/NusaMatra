import { regionMatchingQuery } from './regionSearch';

const region = (displayName: string) => ({ displayName });
const kabBandung = region('Kabupaten Bandung');
const kotaBandung = region('Kota Bandung');
const cianjur = region('Kabupaten Cianjur');

describe('regionMatchingQuery', () => {
  it('takes the full name typed, whatever the case and spacing', () => {
    expect(regionMatchingQuery('  kota   bandung ', [kabBandung, kotaBandung])).toBe(kotaBandung);
  });

  it('takes the only region with the name typed without "Kabupaten"/"Kota"', () => {
    expect(regionMatchingQuery('cianjur', [cianjur, kabBandung])).toBe(cianjur);
    expect(regionMatchingQuery('Kab. Cianjur', [cianjur, kabBandung])).toBe(cianjur);
  });

  it('takes the only region found', () => {
    expect(regionMatchingQuery('cianj', [cianjur])).toBe(cianjur);
  });

  it('does not guess between regions sharing a name, or among several partial matches', () => {
    expect(regionMatchingQuery('Bandung', [kabBandung, kotaBandung])).toBeNull();
    expect(regionMatchingQuery('Band', [kabBandung, kotaBandung])).toBeNull();
    expect(regionMatchingQuery('Bandung', [])).toBeNull();
  });
});
