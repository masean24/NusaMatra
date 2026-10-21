import { STALE_AFTER_MINUTES, assessEarthquakeFeed, epicentreSymbolSize } from './earthquakeFeed';

const now = new Date('2026-10-22T04:00:00Z');
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
const base = {
  origin: 'BMKG_LIVE' as const,
  cachedAt: minutesAgo(1),
  fallbackHeader: 'NONE',
  now,
  allowUnverifiedPreview: false,
};

describe('assessEarthquakeFeed', () => {
  it('shows declared, fresh BMKG data as official', () => {
    expect(assessEarthquakeFeed(base)).toMatchObject({ display: 'OFFICIAL', isStale: false, reasons: [] });
  });

  it('withholds what the Data Hub does not declare, as it does today, unless a preview is opted into', () => {
    const today = assessEarthquakeFeed({ ...base, origin: 'UNDECLARED' });
    expect(today.display).toBe('WITHHELD');
    expect(today.reasons[0]).toMatch(/belum menyatakan apakah data ini langsung dari BMKG/);
    expect(
      assessEarthquakeFeed({ ...base, origin: 'UNDECLARED', allowUnverifiedPreview: true }).display,
    ).toBe('PREVIEW_UNVERIFIED');
  });

  it('never shows a declared fixture, even in a preview, nor a fixture fallback header', () => {
    expect(assessEarthquakeFeed({ ...base, origin: 'FIXTURE', allowUnverifiedPreview: true }).display).toBe(
      'WITHHELD',
    );
    expect(assessEarthquakeFeed({ ...base, fallbackHeader: 'LOCAL_FIXTURE' }).display).toBe('WITHHELD');
  });

  it('marks old, cached or undated data stale and says why', () => {
    const old = assessEarthquakeFeed({ ...base, cachedAt: minutesAgo(STALE_AFTER_MINUTES + 20) });
    expect(old).toMatchObject({ display: 'OFFICIAL', isStale: true });
    expect(old.reasons[0]).toMatch(/sekitar 30 menit lalu/);
    expect(assessEarthquakeFeed({ ...base, origin: 'BMKG_CACHE' }).isStale).toBe(true);
    expect(assessEarthquakeFeed({ ...base, fallbackHeader: 'CACHE' }).isStale).toBe(true);
    const undated = assessEarthquakeFeed({ ...base, cachedAt: null });
    expect(undated.isStale).toBe(true);
    expect(undated.ageMinutes).toBeNull();
  });
});

describe('epicentreSymbolSize', () => {
  it('grows with magnitude and is bounded at both ends', () => {
    expect(epicentreSymbolSize(5)).toBeGreaterThan(epicentreSymbolSize(3));
    expect(epicentreSymbolSize(-1)).toBe(epicentreSymbolSize(2));
    expect(epicentreSymbolSize(12)).toBe(epicentreSymbolSize(8));
  });
});
