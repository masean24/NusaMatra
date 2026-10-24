import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fixtureResponse, renderWithDataHub, requestedUrls } from '@/test/dataHubFixtures';
import {
  capturedDemoBodies,
  capturedLiveBodies,
  hubFetch,
  indicatorOf,
  profileIn,
  relabelledProfile,
} from './evidenceTestKit';
import { EXPORT_SCHEMA } from './exportRecord';
import { BROWSER_ASSEMBLED_LABEL } from './notices';
import { EvidencePassport } from './EvidencePassport';
import type { DataMode } from '@/services/api';

const LIVE_URL = '/paspor-bukti?jenis=wilayah&mode=live&snap=2026.10.0-official-live&kode=1101';
const DEMO_URL = '/paspor-bukti?jenis=wilayah&mode=demo&snap=2026.10.0-wia-demo&kode=3201';

/** The record itself; the region cards inside it are articles too. */
const findDocument = () => screen.findByRole('article', { name: /^Bukti / });

function renderPassport(path: string, bodies: Record<string, unknown>, dataMode: DataMode = 'DEMO') {
  return renderWithDataHub(<EvidencePassport />, { fetchImpl: hubFetch(bodies), path, dataMode });
}

/** Every `<section>` of the document, by its heading, so "in every section" can be asserted. */
function sectionsOf(document_: HTMLElement) {
  return [...document_.querySelectorAll<HTMLElement>('section[aria-labelledby]')];
}

describe('Paspor Bukti for a region, CAPTURED LIVE responses', () => {
  it('shows LIVE in every section, the verified snapshot, provenance and quality classes', async () => {
    renderPassport(LIVE_URL, capturedLiveBodies());

    expect(
      await screen.findByRole('heading', { name: 'Bukti indikator Kabupaten Aceh Selatan' }),
    ).toBeVisible();
    const article = await findDocument();

    const sections = sectionsOf(article);
    expect(sections.length).toBeGreaterThanOrEqual(5);
    for (const section of sections) {
      expect(
        within(section).getAllByText('LIVE').length,
        section.getAttribute('aria-labelledby') ?? '',
      ).toBeGreaterThan(0);
    }
    expect(screen.queryByText(/DEMO/)).not.toBeInTheDocument();

    const status = screen.getByRole('region', { name: /Status sumber data/ });
    expect(within(status).getByText('2026.10.0-official-live')).toBeVisible();
    expect(within(status).getByText('BIG-20260601')).toBeVisible();
    expect(within(article).getByRole('note')).toHaveTextContent(
      'Dirangkai di peramban, bukan arsip/sertifikat resmi.',
    );
    expect(within(article).getByRole('note')).toHaveTextContent('bukan sertifikat');

    expect(within(article).getAllByText('IMPUTED_PROVINCE').length).toBeGreaterThanOrEqual(2);
    expect(within(article).getAllByText('DERIVED').length).toBeGreaterThanOrEqual(3);
    expect(within(article).getAllByText('VERIFIED').length).toBeGreaterThanOrEqual(11);
    const sourceLinks = within(article)
      .getAllByRole('link', { name: /membuka tab baru/ })
      .map((link) => link.getAttribute('href'));
    expect(sourceLinks.every((href) => href?.startsWith('https://'))).toBe(true);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('never prints a made-up identifier, signature or verification claim', async () => {
    renderPassport(LIVE_URL, capturedLiveBodies());
    await findDocument();
    const text = document.body.textContent;
    expect(text).not.toMatch(/NM-20\d\d-\d+/);
    expect(text.replaceAll(BROWSER_ASSEMBLED_LABEL, '')).not.toMatch(
      /sertifikat resmi|terverifikasi secara|immutable/i,
    );
  });

  it('warns that the record is not the one in the link when the snapshot has changed', async () => {
    renderPassport(
      '/paspor-bukti?jenis=wilayah&mode=live&snap=2026.09.0-older&kode=1101',
      capturedLiveBodies(),
    );
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('2026.09.0-older');
    expect(alert).toHaveTextContent('2026.10.0-official-live');
    expect(alert).toHaveTextContent('tidak sama dengan tautan');
    // The page still reports what it actually received, not what the link said.
    expect(
      within(screen.getByRole('region', { name: /Status sumber data/ })).getByText('2026.10.0-official-live'),
    ).toBeVisible();
  });

  it('fetches in the mode of the link, not the app-wide mode', async () => {
    const fetchImpl = hubFetch(capturedLiveBodies());
    renderWithDataHub(<EvidencePassport />, { fetchImpl, path: LIVE_URL, dataMode: 'DEMO' });
    await findDocument();
    const modes = requestedUrls(fetchImpl).map((url) => url.searchParams.get('mode'));
    expect(new Set(modes)).toEqual(new Set(['live']));
  });

  it('shows "belum tersedia" where provenance is missing and never a link for an unsafe address', async () => {
    const bodies = capturedLiveBodies();
    const profile = profileIn(bodies, '/api/v1/regions/1101');
    delete indicatorOf(profile, 'soc_hdi').provenance;
    indicatorOf(profile, 'soc_poverty_rate').provenance = {
      dataset_id: 'bps_susenas_sakernas_2025',
      agency_code: 'BPS',
      official_url: 'internal://catalog/soc_poverty_rate',
    };
    indicatorOf(profile, 'hlt_stunting_prevalence').raw_value = null;
    // SYNTHETIC edits above; the supporting captures keep their real https portal addresses.
    renderPassport(LIVE_URL, bodies);
    await findDocument();

    expect(screen.getAllByText('Data belum tersedia').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Tidak ada nilai untuk digolongkan/).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /internal:/ })).not.toBeInTheDocument();
  });
});

