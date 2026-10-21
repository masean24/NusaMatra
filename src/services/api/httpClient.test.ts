// Adapter test (colocated).

import { describe, expect, it, vi } from 'vitest';
import { DataHubHttpClient, normalizeBaseOrigin } from './httpClient';

describe('DataHubHttpClient & Error Handling', () => {
  it('strips accidental /api/v1 suffix and trailing slashes from baseUrl', () => {
    expect(normalizeBaseOrigin('https://api.orangkeren.me/')).toBe('https://api.orangkeren.me');
    expect(normalizeBaseOrigin('https://api.orangkeren.me/api/v1')).toBe('https://api.orangkeren.me');
    expect(normalizeBaseOrigin('https://api.orangkeren.me/api/v1/')).toBe('https://api.orangkeren.me');
  });

  it('handles HTTP 503 LIVE_UNAVAILABLE with X-Data-Fallback: UNAVAILABLE and never falls back to DEMO', async () => {
    const liveErrorPayload = {
      status: 'error',
      code: 'LIVE_UNAVAILABLE',
      message:
        'LIVE mode is not yet available. LIVE data sources have not been verified and connected. Use mode=demo for the demonstration dataset.',
    };

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(liveErrorPayload), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'X-Data-Fallback': 'UNAVAILABLE',
          'X-Nusamatra-Mode': 'LIVE',
        },
      }),
    );

    const client = new DataHubHttpClient({
      baseUrl: 'https://api.orangkeren.me',
      fetchImpl: mockFetch,
    });

    await expect(
      client.get('/api/v1/regions', { parse: (x) => x }, { dataMode: 'LIVE' }),
    ).rejects.toMatchObject({
      status: 503,
      code: 'LIVE_UNAVAILABLE',
      fallbackHeader: 'UNAVAILABLE',
      serverRequestId: null,
    });
  });

  it('handles HTTP 422 nested detail object from composite_invalid.json', async () => {
    const invalidCompositePayload = {
      detail: {
        status: 'error',
        code: 'WEIGHT_VALIDATION_ERROR',
        message: 'Weights must sum to 10000 basis points, got 9000',
      },
    };

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(invalidCompositePayload), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const client = new DataHubHttpClient({
      baseUrl: 'https://api.orangkeren.me',
      fetchImpl: mockFetch,
    });

    await expect(
      client.post(
        '/api/v1/indicators/composite-query',
        { weights: { soc_poverty_rate: 9000 } },
        { parse: (x) => x },
        { dataMode: 'DEMO' },
      ),
    ).rejects.toMatchObject({ code: 'WEIGHT_SUM_INVALID' });
  });

  it('rejects unexpected HTML proxy error bodies on 200 status', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('<!DOCTYPE html><html><body>Bad Gateway</body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }),
    );

    const client = new DataHubHttpClient({
      baseUrl: 'https://api.orangkeren.me',
      fetchImpl: mockFetch,
    });

    await expect(client.get('/api/v1/health', { parse: (x) => x })).rejects.toMatchObject({
      code: 'NON_JSON_RESPONSE',
    });
  });

  it('maps AbortError to REQUEST_ABORTED', async () => {
    const abortErr = new Error('The operation was aborted.');
    abortErr.name = 'AbortError';

    const mockFetch = vi.fn().mockRejectedValue(abortErr);
    const client = new DataHubHttpClient({
      baseUrl: 'https://api.orangkeren.me',
      fetchImpl: mockFetch,
    });

    await expect(client.get('/api/v1/regions', { parse: (x) => x })).rejects.toMatchObject({
      code: 'REQUEST_ABORTED',
    });
  });

  describe('mode in the URL (HTTP cache isolation)', () => {
    function clientWithFetch() {
      const mockFetch = vi.fn(() =>
        Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })),
      );
      const client = new DataHubHttpClient({ baseUrl: 'https://api.orangkeren.me', fetchImpl: mockFetch });
      const firstCall = () => {
        const [url, init] = mockFetch.mock.calls[0] as unknown as [
          string,
          { headers: Record<string, string> },
        ];
        return { url, headers: init.headers };
      };
      return { client, firstCall };
    }

    it('gives DEMO and LIVE requests different URLs, so the browser cache cannot answer one with the other', async () => {
      const demo = clientWithFetch();
      await demo.client.get(
        '/api/v1/regions',
        { parse: (x) => x },
        { dataMode: 'DEMO', query: { q: 'jabar' } },
      );
      const live = clientWithFetch();
      await live.client.get(
        '/api/v1/regions',
        { parse: (x) => x },
        { dataMode: 'LIVE', query: { q: 'jabar' } },
      );

      expect(demo.firstCall().url).toBe('https://api.orangkeren.me/api/v1/regions?q=jabar&mode=demo');
      expect(live.firstCall().url).toBe('https://api.orangkeren.me/api/v1/regions?q=jabar&mode=live');
      expect(live.firstCall().headers['X-Data-Mode']).toBe('LIVE');
    });

    it('cannot be overridden by the caller query', async () => {
      const { client, firstCall } = clientWithFetch();
      await client.get('/api/v1/health', { parse: (x) => x }, { dataMode: 'LIVE', query: { mode: 'demo' } });
      expect(firstCall().url).toBe('https://api.orangkeren.me/api/v1/health?mode=live');
    });

    it('applies to POST requests as well', async () => {
      const { client, firstCall } = clientWithFetch();
      await client.post('/api/v1/indicators/composite-query', {}, { parse: (x) => x }, { dataMode: 'DEMO' });
      expect(firstCall().url).toContain('?mode=demo');
    });
  });
});
