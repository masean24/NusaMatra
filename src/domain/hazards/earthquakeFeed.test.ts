import { STALE_AFTER_MINUTES, assessEarthquakeFeed, epicentreSymbolSize } from './earthquakeFeed';

const now = new Date('2026-10-22T04:00:00Z');
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
const base = {
  origin: 'BMKG_LIVE' as const,
  lastSuccessAt: minutesAgo(1),
  declaredStale: false,
  cacheTtlSeconds: 60,
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

  it('treats a fresh Data Hub cache of BMKG as official and current, like a live fetch', () => {
    expect(assessEarthquakeFeed({ ...base, origin: 'BMKG_CACHE' })).toMatchObject({
      display: 'OFFICIAL',
      isStale: false,
      reasons: [],
    });
  });

  it('marks data stale when the Data Hub says so, even with a recent timestamp', () => {
    const flagged = assessEarthquakeFeed({ ...base, origin: 'BMKG_CACHE', declaredStale: true });
    expect(flagged).toMatchObject({ display: 'OFFICIAL', isStale: true });
    expect(flagged.reasons[0]).toMatch(/menandai data ini usang/);
  });

  it('marks data stale when its timestamp is old, even if the Data Hub says it is not', () => {
    const old = assessEarthquakeFeed({ ...base, lastSuccessAt: minutesAgo(STALE_AFTER_MINUTES + 20) });
    expect(old).toMatchObject({ display: 'OFFICIAL', isStale: true });
    expect(old.reasons[0]).toMatch(/sekitar 30 menit lalu/);
  });

  it('allows a longer declared cache TTL before calling a timestamp old', () => {
    const lastSuccessAt = minutesAgo(STALE_AFTER_MINUTES + 5);
    expect(assessEarthquakeFeed({ ...base, lastSuccessAt, cacheTtlSeconds: 30 * 60 }).isStale).toBe(false);
    expect(assessEarthquakeFeed({ ...base, lastSuccessAt, cacheTtlSeconds: 60 }).isStale).toBe(true);
  });

  it('judges by the timestamp alone when the Data Hub gives no stale flag', () => {
    expect(assessEarthquakeFeed({ ...base, declaredStale: null }).isStale).toBe(false);
    expect(
      assessEarthquakeFeed({ ...base, declaredStale: null, lastSuccessAt: minutesAgo(60) }).isStale,
    ).toBe(true);
  });

  it('marks undated data and non-NONE fallbacks stale', () => {
    expect(assessEarthquakeFeed({ ...base, fallbackHeader: 'CACHE' }).isStale).toBe(true);
    const undated = assessEarthquakeFeed({ ...base, lastSuccessAt: null });
    expect(undated.isStale).toBe(true);
    expect(undated.ageMinutes).toBeNull();
  });

  it('withholds the DEMO fixture contract (data_origin fixture, X-Data-Fallback DEMO_FIXTURE)', () => {
    expect(assessEarthquakeFeed({ ...base, origin: 'FIXTURE' }).display).toBe('WITHHELD');
    expect(assessEarthquakeFeed({ ...base, fallbackHeader: 'DEMO_FIXTURE' }).display).toBe('WITHHELD');
  });
});

describe('epicentreSymbolSize', () => {
  it('grows with magnitude and is bounded at both ends', () => {
    expect(epicentreSymbolSize(5)).toBeGreaterThan(epicentreSymbolSize(3));
    expect(epicentreSymbolSize(-1)).toBe(epicentreSymbolSize(2));
    expect(epicentreSymbolSize(12)).toBe(epicentreSymbolSize(8));
  });
});
