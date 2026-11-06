import { describeResultStatus, type ResultFacts } from './resultStatus';

const clean: ResultFacts = {
  stale: false,
  directionCheckFailed: false,
  requestedWeightAvailabilityPct: 100,
  partialRegions: 0,
  imputedRegions: 0,
  insufficientRegions: 0,
  unlistedRegions: 0,
  unverifiedDirectionLabels: [],
  nationalRankWithheldRegions: [],
};

describe('describeResultStatus', () => {
  it('calls a result fully checked only when nothing limits it', () => {
    expect(describeResultStatus(clean)).toEqual({
      trust: 'verified',
      tone: 'ok',
      title: 'Hasil lolos semua pemeriksaan',
      limitations: [],
    });
  });

  it.each<[string, Partial<ResultFacts>, RegExp]>([
    ['national gap', { requestedWeightAvailabilityPct: 75 }, /senilai 25% dari bobot Anda belum punya data/],
    ['provincial estimate', { imputedRegions: 510 }, /510 wilayah memakai estimasi tingkat provinsi/],
    ['partial coverage', { partialRegions: 3 }, /3 wilayah dihitung dari sebagian kriteria/],
    ['regions left out', { insufficientRegions: 4 }, /4 wilayah tidak diperingkat/],
    ['regions unlisted', { unlistedRegions: 2 }, /2 wilayah lain tidak tercantum/],
    [
      'unverified direction',
      { unverifiedDirectionLabels: ['Listrik'] },
      /belum terverifikasi penuh.*Listrik/,
    ],
    ['national rank withheld', { nationalRankWithheldRegions: ['Kota A'] }, /Peringkat nasional.*Kota A/],
  ])('never presents a result with a %s as fully checked', (_, facts, wording) => {
    const status = describeResultStatus({ ...clean, ...facts });
    expect(status.trust).toBe('limited');
    expect(status.tone).toBe('warning');
    expect(status.title).toBe('Hasil dapat dibaca dengan catatan');
    expect(status.limitations.join(' ')).toMatch(wording);
  });

  it('says one sentence per limit, without repeating any', () => {
    const { limitations } = describeResultStatus({
      ...clean,
      requestedWeightAvailabilityPct: 75,
      imputedRegions: 510,
      insufficientRegions: 4,
    });
    expect(limitations).toHaveLength(3);
    expect(new Set(limitations).size).toBe(3);
  });

  it('treats an unknown availability as no claim, not as a limit', () => {
    expect(describeResultStatus({ ...clean, requestedWeightAvailabilityPct: null }).trust).toBe('verified');
  });

  it('says the check did not finish when the direction check failed', () => {
    const status = describeResultStatus({ ...clean, directionCheckFailed: true });
    expect(status.trust).toBe('unfinished');
    expect(status.tone).toBe('warning');
    expect(status.title).toBe('Pemeriksaan hasil belum selesai');
  });

  it('puts stale first, and keeps the limits of the list still on screen', () => {
    const status = describeResultStatus({
      ...clean,
      stale: true,
      directionCheckFailed: true,
      imputedRegions: 1,
    });
    expect(status.trust).toBe('stale');
    expect(status.title).toBe('Peringkat belum memakai bobot terbaru');
    expect(status.limitations).toHaveLength(2);
  });
});
