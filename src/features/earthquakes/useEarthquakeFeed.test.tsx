import { act, screen } from '@testing-library/react';
import { createFixtureFetch, fixtureJson, jsonResponse, renderWithDataHub } from '@/test/dataHubFixtures';
import { POLL_INTERVAL_MS, useEarthquakeFeed } from './useEarthquakeFeed';

interface WireFeed {
  features: { id: string; properties: { id: string } }[];
}

function Probe({ enabled }: { readonly enabled: boolean }) {
  const state = useEarthquakeFeed(enabled);
  return (
    <p data-testid="probe">
      {state.status}|{state.feed?.events.length ?? 0}|{state.assessment?.display ?? '-'}|
      {[...state.newIds].join(',')}|{state.lastError ? 'error' : 'ok'}
    </p>
  );
}

const liveHeaders = {
  'Content-Type': 'application/json',
  'X-NusaMatra-Mode': 'LIVE',
  'X-Data-Fallback': 'NONE',
};
const feedResponse = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: liveHeaders });

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};
const probe = () => screen.getByTestId('probe').textContent;

describe('useEarthquakeFeed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility('visible');
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks nothing while the layer is off', () => {
    const fetchImpl = createFixtureFetch({});
    renderWithDataHub(<Probe enabled={false} />, { fetchImpl, dataMode: 'LIVE' });
    expect(probe()).toMatch(/^idle/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('asks nothing in DEMO: BMKG events belong on the official map only', () => {
    const fetchImpl = createFixtureFetch({});
    renderWithDataHub(<Probe enabled />, { fetchImpl, dataMode: 'DEMO' });
    expect(probe()).toMatch(/^idle/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('loads at once, withholds today’s undeclared origin, polls every interval and only while visible', async () => {
    const fetchImpl = createFixtureFetch({
      '/api/v1/earthquakes/geojson': () => feedResponse(fixtureJson('live/earthquakes_geojson')),
    });
    const view = renderWithDataHub(<Probe enabled />, { fetchImpl, dataMode: 'LIVE' });
    await flush();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(probe()).toMatch(/^ready\|28\|WITHHELD\|/);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(typeof url === 'string' ? url : url instanceof URL ? url.href : '').toContain('mode=live');
    expect(init?.cache).toBe('no-cache');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    setVisibility('hidden');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    await act(async () => {
      setVisibility('visible');
      await Promise.resolve();
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);

    view.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('marks only events that were not there before as new', async () => {
    const first = structuredClone(fixtureJson('live/earthquakes_geojson')) as WireFeed;
    const removed = first.features.shift();
    let call = 0;
    const fetchImpl = createFixtureFetch({
      '/api/v1/earthquakes/geojson': () => {
        call += 1;
        return feedResponse(call === 1 ? first : fixtureJson('live/earthquakes_geojson'));
      },
    });
    renderWithDataHub(<Probe enabled />, { fetchImpl, dataMode: 'LIVE' });
    await flush();
    expect(probe()).toMatch(/\|\|ok$/); // nothing is "new" on the first load
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(probe()).toContain(`|${removed?.id ?? '?'}|`);
  });

  it('keeps the last data, flagged, when a refresh fails', async () => {
    let call = 0;
    const fetchImpl = createFixtureFetch({
      '/api/v1/earthquakes/geojson': () => {
        call += 1;
        return call === 1
          ? feedResponse(fixtureJson('live/earthquakes_geojson'))
          : jsonResponse({ detail: 'x' }, 502);
      },
    });
    renderWithDataHub(<Probe enabled />, { fetchImpl, dataMode: 'LIVE' });
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(probe()).toMatch(/^ready\|28\|.*\|error$/);
  });
});