describe('Paspor Bukti for a region, CAPTURED DEMO responses', () => {
  it('is DEMO in every section and presents nothing as official', async () => {
    renderPassport(DEMO_URL, capturedDemoBodies(), 'LIVE');
    const article = await screen.findByRole('article', { name: /Bukti indikator/ });

    for (const section of sectionsOf(article)) {
      expect(within(section).getAllByText('DEMO · data simulasi').length).toBeGreaterThan(0);
    }
    expect(within(article).queryByText('LIVE')).not.toBeInTheDocument();
    expect(within(article).getAllByText('DEMO_EXAMPLE').length).toBeGreaterThan(0);
    expect(within(article).queryByText('VERIFIED')).not.toBeInTheDocument();
    expect(within(article).getByText(/Nama sintetis \(DEMO\)/)).toBeVisible();
    expect(article).not.toHaveTextContent(/d3m0|demo_placeholder/);
  });
});

describe('Paspor Bukti for a comparison', () => {
  it('SYNTHETIC second region: shows allowed and blocked comparisons with reasons', async () => {
    const bodies = capturedLiveBodies();
    const b = relabelledProfile(profileIn(bodies, '/api/v1/regions/1101'), '1102', 'Kabupaten Uji');
    indicatorOf(b, 'hlt_stunting_prevalence').raw_value = null;
    indicatorOf(b, 'soc_poverty_rate').raw_value = 19.78;
    bodies['/api/v1/regions/1102'] = b;

    renderPassport('/paspor-bukti?jenis=bandingkan&mode=live&a=1101&b=1102', bodies);
    const article = await screen.findByRole('article', {
      name: 'Bukti perbandingan Kabupaten Aceh Selatan dan Kabupaten Uji',
    });

    expect(within(article).getAllByText('Dapat dibandingkan').length).toBeGreaterThan(0);
    expect(within(article).getAllByText('Tidak dibandingkan').length).toBeGreaterThan(0);
    expect(within(article).getAllByText(/tidak memiliki data/).length).toBeGreaterThan(0);
    expect(within(article).getAllByText(/lebih tinggi/).length).toBeGreaterThan(0);
    expect(within(article).getAllByText('A: Kabupaten Aceh Selatan').length).toBeGreaterThan(0);
    // No snapshot in the link: stated quietly as information, not as an alarm.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Paspor Bukti states', () => {
  it('rejects a malformed link with a reason and routes to the features that can make one', () => {
    renderPassport('/paspor-bukti?jenis=wilayah&kode=../x', capturedLiveBodies());
    expect(screen.getByRole('status')).toHaveTextContent('tidak dapat dibuat dari tautan ini');
    expect(screen.getByRole('link', { name: 'Buka Jelajahi' })).toHaveAttribute('href', '/jelajahi');
    expect(screen.queryByRole('article', { name: /^Bukti / })).not.toBeInTheDocument();
  });

  it('does not fall back to DEMO when LIVE is unavailable', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(fixtureResponse('regions_live', 503)));
    renderWithDataHub(<EvidencePassport />, { fetchImpl, path: LIVE_URL, dataMode: 'DEMO' });
    expect(await screen.findByText('Data LIVE tidak dapat dimuat, Paspor Bukti tidak dibuat')).toBeVisible();
    expect(screen.queryByRole('article', { name: /^Bukti / })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeVisible();
  });

  it('says so when no Data Hub is configured', () => {
    renderWithDataHub(<EvidencePassport />, { fetchImpl: null, path: LIVE_URL });
    expect(screen.getByRole('status')).toHaveTextContent('Data Hub belum dihubungkan');
  });
});

describe('Paspor Bukti actions', () => {
  let print: ReturnType<typeof vi.fn<() => void>>;
  let clipboardWrite: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;

  beforeEach(() => {
    clipboardWrite = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: clipboardWrite },
      configurable: true,
    });
    print = vi.fn();
    window.print = print;
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
    vi.restoreAllMocks();
  });

  it('prints through the browser', async () => {
    renderPassport(LIVE_URL, capturedLiveBodies());
    await userEvent.click(await screen.findByRole('button', { name: 'Cetak atau simpan PDF' }));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('copies a citation that names the mode, the snapshot and that this is not an official archive', async () => {
    renderPassport(LIVE_URL, capturedLiveBodies());
    await userEvent.click(await screen.findByRole('button', { name: 'Salin sitasi' }));

    expect(clipboardWrite).toHaveBeenCalledTimes(1);
    const citation = clipboardWrite.mock.calls[0]?.[0] ?? '';
    expect(citation).toContain('Mode data: LIVE');
    expect(citation).toContain('Snapshot Data Hub: 2026.10.0-official-live');
    expect(citation).toContain('BPS');
    expect(citation).toContain('bukan arsip resmi');
    expect(citation).toContain(LIVE_URL);
    await waitFor(() => {
      expect(screen.getByText('Sitasi disalin ke papan klip.')).toBeVisible();
    });
  });

  it('shows the text for manual copying when copying is impossible, instead of claiming success', async () => {
    clipboardWrite.mockRejectedValue(new Error('denied'));
    Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true });
    renderPassport(LIVE_URL, capturedLiveBodies());
    await userEvent.click(await screen.findByRole('button', { name: 'Salin tautan' }));

    const field = await screen.findByRole('textbox', { name: /Salin teks ini secara manual/ });
    expect((field as HTMLTextAreaElement).value).toContain(LIVE_URL);
    expect(screen.queryByText(/disalin ke papan klip/)).not.toBeInTheDocument();
    Reflect.deleteProperty(document, 'execCommand');
  });

  it('uses the legacy copy route when the Clipboard API is absent', async () => {
    Reflect.deleteProperty(navigator, 'clipboard');
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
    renderPassport(LIVE_URL, capturedLiveBodies());
    await userEvent.click(await screen.findByRole('button', { name: 'Salin tautan' }));

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(await screen.findByText('Tautan disalin ke papan klip.')).toBeVisible();
    Reflect.deleteProperty(document, 'execCommand');
  });

  it('downloads the record as a JSON file that says it does not pin its inputs', async () => {
    let blob: Blob | null = null;
    Object.defineProperty(URL, 'createObjectURL', {
      value: (value: Blob) => {
        blob = value;
        return 'blob:test';
      },
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });

    renderPassport(LIVE_URL, capturedLiveBodies());
    await userEvent.click(await screen.findByRole('button', { name: 'Unduh JSON' }));

    expect(downloads).toEqual(['nusa-matra-paspor-bukti-wilayah-live-1101.json']);
    const written = blob as Blob | null;
    expect(written?.type).toBe('application/json');
    const payload = JSON.parse((await written?.text()) ?? '{}') as {
      schema: string;
      reproducibility: { pinnedInputs: boolean };
      record: { source: { dataMode: string; snapshotId: string }; kind: string };
    };
    expect(payload.schema).toBe(EXPORT_SCHEMA);
    expect(payload.reproducibility.pinnedInputs).toBe(false);
    expect(payload.record.source).toMatchObject({ dataMode: 'LIVE', snapshotId: '2026.10.0-official-live' });
  });

  it('is operable by keyboard alone', async () => {
    const user = userEvent.setup();
    renderPassport(LIVE_URL, capturedLiveBodies());
    await findDocument();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Cetak atau simpan PDF' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(print).toHaveBeenCalledTimes(1);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Unduh JSON' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Salin sitasi' })).toHaveFocus();
    await user.keyboard(' ');
    // user-event installs its own clipboard on setup(), so read the citation back from it.
    await waitFor(async () => {
      expect(await navigator.clipboard.readText()).toContain('Mode data: LIVE');
    });
  });
});

