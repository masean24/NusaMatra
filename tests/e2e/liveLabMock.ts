import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page, Route } from '@playwright/test';
import {
  buildPool,
  compositeResponse,
  presetsResponse,
  valuesResponse,
  type CapturedCatalog,
  type CapturedComposite,
  type CapturedRegion,
  type Replay,
} from '../../src/test/labContractMock';
import { mockDataHub } from './dataHubMocks';

/**
 * MOCKED LIVE Lab Prioritas for browser tests (contract v2.1): DEMO comes from the captured DEMO responses
 * (dataHubMocks). LIVE uses the responses CAPTURED FROM PRODUCTION on 2026-10-23
 * (src/services/api/__fixtures__/live-v2.1) for the catalog, coverage, presets, indicator values and the
 * Jateng / Sumut / national composites, replayed untouched; any other weight set is answered by the
 * labContractMock simulator. Not the deployed API: live-api.spec.ts is the real check.
 */
const V21 = fileURLToPath(new URL('../../src/services/api/__fixtures__/live-v2.1/', import.meta.url));
const V1 = fileURLToPath(new URL('../../src/services/api/__fixtures__/live/', import.meta.url));
const v21 = (name: string): unknown => JSON.parse(readFileSync(`${V21}${name}.json`, 'utf8'));
const v1 = (name: string): unknown => JSON.parse(readFileSync(`${V1}${name}.json`, 'utf8'));

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

/**
 * `v21`: contract v2.1; `v1`: the composite the deployed API returned on 2026-10-22 (no score_direction, no
 * region weights); `unrankable`: always the captured national education 3T composite, which the Data Hub
 * returns although the preset is rankable = false; `error`: HTTP 500.
 */
export type CompositeKind = 'v21' | 'v1' | 'unrankable' | 'error';

export interface LabMock {
  readonly compositeRequests: { weights: Record<string, number>; filter_province_id: string | null }[];
  composite: CompositeKind;
}

type Capture = CapturedComposite & { data: { weights_basis_points: Record<string, number> } };

function replays(): Replay[] {
  return [
    ['composite_jateng_kemiskinan_stunting', '33'],
    ['composite_sumut_bencana', '12'],
    ['composite_national_kemiskinan_stunting', null],
  ].map(([name, province]) => {
    const response = v21(name ?? '') as Capture;
    return {
      body: { weights: response.data.weights_basis_points, filter_province_id: province ?? null },
      response,
    };
  });
}

/** The 514 LIVE region ids, named from the captured composites where they have them. */
function registry(pool: readonly CapturedRegion[]) {
  const { region_ids: ids } = v1('registry_ids') as { region_ids: string[] };
  const names = new Map(pool.map((region) => [region.region_id, region.region_name]));
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

export async function mockLiveLab(page: Page, composite: CompositeKind = 'v21'): Promise<LabMock> {
  await mockDataHub(page); // DEMO, and the fallback for anything not handled below
  const mock: LabMock = { compositeRequests: [], composite };
  const catalog = v21('indicators_catalog') as CapturedCatalog;
  const pool = buildPool([
    v21('composite_national_kemiskinan_stunting') as CapturedComposite,
    v21('composite_national_hdi') as CapturedComposite,
    v21('composite_national_pendidikan_3t') as CapturedComposite,
  ]);
  const recorded = replays();
  const capturedValues = {
    soc_poverty_rate: v21('values_soc_poverty_rate'),
    soc_hdi: v21('values_soc_hdi'),
    inf_safe_water_pct: v21('values_inf_safe_water_pct'),
  };

  await page.route('https://api.nusamatra.site/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS' || url.searchParams.get('mode') !== 'live') return route.fallback();
    const path = url.pathname.replace('/api/v1', '');
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, headers: LIVE_HEADERS, body: JSON.stringify(body) });

    if (path === '/snapshots') return json(v1('snapshots'));
    if (path === '/indicators') return json(catalog);
    if (path === '/indicators/coverage') return json(v21('indicators_coverage'));
    if (path === '/indicators/composite-presets') {
      return json(presetsResponse(v21('composite_presets') as { data: unknown[] }));
    }
    if (path === '/regions') return json(registry(pool));
    if (path === '/indicators/composite-query') {
      const body = request.postDataJSON() as LabMock['compositeRequests'][number];
      mock.compositeRequests.push(body);
      if (mock.composite === 'error') return json({ detail: 'Internal Server Error' }, 500);
      if (mock.composite === 'v1') return json(v1('composite'));
      if (mock.composite === 'unrankable') return json(v21('composite_national_pendidikan_3t'));
      return json(compositeResponse(pool, body, recorded));
    }
    const values = /^\/indicators\/([^/]+)\/values$/.exec(path);
    if (values?.[1]) {
      const body = valuesResponse(values[1], catalog, pool, capturedValues);
      return body ? json(body) : json({ detail: 'Not Found' }, 404);
    }
    return route.fulfill({ status: 404, headers: CORS, body: '{}' });
  });
  return mock;
}
