import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createFixtureFetch, fixtureResponse, renderWithDataHub } from '@/test/dataHubFixtures';
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
});