describe('Paspor Bukti print layout', () => {
  it('repeats the mode and snapshot as a print header and is announced to nobody on screen', async () => {
    renderPassport(LIVE_URL, capturedLiveBodies());
    await findDocument();
    expect(
      screen.getByText(/Nusa Matra · Paspor Bukti · Mode LIVE · Snapshot 2026.10.0-official-live/),
    ).toBeInTheDocument();
  });

  // The stylesheet's print rules cannot be evaluated in jsdom (it applies no CSS), so this checks the
  // markup they hook into; the printed result itself is a browser check.
  it('puts the controls in the print-hidden wrapper and keeps the content outside it', async () => {
    renderPassport(LIVE_URL, capturedLiveBodies());
    const article = await findDocument();
    const hidden = article.querySelector('[class*="noPrint"]');
    expect(hidden).not.toBeNull();
    expect(within(hidden as HTMLElement).getByRole('button', { name: 'Unduh JSON' })).toBeVisible();
    expect(within(hidden as HTMLElement).queryByRole('table')).not.toBeInTheDocument();
    expect(article.querySelector('[class*="printHeader"]')).not.toBeNull();
  });

  it('prints plain tables: captioned, with column and row headers', async () => {
    renderPassport(LIVE_URL, capturedLiveBodies());
    const article = await findDocument();
    const tables = within(article).getAllByRole('table');
    expect(tables.length).toBeGreaterThan(1);
    for (const table of tables) {
      expect(within(table).getAllByRole('columnheader').length).toBeGreaterThan(2);
      expect(within(table).getAllByRole('rowheader').length).toBeGreaterThan(0);
      expect(table.querySelector('caption')).not.toBeNull();
    }
  });
});

