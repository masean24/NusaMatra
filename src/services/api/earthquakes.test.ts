import { fixtureJson } from '@/test/dataHubFixtures';
import { ApiError } from './apiError';
import { mapEarthquakeFeed } from './earthquakes';
import type { HttpResponseContext } from './httpClient';

const liveContext: HttpResponseContext = {
  status: 200,
  requestId: null,
  dataFallback: 'NONE',
  serverMode: 'LIVE',
  clientReceivedAt: '2026-10-22T04:00:00.000Z',
};

interface WireFeed {
  metadata: Record<string, unknown>;
  features: { id: string; geometry: { coordinates: number[] }; properties: Record<string, unknown> }[];
}
const captured = () => structuredClone(fixtureJson('live/earthquakes_geojson')) as WireFeed;

describe('mapEarthquakeFeed on the captured LIVE feed', () => {
  it('keeps every valid BMKG event with its coordinates in [lon, lat] order, newest first', () => {
    const feed = mapEarthquakeFeed(captured(), liveContext, 'LIVE');
    expect(feed.events).toHaveLength(28);
    expect(feed.rejectedCount).toBe(0);
    const first = feed.events[0];
    expect(first?.id).toBe('bmkg-20261021T115836Z0000--5.40-104.68');
    expect([first?.longitude, first?.latitude]).toEqual([104.68, -5.4]);
    const times = feed.events.map((event) => Date.parse(event.occurredAt));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it('drops the Data Hub’s own judgements (severity, tsunami flag, colour, pixel radius)', () => {
    const [first] = mapEarthquakeFeed(captured(), liveContext, 'LIVE').events;
    expect(Object.keys(first ?? {})).not.toEqual(
      expect.arrayContaining(['severity', 'tsunamiRisk', 'visualColor', 'visualRadiusPx']),
    );
  });

  it('reports the origin as undeclared, because the feed does not say live, cache or fixture', () => {
    const feed = mapEarthquakeFeed(captured(), liveContext, 'LIVE');
    expect(feed.origin).toBe('UNDECLARED');
    expect(feed.lastSuccessAt).toBe('2026-10-22T03:52:11.190888+00:00');
    expect(feed.declaredStale).toBeNull();
    expect(feed.dataFallback).toBe('NONE');
  });

  it('reads the provenance contract: origin, last successful fetch, stale flag and cache TTL', () => {
    const feed = captured();
    Object.assign(feed.metadata, {
      data_origin: 'bmkg_cache',
      last_success_at: '2026-10-22T03:59:30+00:00',
      is_stale: false,
      cache_ttl_seconds: 60,
    });
    expect(mapEarthquakeFeed(feed, liveContext, 'LIVE')).toMatchObject({
      origin: 'BMKG_CACHE',
      lastSuccessAt: '2026-10-22T03:59:30+00:00',
      declaredStale: false,
      cacheTtlSeconds: 60,
    });
    feed.metadata['data_origin'] = 'bmkg_live';
    expect(mapEarthquakeFeed(feed, liveContext, 'LIVE').origin).toBe('BMKG_LIVE');
    feed.metadata['data_origin'] = 'fixture';
    expect(mapEarthquakeFeed(feed, liveContext, 'LIVE').origin).toBe('FIXTURE');
  });

  it('treats unknown origins, non-boolean stale flags and bad timestamps as not stated', () => {
    const feed = captured();
    Object.assign(feed.metadata, {
      data_origin: 'live',
      is_stale: 'false',
      last_success_at: 'baru saja',
      cached_at: undefined,
      cache_ttl_seconds: -1,
    });
    expect(mapEarthquakeFeed(feed, liveContext, 'LIVE')).toMatchObject({
      origin: 'UNDECLARED',
      declaredStale: null,
      lastSuccessAt: null,
      cacheTtlSeconds: null,
    });
  });

  it('rejects, never repairs, events with bad positions, times or magnitudes, and duplicates', () => {
    const feed = captured();
    const [a, b, c, d] = feed.features;
    if (!a || !b || !c || !d) throw new Error('fixture too small');
    a.geometry.coordinates = [-5.4, 104.68]; // swapped
    b.properties['datetime'] = 'kemarin';
    c.properties['magnitude'] = '5.1';
    feed.features.push(structuredClone(d));
    const mapped = mapEarthquakeFeed(feed, liveContext, 'LIVE');
    expect(mapped.rejectedCount).toBe(4);
    expect(mapped.events).toHaveLength(25);
  });

  it('accepts a shakemap only from BMKG over HTTPS', () => {
    const feed = captured();
    const [a, b] = feed.features;
    if (!a || !b) throw new Error('fixture too small');
    a.properties['shakemap_url'] = 'javascript:alert(1)';
    b.properties['shakemap_url'] = 'https://evil.example/x.jpg';
    const mapped = mapEarthquakeFeed(feed, liveContext, 'LIVE');
    const byId = new Map(mapped.events.map((event) => [event.id, event]));
    expect(byId.get(a.id)?.shakemapUrl).toBeNull();
    expect(byId.get(b.id)?.shakemapUrl).toBeNull();
  });

  it('refuses a response whose mode header does not match the request', () => {
    expect(() => mapEarthquakeFeed(captured(), { ...liveContext, serverMode: 'DEMO' }, 'LIVE')).toThrow(
      ApiError,
    );
  });
});
