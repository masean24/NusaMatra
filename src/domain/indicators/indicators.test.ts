import { assessComparison, type ComparableMeasurement } from '@/domain/comparability';
import { describeUnit } from './units';
import { readComparison } from './interpretComparison';
import { DATA_HUB_PERCENTILE_ORIENTATION, readIndicator } from './interpretIndicator';

const fmt = (value: number, digits: number) => value.toFixed(digits).replace('.', ',');

describe('describeUnit', () => {
  it('shows the unit audited in the LIVE data: a 0.0–1.0 index that reaches 36 loses its range and warns', () => {
    const unit = describeUnit('index (0.0-1.0)', 36);
    expect(unit.label).toBe('indeks');
    expect(unit.warning).toMatch(/skala 0–1/);
    expect(unit.warning).toMatch(/mencapai 36/);
  });

  it('keeps a declared range the data respects', () => {
    expect(describeUnit('score (0-100)', 88.77)).toEqual({
      label: 'skor (0–100)',
      kind: 'score',
      warning: null,
    });
    expect(describeUnit('score (0-300)', 214.8).label).toBe('skor (0–300)');
  });

  it('translates known units and passes unknown ones through unchanged', () => {
    expect(describeUnit('percent (%)', null).label).toBe('%');
    expect(describeUnit('years', null).label).toBe('tahun');
    expect(describeUnit('thousand IDR/person/year', null).label).toBe('ribu rupiah per orang per tahun');
    expect(describeUnit('mystery unit', null).label).toBe('mystery unit');
  });
});

describe('readIndicator', () => {
  const base = {
    polarity: 'negative',
    percentile: 80,
    percentileOrientation: 'BETTER_SHARE',
    qualityFlag: 'VERIFIED',
    hasValue: true,
  } as const;

  it('calls a high better-share percentile favorable, for lower-is-better and higher-is-better alike', () => {
    expect(readIndicator(base).verdict).toBe('FAVORABLE');
    expect(readIndicator({ ...base, polarity: 'positive' }).verdict).toBe('FAVORABLE');
    expect(readIndicator(base).explanation).toMatch(/Lebih baik daripada sekitar 80%/);
  });

  it('calls a low percentile unfavorable and the middle neutral', () => {
    expect(readIndicator({ ...base, percentile: 20 }).verdict).toBe('UNFAVORABLE');
    expect(readIndicator({ ...base, percentile: 50 }).verdict).toBe('NEUTRAL');
    expect(readIndicator({ ...base, percentile: 33 }).verdict).toBe('UNFAVORABLE');
    expect(readIndicator({ ...base, percentile: 67 }).verdict).toBe('FAVORABLE');
  });

  it('makes no judgement without a defined polarity, a benchmark, a value, or a measured (not imputed) value', () => {
    expect(readIndicator({ ...base, polarity: 'context' }).verdict).toBe('NO_JUDGEMENT');
    expect(readIndicator({ ...base, percentile: null }).verdict).toBe('NO_JUDGEMENT');
    expect(readIndicator({ ...base, hasValue: false }).verdict).toBe('NO_JUDGEMENT');
    expect(readIndicator({ ...base, qualityFlag: 'IMPUTED_PROVINCE' }).verdict).toBe('NO_JUDGEMENT');
  });

  /**
   * Kabupaten Lanny Jaya (9507) as captured from the LIVE Data Hub v2.2
   * (src/services/api/__fixtures__/live-v2.2): among the worst-off regions on every indicator here.
   * IPM and sanitation are higher-is-better, poverty and stunting higher-is-worse.
   */
  const lannyJaya = [
    { id: 'soc_hdi', polarity: 'positive', raw: 51.59, percentile: 99.03 },
    { id: 'inf_safe_sanitation_pct', polarity: 'positive', raw: 5.58, percentile: 99.61 },
    { id: 'soc_poverty_rate', polarity: 'negative', raw: 31.59, percentile: 98.05 },
    { id: 'hlt_stunting_prevalence', polarity: 'negative', raw: 39.5, percentile: 97.12 },
  ] as const;

  it('Lanny Jaya regression: the shipped orientation draws no verdict from an undocumented percentile', () => {
    expect(DATA_HUB_PERCENTILE_ORIENTATION).toBe('UNVERIFIED');
    for (const indicator of lannyJaya) {
      const reading = readIndicator({
        ...base,
        polarity: indicator.polarity,
        percentile: indicator.percentile,
        percentileOrientation: DATA_HUB_PERCENTILE_ORIENTATION,
      });
      expect(reading, indicator.id).toMatchObject({ verdict: 'NO_JUDGEMENT', label: 'Tidak dinilai' });
      expect(reading.explanation).toMatch(/belum menjelaskan arah persentil/);
      expect(reading.explanation).not.toMatch(/lebih baik daripada/i);
    }
  });

  it('Lanny Jaya regression: read as a need share, a high percentile is unfavorable for both polarities', () => {
    for (const indicator of lannyJaya) {
      const reading = readIndicator({
        ...base,
        polarity: indicator.polarity,
        percentile: indicator.percentile,
        percentileOrientation: 'NEED_SHARE',
      });
      expect(reading.verdict, indicator.id).toBe('UNFAVORABLE');
      expect(reading.label).toBe('Relatif kurang baik');
      expect(reading.explanation).toMatch(/Hanya lebih baik daripada sekitar [0-3]% wilayah lain/);
    }
  });

  it('a need share and a better share of the same position give the same verdict', () => {
    expect(readIndicator({ ...base, percentileOrientation: 'NEED_SHARE', percentile: 20 })).toEqual(
      readIndicator({ ...base, percentileOrientation: 'BETTER_SHARE', percentile: 80 }),
    );
  });
});