describe('Paspor Bukti keeps wide tables inside their own scroll box', () => {
  /** Every table sits in a labelled, keyboard-focusable scroll region; the page never scrolls sideways. */
  function expectScrollRegions(root: HTMLElement) {
    const tables = within(root).getAllByRole('table');
    expect(tables.length).toBeGreaterThan(0);
    for (const table of tables) {
      const region = table.closest('[role="region"]');
      expect(region, 'table without a scroll region').not.toBeNull();
      expect(region).toHaveAttribute('tabindex', '0');
      expect(region?.getAttribute('aria-label')).toBeTruthy();
      expect(region?.className).toMatch(/tableScroll/);
      // The region holds one table and nothing else, so scrolling it scrolls only that table.
      expect(region?.children).toHaveLength(1);
    }
  }

  it('region profile', async () => {
    renderPassport(LIVE_URL, capturedLiveBodies());
    expectScrollRegions(await findDocument());
  });

  it('SYNTHETIC second region: comparison', async () => {
    const bodies = capturedLiveBodies();
    bodies['/api/v1/regions/1102'] = relabelledProfile(
      profileIn(bodies, '/api/v1/regions/1101'),
      '1102',
      'Kabupaten Uji',
    );
    renderPassport('/paspor-bukti?jenis=bandingkan&mode=live&a=1101&b=1102', bodies);
    expectScrollRegions(await findDocument());
  });
});
