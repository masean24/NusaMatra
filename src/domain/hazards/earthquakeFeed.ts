/**
 * Whether an earthquake feed may be shown, and how. Pure and deterministic: given what the Data Hub
 * declares about the data and the current time, it decides between official, stale, an explicitly
 * unverified developer preview, or withheld. Data that might be a local fixture is never presented
 * as official BMKG events.
 */

export type EarthquakeOriginInput = 'BMKG_LIVE' | 'BMKG_CACHE' | 'FIXTURE' | 'UNDECLARED';
export type FeedDisplay = 'OFFICIAL' | 'PREVIEW_UNVERIFIED' | 'WITHHELD';

/** The Data Hub caches BMKG for about a minute; ten minutes without a refresh counts as stale. */
export const STALE_AFTER_MINUTES = 10;

export interface FeedAssessmentInput {
  readonly origin: EarthquakeOriginInput;
  /** When the Data Hub last fetched BMKG (ISO), if it says. */
  readonly cachedAt: string | null;
  /** The `X-Data-Fallback` response header, if any. */
  readonly fallbackHeader: string | null;
  readonly now: Date;
  /** Build-time opt-in for reviewing the layer while the Data Hub does not declare its origin. */
  readonly allowUnverifiedPreview: boolean;
}

export interface FeedAssessment {
  readonly display: FeedDisplay;
  readonly isStale: boolean;
  /** Minutes since the Data Hub last fetched BMKG; `null` when it does not say. */
  readonly ageMinutes: number | null;
  /** Indonesian, shown to the user. */
  readonly reasons: readonly string[];
}

const FIXTURE_FALLBACK = /FIXTURE|DEMO|LOCAL|SYNTHETIC/i;

export function assessEarthquakeFeed(input: FeedAssessmentInput): FeedAssessment {
  const reasons: string[] = [];
  const cachedMs = input.cachedAt === null ? Number.NaN : Date.parse(input.cachedAt);
  const ageMinutes = Number.isNaN(cachedMs) ? null : Math.max(0, (input.now.getTime() - cachedMs) / 60_000);
  const fallback = input.fallbackHeader?.trim().toUpperCase() ?? 'NONE';

  if (input.origin === 'FIXTURE' || FIXTURE_FALLBACK.test(fallback)) {
    return {
      display: 'WITHHELD',
      isStale: true,
      ageMinutes,
      reasons: ['Data Hub menyatakan data ini berasal dari fixture lokal, bukan peristiwa BMKG.'],
    };
  }

  let isStale = input.origin === 'BMKG_CACHE' || (fallback !== 'NONE' && fallback !== '');
  if (ageMinutes === null) {
    isStale = true;
    reasons.push('Waktu pembaruan terakhir dari BMKG tidak disebutkan.');
  } else if (ageMinutes > STALE_AFTER_MINUTES) {
    isStale = true;
    reasons.push(`Data terakhir diambil dari BMKG sekitar ${String(Math.round(ageMinutes))} menit lalu.`);
  } else if (isStale) {
    reasons.push('Data Hub menyajikan salinan cache, bukan pengambilan terbaru dari BMKG.');
  }

  if (input.origin === 'UNDECLARED') {
    const undeclared =
      'Data Hub belum menyatakan apakah data ini langsung dari BMKG, dari cache, atau dari fixture lokal.';
    return input.allowUnverifiedPreview
      ? { display: 'PREVIEW_UNVERIFIED', isStale, ageMinutes, reasons: [undeclared, ...reasons] }
      : { display: 'WITHHELD', isStale, ageMinutes, reasons: [undeclared, ...reasons] };
  }

  return { display: 'OFFICIAL', isStale, ageMinutes, reasons };
}

/**
 * Size of an epicentre symbol in map units. A visual cue for magnitude only: it is not an area of
 * impact, shaking or damage, and is shown with that caveat.
 */
export function epicentreSymbolSize(magnitude: number): number {
  const clamped = Math.min(8, Math.max(2, magnitude));
  return 0.16 + (clamped - 2) * 0.06;
}
