/**
 * Paspor Bukti page layout (Figma "Paspor Bukti", Normal and Kaca), on responses CAPTURED FROM
 * PRODUCTION on 2026-10-24 (src/services/api/__fixtures__/live-v2.2, unmodified). Tests that alter a
 * capture say SYNTHETIC and do it in memory. jsdom applies no stylesheet, so print and Kaca checks
 * assert the markup the stylesheet hooks into; the rendered result is checked in a browser.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fixtureJson, renderWithDataHub } from '@/test/dataHubFixtures';
import { EvidencePassport } from './EvidencePassport';
import { passportHref } from './evidenceQuery';
import {
  DIGEST_22,
  KMS_WEIGHTS,
  NON_RANKABLE_WEIGHTS,
  SNAPSHOT_22,
  captured22NationalKms,
  captured22NonRankable,
  hubFetch,
} from './evidenceTestKit';

type Json = Record<string, unknown>;

const labPath = (weights: Readonly<Record<string, number>>) =>
  passportHref({ kind: 'lab', mode: 'LIVE', snapshotId: SNAPSHOT_22, weights, focusRegionId: '9507' });

function renderLab(weights: Readonly<Record<string, number>>, bodies: Record<string, unknown>) {
  renderWithDataHub(<EvidencePassport />, {
    fetchImpl: hubFetch(bodies),
    path: labPath(weights),
    dataMode: 'LIVE',
  });
}

/** CAPTURED v2.2 region passport for Lanny Jaya (9507), pinned to the snapshot in the link. */
function renderRegion() {
  const bodies = captured22NationalKms();
  renderWithDataHub(<EvidencePassport />, {
    fetchImpl: hubFetch({
      '/api/v1/snapshots': bodies['/api/v1/snapshots'],
      [`/api/v1/snapshots/${SNAPSHOT_22}`]: bodies[`/api/v1/snapshots/${SNAPSHOT_22}`],
      '/api/v1/regions/9507': fixtureJson('live-v2.2/region_9507'),
      '/api/v1/indicators': bodies['/api/v1/indicators'],
      '/api/v1/datasets': bodies['/api/v1/datasets'],
      '/api/v1/indicators/coverage': bodies['/api/v1/indicators/coverage'],
    }),
    path: passportHref({ kind: 'wilayah', mode: 'LIVE', snapshotId: SNAPSHOT_22, regionId: '9507' }),
    dataMode: 'LIVE',
  });
}

const findLab = () => screen.findByRole('article', { name: /^Bukti hasil Lab/ });
const findRegion = () => screen.findByRole('article', { name: /^Bukti indikator/ });

/** The ranked regions exactly as the captured composite response lists them. */
function sentRegions(): { region_id: string; region_name: string; rank: number }[] {
  const composite = captured22NationalKms()['/api/v1/indicators/composite-query'] as {
    data: { regions: { region_id: string; region_name: string; rank: number }[] };
  };
  return composite.data.regions;
}

