import type { CompositeEvidenceRecord } from './compositeTypes';
import { PASSPORT_PATH } from './evidenceQuery';
import type { EvidenceRecord } from './evidenceTypes';

export type AnyEvidenceRecord = EvidenceRecord | CompositeEvidenceRecord;

/** "62354dfa…87a984b5": the start and end of a digest; the full value is always kept next to it. */
export function shortDigest(digest: string): string {
  return digest.length > 20 ? `${digest.slice(0, 8)}…${digest.slice(-8)}` : digest;
}

const SHORT_DATE = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
const SHORT_TIME = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
  timeZoneName: 'short',
});
const FULL_TIME = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZoneName: 'short',
});

/** Browser receive time, compact: "24 Okt 2026 · 19.09 WIB" (`withSeconds`: "24 Okt 2026, 19.09.04 WIB"). */
export function formatReceived(iso: string | null, withSeconds = false): string {
  if (iso === null) return 'belum tersedia';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return withSeconds
    ? `${SHORT_DATE.format(date)}, ${FULL_TIME.format(date)}`
    : `${SHORT_DATE.format(date)} · ${SHORT_TIME.format(date)}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const SERVER_STAMP = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;

/**
 * A server timestamp written out as sent, never converted: "24 Okt 2026, 06.39.48". The zone is the
 * one the server stated (`UTC+00:00`), or `null` when it stated none, which the page then says.
 */
export function formatServerStamp(value: string | null): {
  readonly text: string;
  readonly zone: string | null;
} {
  if (value === null) return { text: 'belum tersedia', zone: null };
  const match = SERVER_STAMP.exec(value);
  if (!match) return { text: value, zone: null };
  const [, year, month, day, hour, minute, second, offset] = match;
  const text = `${String(Number(day))} ${MONTHS[Number(month) - 1] ?? month ?? ''} ${year ?? ''}, ${hour ?? ''}.${minute ?? ''}.${second ?? ''}`;
  if (!offset) return { text, zone: null };
  return { text, zone: offset === 'Z' ? 'UTC' : `UTC${offset}` };
}

const AGENCY_TILES: Readonly<Record<string, string>> = {
  KEMENKES: 'KMK',
  KEMENDIKDASMEN: 'KDM',
  KEMENKEU: 'KMU',
};

/** The short mark on a source's tile: the agency code itself when short, else a fixed abbreviation. */
export function agencyTile(code: string | null): string {
  if (!code) return '?';
  const upper = code.toUpperCase();
  return AGENCY_TILES[upper] ?? (upper.length <= 4 ? upper : upper.slice(0, 3));
}

/** The agencies a record's values come from, in first-seen order. */
export function agenciesOf(record: AnyEvidenceRecord): string[] {
  return [...new Set(record.sources.flatMap((source) => (source.agencyCode ? [source.agencyCode] : [])))];
}

export interface PageLink {
  readonly label: string;
  readonly to: string;
}

/** The big title of the hero: the region, the pair, or the Lab result. */
export function heroTitle(record: AnyEvidenceRecord): string {
  if (record.kind === 'lab') return 'Hasil Lab Prioritas';
  return record.regions.map((region) => region.name).join(' dan ');
}

/** The middle step of the breadcrumb: where this record's subject lives in the app. */
export function subjectCrumb(record: AnyEvidenceRecord): PageLink {
  if (record.kind === 'lab') return { label: 'Lab Prioritas', to: '/lab-prioritas' };
  const [first, second] = record.regions;
  if (record.kind === 'bandingkan' && first && second) {
    return { label: 'Bandingkan', to: `/bandingkan?a=${first.regionId}&b=${second.regionId}` };
  }
  return { label: first?.name ?? 'Wilayah', to: first ? `/jelajahi?kode=${first.regionId}` : '/jelajahi' };
}

/** Where to go next from this record. Every link opens a real page with the same subject. */
export function relatedLinks(record: AnyEvidenceRecord): PageLink[] {
  if (record.kind === 'lab') {
    const focus = record.focus?.name ? record.focus : null;
    return [
      { label: 'Ubah bobot di Lab Prioritas', to: '/lab-prioritas' },
      { label: 'Bandingkan dua wilayah', to: '/bandingkan' },
      focus
        ? { label: `Lihat ${focus.name ?? ''} di peta Jelajahi`, to: `/jelajahi?kode=${focus.regionId}` }
        : { label: 'Lihat di peta Jelajahi', to: '/jelajahi' },
    ];
  }
  const [first, second] = record.regions;
  const id = first?.regionId;
  return [
    record.kind === 'bandingkan' && first && second
      ? { label: 'Buka perbandingan ini', to: `/bandingkan?a=${first.regionId}&b=${second.regionId}` }
      : { label: 'Bandingkan dengan wilayah lain', to: id ? `/bandingkan?a=${id}` : '/bandingkan' },
    { label: 'Uji di Lab Prioritas', to: '/lab-prioritas' },
    { label: 'Lihat di peta Jelajahi', to: id ? `/jelajahi?kode=${id}` : '/jelajahi' },
  ];
}

export const PASSPORT_CRUMB = { label: 'Paspor Bukti', to: PASSPORT_PATH } as const;
