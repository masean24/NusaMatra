import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithDataHub } from '@/test/dataHubFixtures';
import type { FeedAssessment } from '@/domain/hazards';
import type { EarthquakeEventDTO, EarthquakeFeedDTO } from '@/services/api';
import { EarthquakeDetail } from './EarthquakeDetail';
import { EarthquakeLayerControl } from './EarthquakeLayerControl';
import type { EarthquakeFeedState } from './useEarthquakeFeed';

const event: EarthquakeEventDTO = {
  id: 'bmkg-1',
  occurredAt: '2026-10-21T11:58:36+00:00',
  localDate: '21 Okt 2026',
  localTime: '18:58:36 WIB',
  magnitude: 5.1,
  depthKm: 96,
  longitude: 128.18,
  latitude: -7.75,
  area: '<img src=x onerror=alert(1)> 62 km TimurLaut MALUKUBRTDAYA',
  potency: 'Tidak berpotensi tsunami',
  felt: 'III Ulu Belu, Tanggamus',
  shakemapUrl: 'https://data.bmkg.go.id/DataMKG/TEWS/20261021185836.mmi.jpg',
  source: 'BMKG',
};

const official: FeedAssessment = { display: 'OFFICIAL', isStale: false, ageMinutes: 1, reasons: [] };