/** Clicks "Unduh JSON" and returns the parsed file the browser would have saved. */
async function downloadJson(): Promise<Json> {
  let blob: Blob | null = null;
  Object.defineProperty(URL, 'createObjectURL', {
    value: (value: Blob) => {
      blob = value;
      return 'blob:test';
    },
    configurable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  await userEvent.click(screen.getByRole('button', { name: 'Unduh JSON' }));
  const written = blob as Blob | null;
  return JSON.parse((await written?.text()) ?? '{}') as Json;
}

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('region passport layout (CAPTURED v2.2, Lanny Jaya pinned)', () => {
  it('reads breadcrumb, hero, limitations banner, trust overview, then the evidence', async () => {
    renderRegion();
    const article = await findRegion();

    const crumbs = screen.getByRole('navigation', { name: 'Jejak navigasi' });
    expect(within(crumbs).getByRole('link', { name: 'Peta utama' })).toHaveAttribute('href', '/peta');
    expect(within(crumbs).getByRole('link', { name: 'Kabupaten Lanny Jaya' })).toHaveAttribute(
      'href',
      '/jelajahi?kode=9507',
    );
    expect(within(crumbs).getByText('Paspor Bukti')).toHaveAttribute('aria-current', 'page');

    const hero = present(article.querySelector('header'));
    expect(within(hero).getByRole('heading', { level: 1 })).toHaveTextContent('Kabupaten Lanny Jaya');
    expect(hero).toHaveTextContent('LIVE');
    expect(hero).toHaveTextContent('Satu wilayah');
    expect(hero).toHaveTextContent('29 / 33 indikator berdata');
    expect(hero).toHaveTextContent(SNAPSHOT_22);
    expect(hero).toHaveTextContent(DIGEST_22); // full digest for assistive technology, shortened on screen
    expect(hero).toHaveTextContent('BIG-20260601');
    expect(within(hero).getByRole('note')).toHaveTextContent(
      'Dirangkai di peramban, bukan arsip/sertifikat resmi.',
    );
    expect(hero).not.toHaveTextContent('http');

    const headings = [...article.querySelectorAll('section[aria-labelledby] h2')].map((h) => h.textContent);
    expect(headings).toEqual([
      'Seberapa bisa dipercaya?',
      'Status sumber data',
      'Wilayah, kelengkapan, dan granularitas',
      'Indikator, kelas bukti, dan sumber',
      'Sumber data',
      'Batasan dan catatan',
    ]);
  });

  it('states trust from the Data Hub figures, without a pass/fail verdict', async () => {
    renderRegion();
    const article = await findRegion();
    const trust = within(article).getByRole('region', { name: /Seberapa bisa dipercaya/ });
    const cards = within(trust).getAllByRole('listitem');
    expect(cards[0]).toHaveTextContent('87,9%');
    expect(cards[0]).toHaveTextContent('29 dari 33 indikator berdata di snapshot ini.');
    expect(cards[1]).toHaveTextContent('100%');
    expect(cards[2]).toHaveTextContent('Terkunci');
    expect(cards[2]).toHaveTextContent('Ke snapshot di tautan');
    expect(cards[3]).toHaveTextContent('Konsisten');
    expect(article).not.toHaveTextContent(/lolos/i);
  });

  it('shows the same limitations the record exports, numbered, three open and the rest on demand', async () => {
    const user = userEvent.setup();
    renderRegion();
    const article = await findRegion();
    const limits = within(article).getByRole('region', { name: /Batasan dan catatan/ });
    const exported = (await downloadJson()) as { record: { limitations: string[] } };
    const texts = exported.record.limitations;
    expect(texts.length).toBeGreaterThan(3);

    expect(limits).toHaveTextContent(`${String(texts.length)} batasan`);
    expect(article).toHaveTextContent(`${String(texts.length)} batasan berlaku untuk paspor ini`);
    const items = [...limits.querySelectorAll('li')];
    expect(items.map((item) => item.querySelector('p:last-child')?.textContent)).toEqual(texts);
    expect(items[0]).toHaveTextContent('Reproduksibilitas');
    expect(items[0]).toHaveTextContent('Data terkunci, tetapi snapshot bisa hilang');

    const more = within(limits).getByRole('button', {
      name: `Tampilkan ${String(texts.length - 3)} batasan lainnya`,
    });
    const rest = document.getElementById(present(more.getAttribute('aria-controls')));
    expect(rest).toHaveAttribute('hidden');
    await user.click(more);
    expect(rest).not.toHaveAttribute('hidden');
    expect(more).toHaveAttribute('aria-expanded', 'true');
  });

  it('lists every section in the table of contents and links to real pages for the same region', async () => {
    renderRegion();
    const article = await findRegion();
    const toc = within(article).getByRole('navigation', { name: 'Isi paspor' });
    for (const link of within(toc).getAllByRole('link')) {
      const id = present(link.getAttribute('href')).slice(1);
      expect(document.getElementById(id), id).not.toBeNull();
    }
    const next = within(article).getByRole('navigation', { name: 'Lanjutkan' });
    expect(within(next).getByRole('link', { name: 'Bandingkan dengan wilayah lain' })).toHaveAttribute(
      'href',
      '/bandingkan?a=9507',
    );
    expect(within(next).getByRole('link', { name: 'Lihat di peta Jelajahi' })).toHaveAttribute(
      'href',
      '/jelajahi?kode=9507',
    );
    expect(within(next).getByRole('link', { name: 'Uji di Lab Prioritas' })).toHaveAttribute(
      'href',
      '/lab-prioritas',
    );
  });

  it('copies the full digest, and the full citation shown in the side column', async () => {
    const write = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true });
    renderRegion();
    const article = await findRegion();
    await userEvent.click(
      within(present(article.querySelector('header'))).getByRole('button', { name: 'Salin sidik isi data' }),
    );
    expect(write).toHaveBeenLastCalledWith(DIGEST_22);

    const shown = within(article).getByRole('region', { name: 'Teks kutipan' }).textContent;
    await userEvent.click(within(article).getByRole('button', { name: 'Salin kutipan' }));
    expect(write).toHaveBeenLastCalledWith(shown);
    await waitFor(() => {
      expect(screen.getByText('Kutipan disalin ke papan klip.')).toBeInTheDocument();
    });
  });
});

