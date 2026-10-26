import { screen } from '@testing-library/react';
import {
  createFixtureFetch,
  fixtureHeaders,
  fixtureJson,
  fixtureResponse,
  jsonResponse,
  renderWithDataHub,
} from '@/test/dataHubFixtures';
import { BoundaryNotice } from './BoundaryNotice';

/**
 * The DEMO answer the Data Hub gave on 2026-10-25: official BIG polygons whose geometry_status says
 * REAL_OFFICIAL, inside a DEMO envelope. Built from the captured LIVE sample and the DEMO headers.
 */
function demoEnvelopeWithOfficialGeometry(): Response {
  const body = structuredClone(fixtureJson('live/boundaries_sample')) as {
    meta: Record<string, unknown>;
  };
  body.meta.mode = 'DEMO';
  body.meta.snapshot_id = '2026.10.0-wia-demo';
  return new Response(JSON.stringify(body), { status: 200, headers: fixtureHeaders('boundaries_kabupaten') });
}

function renderNotice(boundaries: () => Response) {
  return renderWithDataHub(<BoundaryNotice compact />, {
    fetchImpl: createFixtureFetch({ '/api/v1/boundaries/kabupaten': boundaries }),
    dataMode: 'DEMO',
  });
}

describe('BoundaryNotice in DEMO', () => {
  it('says the mislabelled boundaries are not used, without calling it a failed load or offering a retry', async () => {
    renderNotice(demoEnvelopeWithOfficialGeometry);

    expect(await screen.findByText('Batas wilayah tidak dipakai di mode ini')).toBeInTheDocument();
    expect(screen.getByText(/berlabel resmi \(BIG\) untuk mode DEMO/)).toBeInTheDocument();
    expect(screen.queryByText('Data belum dapat dimuat')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /coba lagi/i })).not.toBeInTheDocument();
    // The map stays labelled illustrative.
    expect(screen.getByText(/Geometri Ilustratif DEMO/)).toBeInTheDocument();
  });

  it('keeps a real failure as an error with a retry', async () => {
    renderNotice(() => jsonResponse({ status: 'error' }, 500));

    expect(await screen.findByText('Data belum dapat dimuat')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /coba lagi/i })).toBeInTheDocument();
    expect(screen.queryByText('Batas wilayah tidak dipakai di mode ini')).not.toBeInTheDocument();
  });

  it('still explains the DEMO placeholder geometry when the Data Hub sends it', async () => {
    renderNotice(() => fixtureResponse('boundaries_kabupaten'));

    expect(await screen.findByText('Tentang batas wilayah')).toBeInTheDocument();
    expect(screen.queryByText('Data belum dapat dimuat')).not.toBeInTheDocument();
  });
});
