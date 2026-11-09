import type { EarthquakeEventDTO, EarthquakeFeedDTO } from '@/services/api';
import { latestQuakeForHero, quakeMagnitude, quakeTimeAgo } from './latestQuake';

const NOW = new Date('2026-11-09T12:00:00Z');

const event = (id: string, occurredAt: string, longitude = 110.4, latitude = -7.8): EarthquakeEventDTO => ({
  id,
  occurredAt,
  localDate: null,
  localTime: null,
  magnitude: 5.1,
  depthKm: 10,
  longitude,
  latitude,
  area: `Gempa ${id}`,
  potency: null,
  felt: null,
  shakemapUrl: null,
  source: 'BMKG',
});

const feed = (
  events: EarthquakeEventDTO[],
  overrides: Partial<EarthquakeFeedDTO> = {},
): EarthquakeFeedDTO => ({
  events,
  origin: 'BMKG_LIVE',
  lastSuccessAt: '2026-11-09T11:58:00Z',
  declaredStale: false,
  cacheTtlSeconds: 60,
  sourcePortal: null,
  serverMode: 'LIVE',
  dataFallback: null,
  rejectedCount: 0,
  receivedAt: '2026-11-09T12:00:00Z',
  ...overrides,
});

describe('the newest earthquake on the hero map', () => {
  it('picks the newest event, whatever order the feed lists them in, and places it in the zone', () => {
    const quake = latestQuakeForHero(
      feed([
        event('old', '2026-11-09T08:00:00Z'),
        event('new', '2026-11-09T10:30:00Z'),
        event('mid', '2026-11-09T09:00:00Z'),
      ]),
      NOW,
      false,
    );
    expect(quake?.event.id).toBe('new');
    expect(quake?.u).toBeGreaterThan(0);
    expect(quake?.u).toBeLessThan(1);
    expect(quake?.v).toBeGreaterThan(0);
    expect(quake?.v).toBeLessThan(1);
  });

  it('places west to the left of east and north above south', () => {
    const at = (lon: number, lat: number) =>
      latestQuakeForHero(feed([event('e', '2026-11-09T10:00:00Z', lon, lat)]), NOW, false);
    const aceh = at(95.5, 5.0);
    const papua = at(138.0, -4.0);
    expect(aceh && papua && aceh.u < papua.u).toBe(true);
    expect(aceh && papua && aceh.v < papua.v).toBe(true);
  });

  it('shows nothing from a stale, fixture or undeclared feed', () => {
    const events = [event('e', '2026-11-09T10:00:00Z')];
    expect(latestQuakeForHero(feed(events, { declaredStale: true }), NOW, false)).toBeNull();
    expect(
      latestQuakeForHero(feed(events, { lastSuccessAt: '2026-11-09T09:00:00Z' }), NOW, false),
    ).toBeNull();
    expect(latestQuakeForHero(feed(events, { origin: 'FIXTURE' }), NOW, false)).toBeNull();
    // Even with the preview opt-in: the hero shows only the official feed.
    expect(latestQuakeForHero(feed(events, { origin: 'UNDECLARED' }), NOW, true)).toBeNull();
  });

  it('shows nothing when there is no event, or the epicentre falls outside the map', () => {
    expect(latestQuakeForHero(feed([]), NOW, false)).toBeNull();
    expect(latestQuakeForHero(feed([event('far', '2026-11-09T10:00:00Z', 86, -19)]), NOW, false)).toBeNull();
  });

  it('writes the magnitude and how long ago in the page language', () => {
    expect(quakeMagnitude(5.06)).toBe('M 5,1');
    expect(quakeTimeAgo('2026-11-09T11:59:30Z', NOW.getTime())).toBe('Baru saja');
    expect(quakeTimeAgo('2026-11-09T10:00:00Z', NOW.getTime())).toBe('2 jam yang lalu');
  });
});
