import type {
  DataHubIndicatorDTO,
  IndicatorValuesMapDTO,
  RegionIndicatorMeasurementDTO,
} from '@/services/api';
import { indicatorCsv, indicatorFilename, indicatorJson, type IndicatorExportInput } from './indicatorExport';

const cell = (
  regionId: string,
  value: RegionIndicatorMeasurementDTO['value'],
  sourceRecordRef: string | null = null,
) =>
  ({
    regionId,
    value,
    normalizedScoreDecimal: null,
    percentileDecimal: null,
    rank: null,
    qualityFlag: 'VERIFIED',
    datasetId: 'bps_ipm_2025',
    sourceRecordRef,
  }) as RegionIndicatorMeasurementDTO;

const input: IndicatorExportInput = {
  indicator: {
    indicatorId: 'soc_hdi',
    labelId: 'Indeks, "Pembangunan"',
    unitCode: 'skor',
    provenance: {
      agencyCode: 'BPS',
      datasetId: 'bps_ipm_2025',
      datasetTitle: 'IPM 2025',
      officialPortalUrl: 'https://www.bps.go.id/x',
      sourceLinkLevel: 'publication',
      sourceNoteIdn: 'Publikasi IPM 2025.',
      sourceNoteEn: 'IPM 2025 publication.',
    },
  } as unknown as DataHubIndicatorDTO,
  referenceYear: 2025,
  values: {
    snapshotId: 'snap-1',
    dataMode: 'LIVE',
    valuesByRegion: {
      '3203': cell('3203', { status: 'MISSING', decimal: null, reasonCode: 'X' }),
      '1101': cell('1101', { status: 'AVAILABLE', decimal: '-72.79' }, '=SUM(A1)'),
    },
  } as unknown as IndicatorValuesMapDTO,
  regionNames: new Map([['1101', 'Kabupaten Aceh Selatan']]),
  referenceVersion: '2026-11-sources-1',
};

describe('indicator export', () => {
  const lines = indicatorCsv(input).trim().split('\r\n');

  it('writes one row per region in code order, and keeps a missing value empty instead of 0', () => {
    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatch(/^1101,Kabupaten Aceh Selatan,/);
    expect(lines[2]).toMatch(/^3203,,/);
    expect(lines[2]).toContain(',MISSING,,');
  });

  it('quotes commas and quotes, keeps numbers as numbers, and defuses formulas in text', () => {
    expect(lines[1]).toContain('"Indeks, ""Pembangunan"""');
    expect(lines[1]).toContain(',-72.79,');
    expect(lines[1]).toContain(",'=SUM(A1),");
  });

  it('names its source and says it is a copy, in JSON', () => {
    const json = JSON.parse(indicatorJson(input)) as {
      catatan: string;
      sumber: Record<string, string>;
      nilai: { nilai: string | null }[];
    };
    expect(json.catatan).toMatch(/bukan berkas asli penerbit/);
    expect(json.sumber).toMatchObject({
      tautan_resmi: 'https://www.bps.go.id/x',
      tingkat_tautan: 'publication',
      catatan: 'Publikasi IPM 2025.',
      versi_referensi: '2026-11-sources-1',
    });
    expect(json.nilai.map((row) => row.nilai)).toEqual(['-72.79', null]);
  });

  it('names the file after the product, the indicator and the data version', () => {
    expect(indicatorFilename('soc_hdi', 'snap-1', 'csv')).toBe('nusa-matra-soc_hdi-snap-1.csv');
  });
});
