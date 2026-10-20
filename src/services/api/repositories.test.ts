// Adapter test (colocated).

import { describe, expect, it, vi } from 'vitest';
import { DataHubHttpClient } from './httpClient';
import { DataHubCacheKeys, NusaMatraDataHubRepository } from './repositories';

describe('NusaMatraDataHubRepository', () => {
  it('constructs isolated cache keys for DEMO vs LIVE and canonicalizes composite weights', () => {
    const demoKey = DataHubCacheKeys.regionDetail('DEMO', '3201');
    const liveKey = DataHubCacheKeys.regionDetail('LIVE', '3201');
    expect(demoKey).not.toEqual(liveKey);

    const compKeyA = DataHubCacheKeys.compositePreview('DEMO', [
      { indicatorId: 'soc_poverty_rate', basisPoints: 6000 },
      { indicatorId: 'dis_multihazard_index', basisPoints: 4000 },
    ]);
    const compKeyB = DataHubCacheKeys.compositePreview('DEMO', [
      { indicatorId: 'dis_multihazard_index', basisPoints: 4000 },
      { indicatorId: 'soc_poverty_rate', basisPoints: 6000 },
    ]);
    expect(compKeyA).toEqual(compKeyB);
  });

  it('rejects invalid composite weights client-side before invoking network fetch', async () => {
    const mockFetch = vi.fn();
    const client = new DataHubHttpClient({
      baseUrl: 'https://api.orangkeren.me',
      fetchImpl: mockFetch,
    });
    const repo = new NusaMatraDataHubRepository(client);

    await expect(
      repo.runExploratoryCompositeQuery({
        dataMode: 'DEMO',
        criteria: [{ indicatorId: 'soc_poverty_rate', basisPoints: 8500 }],
      }),
    ).rejects.toMatchObject({ code: 'WEIGHT_SUM_INVALID' });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('blocks mode mismatch if LIVE request receives a DEMO envelope', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'success',
          meta: {
            snapshot_id: '2026.10.0-wia-demo',
            mode: 'DEMO',
            total_count: 0,
          },
          data: [],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const client = new DataHubHttpClient({
      baseUrl: 'https://api.orangkeren.me',
      fetchImpl: mockFetch,
    });
    const repo = new NusaMatraDataHubRepository(client);

    await expect(repo.searchRegions({ dataMode: 'LIVE', query: 'jabar' })).rejects.toMatchObject({
      status: 409,
      code: 'MODE_MISMATCH',
    });
  });
});
