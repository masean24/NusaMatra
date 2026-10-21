import type { AdminLevel, ObservationValue, PreferredDirection } from '@/services/api';

const NUMBER_FORMAT = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

/** "70.6875" → "70,69". Decimal strings the API sends stay untouched when they are not numbers. */
export function formatDecimalId(decimal: string): string {
  const value = Number(decimal);
  return Number.isFinite(value) ? NUMBER_FORMAT.format(value) : decimal;
}

/** A measured 0 is a value ("0"); a missing value is never shown as 0 (API-INV-03). */
export function describeObservation(value: ObservationValue): string {
  switch (value.status) {
    case 'AVAILABLE':
      return formatDecimalId(value.decimal);
    case 'MISSING':
      return 'Data belum tersedia';
    case 'SUPPRESSED':
      return 'Nilai tidak dipublikasikan oleh sumber';
  }
}

const QUALITY_FLAG_NOTE: Readonly<Record<string, string>> = {
  IMPUTED_PROVINCE: 'Diimputasi dari nilai tingkat provinsi, bukan pengukuran kabupaten/kota',
};

/**
 * What a reader must know about a value's quality flag. `VERIFIED` and `DEMO_EXAMPLE` need no note
 * here (DEMO has its own badge); any other flag is shown as sent rather than hidden.
 */
export function qualityFlagNote(flag: string | null): string | null {
  if (flag === null || flag === 'VERIFIED' || flag === 'DEMO_EXAMPLE') return null;
  return QUALITY_FLAG_NOTE[flag] ?? `Penanda kualitas dari sumber: ${flag}`;
}

/** Only real web links are made clickable; `internal://…` and anything else stay plain text. */
export function publicHttpUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
  } catch {
    return null;
  }
}

const ADMIN_LEVEL_LABEL: Readonly<Record<AdminLevel, string>> = {
  PROVINCE: 'Provinsi',
  REGENCY: 'Kabupaten',
  CITY: 'Kota',
};

export function adminLevelLabel(level: AdminLevel): string {
  return ADMIN_LEVEL_LABEL[level];
}

const DIRECTION_LABEL: Readonly<Record<PreferredDirection, string>> = {
  HIGHER_IS_WORSE: 'Semakin tinggi, semakin buruk',
  HIGHER_IS_BETTER: 'Semakin tinggi, semakin baik',
  CONTEXTUAL: 'Arti nilai tinggi bergantung pada konteks',
  UNAPPROVED: 'Arah penilaian belum disetujui',
};

export function preferredDirectionLabel(direction: PreferredDirection): string {
  return DIRECTION_LABEL[direction];
}

const CATEGORY_LABEL: Readonly<Record<string, string>> = {
  data_reliability: 'Keandalan data',
  disaster_risk: 'Risiko bencana',
  education_access: 'Akses pendidikan',
  healthcare_access: 'Akses kesehatan',
  infrastructure: 'Infrastruktur',
  socioeconomic: 'Sosial ekonomi',
};

/** Interface label for the backend's category key; unknown keys are shown humanised, not hidden. */
export function categoryLabel(category: string): string {
  const known = CATEGORY_LABEL[category];
  if (known) return known;
  const spaced = category.replaceAll('_', ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
