import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page, Route } from '@playwright/test';
import {
  compositeResponse,
  coverageResponse,
  presetsResponse,
  valuesResponse,
  type CapturedCatalog,
  type CapturedComposite,
} from '../../src/test/labContractMock';
import { mockDataHub } from './dataHubMocks';

/**
 * MOCKED LIVE Lab Prioritas for browser tests: DEMO comes from the captured DEMO responses
 * (dataHubMocks), LIVE from the guide v2 contract simulated over the captured LIVE data
 * (src/test/labContractMock.ts). Not the deployed API: live-api.spec.ts is the real check.
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
  'x-data-fallback': 'NONE',
};

/** `v2`: the guide's contract; `v1`: the composite the deployed API returned on 2026-10-22; `error`: HTTP 500. */
export type CompositeKind = 'v2' | 'v1' | 'error';

export interface LabMock {
  readonly compositeRequests: { weights: Record<string, number>; filter_province_id: string | null }[];
  composite: CompositeKind;
}

/** The 514 LIVE region ids, named from the captured composite where it has them. */
function registry(composite: CapturedComposite) {
  const { region_ids: ids } = live('registry_ids') as { region_ids: string[] };
  const names = new Map(composite.data.regions.map((region) => [region.region_id, region.region_name]));
  return {
    status: 'success',
    meta: {
      snapshot_id: '2026.10.0-official-live',
      mode: 'LIVE',
      boundary_version: null,
      total_count: ids.length,
    },
    data: ids.map((id) => ({
      region_id: id,
      parent_region_id: id.slice(0, 2),
      province_name: `Provinsi ${id.slice(0, 2)}`,
      level: 'kabupaten',
      name: names.get(id) ?? `Wilayah ${id}`,
      short_name: id,
      codes: { bps: id },
    })),
  };
}

export async function mockLiveLab(page: Page, composite: CompositeKind = 'v2'): Promise<LabMock> {
  await mockDataHub(page); // DEMO, and the fallback for anything not handled below
  const mock: LabMock = { compositeRequests: [], composite };
  const catalog = live('indicators') as CapturedCatalog;
  const captured = live('composite') as CapturedComposite;
  const poverty = live('indicator_values_soc_poverty_rate');

  await page.route('https://api.orangkeren.me/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS' || url.searchParams.get('mode') !== 'live') return route.fallback();
    const path = url.pathname.replace('/api/v1', '');
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, headers: LIVE_HEADERS, body: JSON.stringify(body) });

    if (path === '/snapshots') return json(live('snapshots'));
    if (path === '/indicators') return json(catalog);
    if (path === '/indicators/coverage') return json(coverageResponse(catalog, captured));
    if (path === '/indicators/composite-presets') return json(presetsResponse());
    if (path === '/regions') return json(registry(captured));
    if (path === '/indicators/composite-query') {
      const body = request.postDataJSON() as LabMock['compositeRequests'][number];
      mock.compositeRequests.push(body);
      if (mock.composite === 'error') return json({ detail: 'Internal Server Error' }, 500);
      return json(mock.composite === 'v1' ? captured : compositeResponse(captured, body));
    }
    const values = /^\/indicators\/([^/]+)\/values$/.exec(path);
    if (values?.[1]) {
      const body = valuesResponse(values[1], catalog, captured, poverty);
      return body ? json(body) : json({ detail: 'Not Found' }, 404);
    }
    return route.fulfill({ status: 404, headers: CORS, body: '{}' });
  });
  return mock;
}
