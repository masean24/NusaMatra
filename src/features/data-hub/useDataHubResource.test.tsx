import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createFixtureFetch,
  fixtureResponse,
  renderWithDataHub,
  requestedUrls,
} from '@/test/dataHubFixtures';
import { useDataHub } from './useDataHub';
import { useDataHubResource } from './useDataHubResource';

function Probe() {
  const { setDataMode } = useDataHub();
  const { state } = useDataHubResource('snapshots', (repository, dataMode, signal) =>
    repository.getSnapshots(dataMode, signal),
  );
  return (
    <>
      <p data-testid="state">
        {state.status === 'success' ? `ok:${state.data.meta.snapshotId}` : state.status}
      </p>
      <button
        type="button"
        onClick={() => {
          setDataMode('LIVE');
        }}
      >
        LIVE
      </button>
    </>
  );
}

describe('useDataHubResource', () => {
  it('shows loading the moment the mode changes, so DEMO data never sits under LIVE', async () => {
    const fetchImpl = createFixtureFetch({
      '/api/v1/snapshots': (url) =>
        url.searchParams.get('mode') === 'live'
          ? new Promise<Response>(() => undefined) // LIVE never answers
          : fixtureResponse('snapshots'),
    });
    renderWithDataHub(<Probe />, { fetchImpl });
    expect(await screen.findByText('ok:2026.10.0-wia-demo')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'LIVE' }));

    expect(screen.getByTestId('state')).toHaveTextContent('loading');
    expect(screen.queryByText('ok:2026.10.0-wia-demo')).not.toBeInTheDocument();
  });

  it('aborts the request when the component goes away', () => {
    let signal: AbortSignal | null | undefined;
    const fetchImpl = createFixtureFetch({
      '/api/v1/snapshots': (_url, init) => {
        signal = init?.signal;
        return new Promise<Response>(() => undefined);
      },
    });
    const { unmount } = renderWithDataHub(<Probe />, { fetchImpl });
    expect(signal?.aborted).toBe(false);

    unmount();

    expect(signal?.aborted).toBe(true);
  });

  it('reports unconfigured instead of loading forever when no Data Hub address exists', () => {
    renderWithDataHub(<Probe />, { fetchImpl: null });
    expect(screen.getByTestId('state')).toHaveTextContent('unconfigured');
  });

  describe('retry', () => {
    function Resource({ name, path }: { readonly name: string; readonly path: 'snapshots' | 'health' }) {
      const { state, retry } = useDataHubResource<unknown>(name, (repository, dataMode, signal) =>
        path === 'snapshots' ? repository.getSnapshots(dataMode, signal) : repository.getHealth(signal),
      );
      return (
        <>
          <p data-testid={name}>{state.status}</p>
          <button type="button" onClick={retry}>
            {`retry ${name}`}
          </button>
        </>
      );
    }

    const count = (fetchImpl: ReturnType<typeof createFixtureFetch>, path: string) =>
      requestedUrls(fetchImpl).filter((url) => url.pathname === path).length;

    it('loads again every resource that failed, and leaves the ones that succeeded alone', async () => {
      let online = false;
      const fetchImpl = createFixtureFetch({
        '/api/v1/snapshots': () => fixtureResponse('snapshots'),
        '/api/v1/health': () =>
          online ? fixtureResponse('health') : Promise.reject(new TypeError('Failed to fetch')),
      });
      renderWithDataHub(
        <>
          <Resource name="good" path="snapshots" />
          <Resource name="bad-1" path="health" />
          <Resource name="bad-2" path="health" />
        </>,
        { fetchImpl },
      );
      await waitFor(() => {
        expect(screen.getByTestId('good')).toHaveTextContent('success');
        expect(screen.getByTestId('bad-1')).toHaveTextContent('error');
        expect(screen.getByTestId('bad-2')).toHaveTextContent('error');
      });
      online = true;

      // Pressing the button of one failed panel recovers the other as well.
      await userEvent.click(screen.getByRole('button', { name: 'retry bad-1' }));

      await waitFor(() => {
        expect(screen.getByTestId('bad-1')).toHaveTextContent('success');
        expect(screen.getByTestId('bad-2')).toHaveTextContent('success');
      });
      expect(screen.getByTestId('good')).toHaveTextContent('success');
      expect(count(fetchImpl, '/api/v1/snapshots')).toBe(1);
      expect(count(fetchImpl, '/api/v1/health')).toBe(4);
    });

    it('does not start a second request while one is running, however often it is pressed', async () => {
      let answer: ((response: Response) => void) | undefined;
      let first = true;
      const fetchImpl = createFixtureFetch({
        '/api/v1/health': () => {
          if (first) {
            first = false;
            return Promise.reject(new TypeError('Failed to fetch'));
          }
          return new Promise<Response>((resolve) => {
            answer = resolve;
          });
        },
      });
      renderWithDataHub(<Resource name="bad" path="health" />, { fetchImpl });
      await waitFor(() => {
        expect(screen.getByTestId('bad')).toHaveTextContent('error');
      });

      const button = screen.getByRole('button', { name: 'retry bad' });
      await userEvent.click(button);
      await userEvent.click(button);
      await userEvent.click(button);

      expect(screen.getByTestId('bad')).toHaveTextContent('loading');
      expect(count(fetchImpl, '/api/v1/health')).toBe(2);
      answer?.(fixtureResponse('health'));
      await waitFor(() => {
        expect(screen.getByTestId('bad')).toHaveTextContent('success');
      });
    });

    it('keeps the failure when the retry fails too, and never retries by itself', async () => {
      const fetchImpl = createFixtureFetch({
        '/api/v1/health': () => Promise.reject(new TypeError('Failed to fetch')),
      });
      renderWithDataHub(<Resource name="bad" path="health" />, { fetchImpl });
      await waitFor(() => {
        expect(screen.getByTestId('bad')).toHaveTextContent('error');
      });
      await userEvent.click(screen.getByRole('button', { name: 'retry bad' }));
      await waitFor(() => {
        expect(screen.getByTestId('bad')).toHaveTextContent('error');
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(count(fetchImpl, '/api/v1/health')).toBe(2);
    });
  });
});