describe('Lab passport on the same layout (CAPTURED v2.2, kemiskinan + stunting)', () => {
  it('opens the evidence column with the five highest-priority regions in the Data Hub order', async () => {
    renderLab(KMS_WEIGHTS, captured22NationalKms());
    const article = await findLab();
    expect(
      within(present(article.querySelector('header'))).getByRole('heading', { level: 1 }),
    ).toHaveTextContent('Hasil Lab Prioritas');
    const summary = within(article).getByRole('region', { name: /Ringkasan hasil/ });
    const top = within(summary).getByRole('list', { name: 'Wilayah dengan prioritas tertinggi' });
    const items = within(top).getAllByRole('listitem');
    expect(items).toHaveLength(5);
    sentRegions()
      .slice(0, 5)
      .forEach((region, index) => {
        expect(items[index]).toHaveTextContent(region.region_name);
        expect(items[index]).toHaveTextContent(`Peringkat ${String(region.rank)}`);
      });
    expect(summary).toHaveTextContent('Kriteria dan bobot diminta');
    expect(summary).toHaveTextContent('Kualitas dan cakupan data');
  });

  it('renders 20 ranking rows at a time and pages through every region the Data Hub sent', async () => {
    renderLab(KMS_WEIGHTS, captured22NationalKms());
    const article = await findLab();
    const total = sentRegions().length;
    expect(total).toBeGreaterThan(500);

    const table = within(article).getByRole('table', {
      name: `Peringkat ${String(total)} wilayah, urutan dari Data Hub`,
    });
    expect(within(table).getAllByRole('row')).toHaveLength(21);
    const pager = within(article).getByRole('navigation', { name: 'Halaman peringkat wilayah' });
    expect(pager).toHaveTextContent(`Menampilkan 1–20 dari ${String(total)} wilayah berperingkat`);
    expect(within(pager).getByRole('button', { name: 'Sebelumnya' })).toBeDisabled();
    expect(within(pager).getAllByRole('option')).toHaveLength(Math.ceil(total / 20));

    await userEvent.click(within(pager).getByRole('button', { name: 'Berikutnya' }));
    expect(pager).toHaveTextContent(`Menampilkan 21–40 dari ${String(total)} wilayah berperingkat`);
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent(present(sentRegions()[20]).region_name);

    await userEvent.selectOptions(
      within(pager).getByRole('combobox', { name: 'Halaman' }),
      String(Math.ceil(total / 20) - 1),
    );
    expect(within(pager).getByRole('button', { name: 'Berikutnya' })).toBeDisabled();
    expect(within(table).getAllByRole('row').at(-1)).toHaveTextContent(
      present(sentRegions().at(-1)).region_name,
    );
  });

  it('exports every ranked region in the JSON while the screen shows one page, and says so', async () => {
    renderLab(KMS_WEIGHTS, captured22NationalKms());
    const article = await findLab();
    const payload = (await downloadJson()) as { record: { rows: { regionId: string }[] } };
    expect(payload.record.rows.map((row) => row.regionId)).toEqual(
      sentRegions().map((region) => region.region_id),
    );
    expect(article).toHaveTextContent(
      `Unduh JSON memuat catatan lengkap: ${String(sentRegions().length)} wilayah berperingkat`,
    );
  });

  it('prints a labelled excerpt of exactly 20 rows that points to the complete JSON', async () => {
    renderLab(KMS_WEIGHTS, captured22NationalKms());
    const article = await findLab();
    const total = sentRegions().length;
    const excerpt = within(article).getByRole('table', {
      name: `Kutipan cetak: 20 dari ${String(total)} wilayah berperingkat`,
    });
    expect(within(excerpt).getAllByRole('row')).toHaveLength(21);
    const printBox = excerpt.closest('[class*="printOnly"]');
    expect(printBox).not.toBeNull();
    expect(printBox).toHaveTextContent(`hanya 20 baris pertama (urutan 1–20) dari ${String(total)}`);
    expect(printBox).toHaveTextContent('Daftar lengkap ada di berkas JSON');
    expect(printBox).toHaveTextContent('cetakan ini bukan daftar lengkap');
    expect(
      within(article)
        .getByRole('navigation', { name: 'Halaman peringkat wilayah' })
        .closest('[class*="screenOnly"]'),
    ).not.toBeNull();
  });
});