describe('readComparison', () => {
  const measured = (
    value: number,
    overrides: Partial<ComparableMeasurement> = {},
  ): ComparableMeasurement => ({
    value,
    unit: 'years',
    referenceYear: 2025,
    datasetId: 'bps',
    qualityFlag: 'VERIFIED',
    ...overrides,
  });
  const read = (
    a: ComparableMeasurement,
    b: ComparableMeasurement,
    polarity: string,
    label = 'Harapan Lama Sekolah',
  ) =>
    readComparison({
      indicatorLabel: label,
      polarity,
      nameA: 'Palembang',
      nameB: 'Jakarta Pusat',
      assessment: assessComparison(a, b),
      unitLabel: 'tahun',
      useRatio: label !== 'Harapan Lama Sekolah',
      formatNumber: fmt,
    });

  it('explains a higher-is-better gap and names the better side by polarity', () => {
    const reading = read(measured(13.97), measured(13), 'positive');
    expect(reading?.sentence).toContain(
      'Harapan Lama Sekolah Palembang lebih tinggi 0,97 tahun dibanding Jakarta Pusat.',
    );
    expect(reading?.sentence).toContain('Nilai yang lebih tinggi menunjukkan kondisi yang lebih baik');
    expect(reading?.verdict).toBe('A_BETTER');
  });

  it('for a lower-is-better indicator the higher figure is the worse side', () => {
    const reading = read(
      measured(36, { unit: 'percent (%)' }),
      measured(18, { unit: 'percent (%)' }),
      'negative',
      'Risiko banjir',
    );
    expect(reading?.sentence).toContain('sekitar 2,0× lebih tinggi');
    expect(reading?.sentence).toContain('Nilai yang lebih rendah menunjukkan kondisi yang lebih baik');
    expect(reading?.verdict).toBe('B_BETTER');
  });

  it('names no better side when polarity is undefined', () => {
    const reading = read(measured(5), measured(3), 'context');
    expect(reading?.verdict).toBe('NO_JUDGEMENT');
    expect(reading?.sentence).toContain('tidak ada pihak yang dinilai lebih baik');
  });

  it('gives no reading for a blocked pair: different years, unknown year or province-imputed', () => {
    expect(read(measured(5, { referenceYear: 2021 }), measured(3), 'positive')).toBeNull();
    expect(read(measured(5, { referenceYear: null }), measured(3), 'positive')).toBeNull();
    expect(read(measured(5, { qualityFlag: 'IMPUTED_PROVINCE' }), measured(3), 'positive')).toBeNull();
  });
});
