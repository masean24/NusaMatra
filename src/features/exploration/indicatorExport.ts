import type { DataHubIndicatorDTO, IndicatorValuesMapDTO } from '@/services/api';
import { t } from '@/lib/i18n';

/** What a downloaded file says about itself, so it can still be traced once it leaves the site. */
const COPY_NOTE = t(
  'Salinan dari Data Hub Nusa Matra, bukan berkas asli penerbit. Periksa angka pada sumber resmi sebelum mengutip.',
);

const CSV_COLUMNS = [
  'kode_wilayah',
  'nama_wilayah',
  'indikator_id',
  'indikator',
  'satuan',
  'tahun',
  'status',
  'nilai',
  'skor_ternormalisasi',
  'persentil',
  'peringkat',
  'penanda_kualitas',
  'dataset_id',
  'rujukan_sumber',
  'versi_data',
  'mode',
] as const;

export interface IndicatorExportInput {
  readonly indicator: DataHubIndicatorDTO;
  readonly referenceYear: number | null;
  readonly values: IndicatorValuesMapDTO;
  /** Region names by code; a code without a name stays in the file with an empty name. */
  readonly regionNames: ReadonlyMap<string, string>;
}

function exportRows({ indicator, referenceYear, values, regionNames }: IndicatorExportInput) {
  return Object.values(values.valuesByRegion)
    .sort((a, b) => a.regionId.localeCompare(b.regionId))
    .map((cell) => ({
      kode_wilayah: cell.regionId,
      nama_wilayah: regionNames.get(cell.regionId) ?? null,
      indikator_id: indicator.indicatorId,
      indikator: indicator.labelId,
      satuan: indicator.unitCode || null,
      tahun: referenceYear,
      status: cell.value.status,
      // null, never 0: an unavailable value stays unavailable in the file.
      nilai: cell.value.decimal,
      skor_ternormalisasi: cell.normalizedScoreDecimal,
      persentil: cell.percentileDecimal,
      peringkat: cell.rank,
      penanda_kualitas: cell.qualityFlag,
      dataset_id: cell.datasetId,
      rujukan_sumber: cell.sourceRecordRef,
      versi_data: values.snapshotId,
      mode: values.dataMode,
    }));
}

/** A spreadsheet runs a cell starting with these as a formula; a source's text must stay text. */
const FORMULA_START = /^[=+\-@\t\r]/;

function csvCell(value: string | number | null, column: string): string {
  if (value === null) return '';
  const text = String(value);
  const numeric = typeof value === 'number' || column === 'nilai';
  const safe = !numeric && FORMULA_START.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

/** UTF-8 with a byte order mark and a decimal point, so spreadsheets read names and numbers alike. */
export function indicatorCsv(input: IndicatorExportInput): string {
  const lines = exportRows(input).map((row) =>
    CSV_COLUMNS.map((column) => csvCell(row[column], column)).join(','),
  );
  return `${BYTE_ORDER_MARK}${[CSV_COLUMNS.join(','), ...lines].join('\r\n')}\r\n`;
}

export function indicatorJson(input: IndicatorExportInput): string {
  const { indicator, referenceYear, values } = input;
  const { provenance } = indicator;
  return `${JSON.stringify(
    {
      produk: 'Nusa Matra',
      catatan: COPY_NOTE,
      versi_data: values.snapshotId,
      mode: values.dataMode,
      indikator: {
        id: indicator.indicatorId,
        nama: indicator.labelId,
        satuan: indicator.unitCode || null,
        tahun: referenceYear,
      },
      sumber: {
        lembaga: provenance.agencyCode,
        dataset_id: provenance.datasetId,
        judul: provenance.datasetTitle,
        tautan_resmi: provenance.officialPortalUrl,
      },
      nilai: exportRows(input),
    },
    null,
    2,
  )}\n`;
}

export const indicatorFilename = (
  indicatorId: string,
  snapshotId: string,
  extension: 'csv' | 'json',
): string => `nusa-matra-${indicatorId}-${snapshotId}.${extension}`;