describe('a withheld ranking (CAPTURED v2.2, non-rankable request)', () => {
  it('names no top regions and says why, in the summary and in the checks', async () => {
    renderLab(NON_RANKABLE_WEIGHTS, captured22NonRankable());
    const article = await findLab();
    const summary = within(article).getByRole('region', { name: /Ringkasan hasil/ });
    expect(summary).toHaveTextContent('Peringkat ditahan, jadi tidak ada daftar wilayah teratas.');
    expect(
      within(summary).queryByRole('list', { name: 'Wilayah dengan prioritas tertinggi' }),
    ).not.toBeInTheDocument();
    expect(summary).toHaveTextContent('Tidak dinyatakan karena peringkat ditahan.');
    expect(within(article).queryByRole('table', { name: /^Peringkat \d+ wilayah/ })).not.toBeInTheDocument();
    expect(within(article).queryByRole('table', { name: /^Kutipan cetak/ })).not.toBeInTheDocument();
    expect(within(article).getByRole('alert')).toHaveTextContent('Peringkat ditahan');
  });
});

describe('a response from another snapshot (SYNTHETIC digest mismatch)', () => {
  it('shows no passport, only the page title and the refusal', async () => {
    const bodies = captured22NationalKms();
    (bodies['/api/v1/indicators'] as { meta: Json }).meta.content_sha256 = 'b'.repeat(64);
    renderLab(KMS_WEIGHTS, bodies);
    expect(await screen.findByText('Respons tidak berasal dari snapshot yang dikunci')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Paspor Bukti');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.queryByText('Seberapa bisa dipercaya?')).not.toBeInTheDocument();
  });
});

describe('long explanations are closed disclosures', () => {
  it('toggle by click and keyboard, state announced, and the full wording stays in the document', async () => {
    const user = userEvent.setup();
    renderLab(KMS_WEIGHTS, captured22NationalKms());
    const article = await findLab();
    const limits = within(article).getByRole('region', { name: /Batasan dan catatan/ });
    const toggle = within(limits).getByRole('button', { name: /Apa arti Paspor Bukti ini/ });
    const body = document.getElementById(present(toggle.getAttribute('aria-controls')));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(body).toHaveAttribute('hidden');
    // Hidden on screen, never removed: print opens it.
    expect(body).toHaveTextContent('bukan sertifikat');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(body).not.toHaveAttribute('hidden');

    toggle.focus();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard(' ');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps the snapshot explanation, technical details and page address behind labelled headings', async () => {
    renderLab(KMS_WEIGHTS, captured22NationalKms());
    const article = await findLab();
    for (const name of [/Apa arti Paspor Bukti ini/, /Arti reproduksibilitas snapshot/, /Detail teknis/]) {
      const toggle = within(article).getByRole('button', { name });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(toggle.closest('h3')).not.toBeNull();
    }
    expect(within(article).getByRole('region', { name: /Status sumber data/ })).toHaveTextContent(
      `snap=${SNAPSHOT_22}`,
    );
  });
});

describe('technical detail is closed by default (refinement pass)', () => {
  it('shows indicator names, and opens definition, formula and unit per indicator on demand', async () => {
    const user = userEvent.setup();
    renderRegion();
    const article = await findRegion();
    const indicators = within(article).getByRole('region', { name: /Indikator, kelas bukti/ });
    const toggles = within(indicators).getAllByRole('button', {
      name: /^Definisi( dan satuan|, rumus, dan satuan): /,
    });
    expect(toggles.length).toBeGreaterThan(10);
    const first = present(toggles[0]);
    const body = document.getElementById(present(first.getAttribute('aria-controls')));
    expect(first).toHaveAttribute('aria-expanded', 'false');
    expect(body).toHaveAttribute('hidden');
    expect(body).toHaveTextContent('Satuan dari sumber:');
    await user.click(first);
    expect(body).not.toHaveAttribute('hidden');
    // The quality class stays visible as a tag; its meaning opens on demand.
    expect(within(indicators).getAllByRole('button', { name: /^Arti kelas bukti: / }).length).toBeGreaterThan(
      10,
    );
  });

  it('shows source metadata as chips and every limitation text under its title', async () => {
    renderRegion();
    const article = await findRegion();
    const sources = within(article).getByRole('region', { name: /^Sumber data/ });
    expect(within(sources).queryByRole('button', { name: /^Rincian teknis sumber/ })).toBeNull();
    expect(sources).toHaveTextContent('Lisensi:');
    expect(sources).toHaveTextContent('Dimuat ke Data Hub');
    const limits = within(article).getByRole('region', { name: /Batasan dan catatan/ });
    expect(within(limits).queryByRole('button', { name: /^Baca penjelasan/ })).toBeNull();
    // The first three items carry their full text in view.
    const shown = [...limits.querySelectorAll('li')].slice(0, 3);
    for (const item of shown) expect(item.querySelector('p')?.textContent.length ?? 0).toBeGreaterThan(20);
  });

  it('has no page-local glow: the shared app backdrop draws the Kaca lights', async () => {
    renderRegion();
    await findRegion();
    expect(document.querySelector('[class*="ambient"]')).toBeNull();
    expect(document.querySelector('[class*="glassBlobs"]')).toBeNull();
  });

  it('makes the whole limitations callout one link to #batasan', async () => {
    renderRegion();
    const article = await findRegion();
    const callout = within(article).getByRole('link', { name: /batasan berlaku untuk paspor ini/ });
    expect(callout).toHaveAttribute('href', '#batasan');
    expect(article.querySelector('#batasan')).not.toBeNull();
  });
});

describe('Kaca readability structure', () => {
  it('puts every reading card directly on the page: no glass panel inside another', async () => {
    renderLab(KMS_WEIGHTS, captured22NationalKms());
    const article = await findLab();
    const panels = [...article.querySelectorAll('[class*="surface"]')];
    expect(panels.length).toBeGreaterThan(8);
    for (const panel of panels) {
      expect(panel.parentElement?.closest('[class*="surface"]'), panel.className).toBeNull();
    }
  });
});

function present<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('expected a value');
  return value;
}
