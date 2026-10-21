/**
 * Turns the Data Hub's unit string into what the UI shows, and checks it against the values it
 * describes. The raw values are never changed: a unit whose declared range the data exceeds is
 * shown without that range, with a warning, instead of being "corrected".
 */

export type UnitKind = 'percent' | 'years' | 'score' | 'index' | 'count' | 'currency' | 'ratio' | 'other';

export interface DisplayUnit {
  /** Short Indonesian label placed after the number; empty when the unit is unknown. */
  readonly label: string;
  readonly kind: UnitKind;
  /** Set when the source's declared unit contradicts its own values. */
  readonly warning: string | null;
}

const KNOWN_UNITS: Readonly<Record<string, { label: string; kind: UnitKind }>> = {
  'percent (%)': { label: '%', kind: 'percent' },
  years: { label: 'tahun', kind: 'years' },
  minutes: { label: 'menit', kind: 'other' },
  events: { label: 'kejadian', kind: 'count' },
  'per 10k pop': { label: 'per 10.000 penduduk', kind: 'count' },
  'doctors per 10k pop': { label: 'dokter per 10.000 penduduk', kind: 'count' },
  'facilities per 10k pop': { label: 'fasilitas per 10.000 penduduk', kind: 'count' },
  'students per teacher': { label: 'murid per guru', kind: 'ratio' },
  'ratio per 100 working-age': { label: 'per 100 penduduk usia produktif', kind: 'ratio' },
  'thousand IDR/person/year': { label: 'ribu rupiah per orang per tahun', kind: 'currency' },
  index: { label: 'indeks', kind: 'index' },
};

const RANGE_PATTERN = /^(score|index)\s*\(\s*(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)\s*\)$/i;

const formatBound = (value: number) => String(value).replace('.', ',');

/**
 * @param observedMax the largest value the source reports for this indicator (catalog `stats.max`,
 *   or the value being shown); `null` when unknown.
 */
export function describeUnit(unit: string, observedMax: number | null): DisplayUnit {
  const range = RANGE_PATTERN.exec(unit.trim());
  if (range) {
    const kind: UnitKind = range[1]?.toLowerCase() === 'score' ? 'score' : 'index';
    const noun = kind === 'score' ? 'skor' : 'indeks';
    const low = Number(range[2]);
    const high = Number(range[3]);
    if (observedMax !== null && observedMax > high) {
      return {
        label: noun,
        kind,
        warning:
          `Sumber menyebut skala ${formatBound(low)}–${formatBound(high)}, tetapi nilainya mencapai ` +
          `${formatBound(observedMax)}. Skala yang sebenarnya belum dijelaskan sumber; nilai ditampilkan apa adanya.`,
      };
    }
    return { label: `${noun} (${formatBound(low)}–${formatBound(high)})`, kind, warning: null };
  }

  const known = KNOWN_UNITS[unit.trim()];
  if (known) return { ...known, warning: null };
  return { label: unit.trim(), kind: 'other', warning: null };
}
