import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page, Route } from '@playwright/test';

/**
 * A LIVE Data Hub for browser tests, from the LIVE responses captured on 2026-10-21/22
 * (src/services/api/__fixtures__/live). The earthquake feed gets the provenance metadata of the
 * Data Hub contract (backend e672231): data_origin, last_success_at, is_stale, cache_ttl_seconds.
 * Only three BIG polygons were captured (Kota Bukittinggi, Kota Padang Panjang, Kota Magelang).
 * This proves the frontend, not the deployed API: live-api.spec.ts covers that.
 */
const FIXTURES = fileURLToPath(new URL('../../src/services/api/__fixtures__/live/', import.meta.url));
const live = (name: string): unknown => JSON.parse(readFileSync(`${FIXTURES}${name}.json`, 'utf8'));

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-expose-headers': '*',
};
const LIVE_HEADERS = {
  ...CORS,
  'content-type': 'application/json',
  'x-nusamatra-mode': 'LIVE',
  'x-nusamatra-snapshot': '2026.10.0-official-live',
  'x-data-fallback': 'NONE',
};

interface Feature {
  readonly properties: Record<string, string>;
  readonly geometry: { readonly coordinates: [number, number][][] };
}
interface Envelope {
  readonly meta: Record<string, unknown>;
  readonly data: { readonly features: Feature[] };
}

/** The regions list for the captured polygons, in the list's wire shape. */
function regionsFromBoundaries(): unknown {
  const boundaries = live('boundaries_sample') as Envelope;
  const data = boundaries.data.features.map(({ properties, geometry }) => {
    const ring = geometry.coordinates[0] ?? [];
    const lons = ring.map(([lon]) => lon);
    const lats = ring.map(([, lat]) => lat);
    const bbox = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
    return {
      region_id: properties['region_id'],
      parent_region_id: properties['parent_region_id'],
      province_name: properties['province_name'],
      level: 'kota',
      name: properties['name'],
      short_name: properties['short_name'],
      codes: { kemendagri: properties['kemendagri_code'], bps: properties['bps_code'] },
      island_group: null,
      area_km2: null,
      anchor_point: {
        lng: ((bbox[0] ?? 0) + (bbox[2] ?? 0)) / 2,
        lat: ((bbox[1] ?? 0) + (bbox[3] ?? 0)) / 2,
      },
      bbox,
    };
  });
  return { status: 'success', meta: { ...boundaries.meta, total_count: data.length }, data };
}

export type FeedKind = 'live' | 'cache' | 'stale' | 'fixture' | 'outage';

export interface Mock {
  readonly earthquakeRequests: string[];
  feed: FeedKind;
}

export async function mockLiveDataHub(page: Page, feed: FeedKind = 'cache'): Promise<Mock> {
  const mock: Mock = { earthquakeRequests: [], feed };
  await page.route('https://api.orangkeren.me/**', async (route: Route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    const json = (body: unknown, status = 200, headers: Record<string, string> = LIVE_HEADERS) =>
      route.fulfill({ status, headers, body: JSON.stringify(body) });

    if (path === '/earthquakes/geojson') {
      mock.earthquakeRequests.push(url.search);
      return answerEarthquakes(mock.feed, json);
    }
    if (url.searchParams.get('mode') !== 'live')
      return route.fulfill({ status: 404, headers: CORS, body: '{}' });
    if (path === '/snapshots') return json(live('snapshots'));
    if (path === '/indicators') return json(live('indicators'));
    if (path === '/boundaries/kabupaten') return json(live('boundaries_sample'));
    if (path === '/regions') return json(regionsFromBoundaries());
    return route.fulfill({ status: 404, headers: CORS, body: '{}' });
  });
  return mock;
}

function answerEarthquakes(
  kind: FeedKind,
  json: (body: unknown, status?: number, headers?: Record<string, string>) => Promise<void>,
): Promise<void> {
  if (kind === 'outage') {
    return json(
      { status: 'error', code: 'UPSTREAM_UNAVAILABLE', message: 'BMKG tidak dapat dihubungi' },
      503,
    );
  }
  const body = live('earthquakes_geojson') as { metadata: Record<string, unknown> };
  const recent = new Date(Date.now() - 20_000).toISOString();
  Object.assign(body.metadata, {
    data_origin: { live: 'bmkg_live', cache: 'bmkg_cache', stale: 'bmkg_cache', fixture: 'fixture' }[kind],
    last_success_at: kind === 'stale' ? new Date(Date.now() - 45 * 60_000).toISOString() : recent,
    is_stale: kind === 'stale',
    cache_ttl_seconds: 60,
  });
  const headers = { ...LIVE_HEADERS, 'cache-control': 'no-cache, must-revalidate, max-age=0' };
  if (kind === 'fixture') headers['x-data-fallback'] = 'DEMO_FIXTURE';
  return json(body, 200, headers);
}