describe('EarthquakeDetail', () => {
  it('shows magnitude as "Magnitudo" (never "SR"), depth, BMKG time, epicentre and felt reports', () => {
    render(<EarthquakeDetail event={event} assessment={official} onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Gempa Magnitudo 5,1' })).toBeInTheDocument();
    expect(screen.queryByText(/SR/)).not.toBeInTheDocument();
    expect(screen.getByText('96 km')).toBeInTheDocument();
    expect(screen.getByText('21 Okt 2026, 18:58:36 WIB')).toBeInTheDocument();
    expect(screen.getByText('7,75° LS, 128,18° BT')).toBeInTheDocument();
    expect(screen.getByText('III Ulu Belu, Tanggamus')).toBeInTheDocument();
    expect(screen.getByText('Tidak berpotensi tsunami')).toBeInTheDocument();
    expect(screen.getByText(/bukan luas wilayah terdampak/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'data.bmkg.go.id' })).toBeInTheDocument();
  });

  it('renders feed strings as text, never as HTML', () => {
    const { container } = render(<EarthquakeDetail event={event} assessment={official} onClose={vi.fn()} />);
    expect(screen.getByText(/<img src=x onerror=alert\(1\)> 62 km/)).toBeInTheDocument();
    expect(container.querySelectorAll('img')).toHaveLength(1); // only the shakemap
  });

  it('falls back to a link when the shakemap image fails to load', () => {
    render(<EarthquakeDetail event={event} assessment={official} onClose={vi.fn()} />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByText(/Gambar shakemap gagal dimuat/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buka di situs BMKG' })).toHaveAttribute(
      'href',
      event.shakemapUrl,
    );
  });

  it('shows the origin of the feed in the detail', () => {
    render(<EarthquakeDetail event={event} assessment={official} origin="BMKG_LIVE" onClose={vi.fn()} />);
    expect(screen.getByText('Asal: langsung dari BMKG')).toBeInTheDocument();
  });

  it('labels an unverified preview and stale data', () => {
    render(
      <EarthquakeDetail
        event={{ ...event, shakemapUrl: null, felt: null }}
        assessment={{ display: 'PREVIEW_UNVERIFIED', isStale: true, ageMinutes: 30, reasons: [] }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Pratinjau: asal data belum terverifikasi')).toBeInTheDocument();
    expect(screen.getByText('Mungkin usang')).toBeInTheDocument();
    expect(screen.getByText('Tidak ada laporan dirasakan pada data ini')).toBeInTheDocument();
  });
});

const feed: EarthquakeFeedDTO = {
  events: [event],
  origin: 'UNDECLARED',
  lastSuccessAt: '2026-10-22T03:52:11Z',
  declaredStale: null,
  cacheTtlSeconds: null,
  sourcePortal: null,
  serverMode: 'LIVE',
  dataFallback: 'NONE',
  rejectedCount: 0,
  receivedAt: '2026-10-22T03:53:00Z',
};
const state = (assessment: FeedAssessment): EarthquakeFeedState => ({
  status: 'ready',
  feed,
  assessment,
  lastError: null,
  newIds: new Set(),
  retry: vi.fn(),
});

describe('EarthquakeLayerControl', () => {
  it('is an off-by-default switch, unavailable outside LIVE', async () => {
    const onToggle = vi.fn();
    render(
      <EarthquakeLayerControl
        enabled={false}
        available={false}
        onToggle={onToggle}
        state={{
          status: 'idle',
          feed: null,
          assessment: null,
          lastError: null,
          newIds: new Set(),
          retry: vi.fn(),
        }}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    const toggle = screen.getByRole('switch', { name: 'Gempa BMKG' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toBeDisabled();
    expect(screen.getByText(/Hanya untuk data LIVE/)).toBeInTheDocument();
    await userEvent.click(toggle);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('withholds an undeclared feed and says why, listing no events', () => {
    render(
      <EarthquakeLayerControl
        enabled
        available
        onToggle={vi.fn()}
        state={state({
          display: 'WITHHELD',
          isStale: false,
          ageMinutes: 1,
          reasons: ['Data Hub belum menyatakan asal data.'],
        })}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('Gempa ditahan: asal data belum jelas')).toBeInTheDocument();
    expect(screen.getByText('Data Hub belum menyatakan asal data.')).toBeInTheDocument();
    expect(screen.queryByText(/Daftar gempa/)).not.toBeInTheDocument();
  });

  it('lists the events as buttons for keyboard users, with the size caveat', async () => {
    const onSelect = vi.fn();
    render(
      <EarthquakeLayerControl
        enabled
        available
        onToggle={vi.fn()}
        state={state({ display: 'OFFICIAL', isStale: false, ageMinutes: 1, reasons: [] })}
        selectedId={null}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByText('Data BMKG')).toBeInTheDocument();
    expect(
      screen.getByText(/Ukuran titik mengikuti magnitudo, bukan luas wilayah terdampak/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByText('Daftar gempa (1)'));
    await userEvent.click(screen.getByRole('button', { name: /Magnitudo 5,1/ }));
    expect(onSelect).toHaveBeenCalledWith('bmkg-1');
  });

  it('names the declared origin and the last successful fetch, and never calls stale data fresh', () => {
    const cached: EarthquakeFeedState = {
      ...state({ display: 'OFFICIAL', isStale: true, ageMinutes: 45, reasons: ['Data terlalu lama.'] }),
      feed: { ...feed, origin: 'BMKG_CACHE', rejectedCount: 2 },
    };
    render(
      <EarthquakeLayerControl
        enabled
        available
        onToggle={vi.fn()}
        state={cached}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('Asal: cache Data Hub (dari BMKG)')).toBeInTheDocument();
    expect(screen.getByText('Mungkin usang')).toBeInTheDocument();
    expect(screen.getByText('Data terlalu lama.')).toBeInTheDocument();
    expect(screen.getByText(/Terakhir diambil dari BMKG .* WIB/)).toBeInTheDocument();
    expect(screen.getByText(/2 entri ditolak/)).toBeInTheDocument();
  });

  it('labels bmkg_live and an undeclared preview differently', () => {
    const live: EarthquakeFeedState = {
      ...state({ display: 'OFFICIAL', isStale: false, ageMinutes: 1, reasons: [] }),
      feed: { ...feed, origin: 'BMKG_LIVE' },
    };
    const { rerender } = render(
      <EarthquakeLayerControl
        enabled
        available
        onToggle={vi.fn()}
        state={live}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('Asal: langsung dari BMKG')).toBeInTheDocument();
    rerender(
      <EarthquakeLayerControl
        enabled
        available
        onToggle={vi.fn()}
        state={state({ display: 'PREVIEW_UNVERIFIED', isStale: false, ageMinutes: 1, reasons: [] })}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('Asal: tidak dinyatakan Data Hub')).toBeInTheDocument();
    expect(screen.getByText('Pratinjau: asal data belum terverifikasi')).toBeInTheDocument();
  });

  it('offers a retry when the first request failed', async () => {
    const retry = vi.fn();
    renderWithDataHub(
      <EarthquakeLayerControl
        enabled
        available
        onToggle={vi.fn()}
        state={{
          status: 'error',
          feed: null,
          assessment: null,
          lastError: new Error('x'),
          newIds: new Set(),
          retry,
        }}
        selectedId={null}
        onSelect={vi.fn()}
      />,
      { fetchImpl: null, dataMode: 'LIVE' },
    );
    await userEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
