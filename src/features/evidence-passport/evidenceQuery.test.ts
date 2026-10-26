import { parseEvidenceQuery, passportHref, type EvidenceQuery } from './evidenceQuery';

const parse = (href: string) => parseEvidenceQuery(new URL(href, 'https://nusa.test').searchParams);

describe('passportHref', () => {
  it('builds the documented, stable link for a region', () => {
    expect(passportHref({ kind: 'wilayah', regionId: '3201', mode: 'LIVE', snapshotId: 'snap-1' })).toBe(
      '/paspor-bukti?jenis=wilayah&mode=live&snap=snap-1&kode=3201',
    );
  });

  it('builds a comparison link with region A before B and omits absent context', () => {
    expect(passportHref({ kind: 'bandingkan', regionA: '3201', regionB: '3374' })).toBe(
      '/paspor-bukti?jenis=bandingkan&a=3201&b=3374',
    );
  });

  it('sorts Lab weights so equal requests give equal links, and drops zero weights', () => {
    const href = passportHref({
      kind: 'lab',
      weights: { soc_hdi: 6000, dis_multihazard_index: 4000, unused: 0 },
      provinceId: '33',
      focusRegionId: '3372',
    });
    expect(href).toBe(
      '/paspor-bukti?jenis=lab&bobot=dis_multihazard_index%3A4000%2Csoc_hdi%3A6000&prov=33&kode=3372',
    );
  });

  it.each<EvidenceQuery>([
    {
      kind: 'wilayah',
      regionId: '1101',
      mode: 'DEMO',
      snapshotId: 's',
      indicatorIds: ['soc_hdi', 'soc_poverty_rate'],
    },
    { kind: 'bandingkan', regionA: '1101', regionB: '1102', mode: 'LIVE' },
    {
      kind: 'lab',
      weights: { a: 5000, b: 5000 },
      mode: 'LIVE',
      snapshotId: 'x',
      provinceId: '33',
      focusRegionId: '3372',
    },
  ])('round-trips %j through the parser', (query) => {
    const parsed = parse(passportHref(query));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.query).toMatchObject(query);
  });
});

describe('parseEvidenceQuery', () => {
  it.each([
    ['', 'jenis'],
    ['?jenis=aneh', 'tidak dikenal'],
    ['?jenis=wilayah', 'kode wilayah'],
    ['?jenis=wilayah&kode=../etc', 'tidak valid'],
    ['?jenis=wilayah&kode=1101&mode=prod', 'live'],
    ['?jenis=wilayah&kode=1101&snap=a b', 'snapshot'],
    ['?jenis=wilayah&kode=1101&ind=ok,bad id', 'indikator'],
    ['?jenis=bandingkan&a=1101', 'dua kode'],
    ['?jenis=bandingkan&a=1101&b=1101', 'berbeda'],
    ['?jenis=lab&bobot=a:5000,b:4000', '10.000'],
    ['?jenis=lab&bobot=a:5000,a:5000', '10.000'],
    ['?jenis=lab&bobot=a:5000,b:5000&prov=3', 'provinsi'],
  ])('rejects %s with a reason, never repairing it', (search, reasonPart) => {
    const parsed = parseEvidenceQuery(new URLSearchParams(search));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.message.toLowerCase()).toContain(reasonPart.toLowerCase());
  });

  it('treats the mode in the link as optional context', () => {
    const parsed = parseEvidenceQuery(new URLSearchParams('?jenis=wilayah&kode=1101'));
    expect(parsed.ok && parsed.query.mode).toBeNull();
  });
});
