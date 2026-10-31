import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page, Route } from '@playwright/test';

/**
 * Answers the Data Hub from the responses captured on 2026-10-20 (src/services/api/__fixtures__), so
 * browser tests neither depend on the live API nor change what it returns. LIVE requests get the
 * captured 503. The mocked 503 carries CORS headers, which the real API's does not (see the
 * integration notes), so this exercises the adapter's HTTP 503 path inside a real browser.
 */
const FIXTURES = fileURLToPath(new URL('../../src/services/api/__fixtures__/', import.meta.url));

function fixture(name: string): string {
  return readFileSync(`${FIXTURES}${name}.json`, 'utf8');
}

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-expose-headers': '*',
};

interface NamedRegion {
  readonly name: string;
}

export interface DataHubMock {
  /** Bodies of every composite query the page sent. */
  readonly compositeRequests: Record<string, unknown>[];
  /** Every request URL, in order. */
  readonly requests: string[];
}

export async function mockDataHub(page: Page): Promise<DataHubMock> {
  const mock: DataHubMock = { compositeRequests: [], requests: [] };

  await page.route('https://api.nusamatra.site/**', async (route: Route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    const url = new URL(request.url());
    mock.requests.push(url.pathname + url.search);
    const json = (body: string, status = 200, extra: Record<string, string> = {}) =>
      route.fulfill({
        status,
        body,
        headers: { ...CORS_HEADERS, 'content-type': 'application/json', ...extra },
      });

    if (url.searchParams.get('mode') === 'live') {
      await json(fixture('regions_live'), 503, {
        'x-data-fallback': 'UNAVAILABLE',
        'x-nusamatra-mode': 'LIVE',
      });
      return;
    }

    const path = url.pathname.replace('/api/v1', '');
    if (path === '/snapshots') return json(fixture('snapshots'));
    if (path === '/indicators') return json(fixture('indicators'));
    if (path === '/indicators/composite-query') {
      mock.compositeRequests.push(request.postDataJSON() as Record<string, unknown>);
      return json(fixture('composite_valid'));
    }
    if (path.startsWith('/indicators/')) return json(fixture('indicator_values'));
    if (path === '/boundaries/kabupaten') return json(fixture('boundaries_kabupaten'));
    if (path === '/regions') {
      const query = (url.searchParams.get('q') ?? '').toLowerCase();
      const all = JSON.parse(fixture('regions_nonempty')) as { meta: object; data: NamedRegion[] };
      const data = all.data.filter((region) => region.name.toLowerCase().includes(query));
      return json(JSON.stringify({ ...all, meta: { ...all.meta, total_count: data.length }, data }));
    }
    if (path.startsWith('/regions/')) return json(fixture('region_detail'));
    return route.fulfill({ status: 404, headers: CORS_HEADERS, body: '{}' });
  });

  return mock;
}
