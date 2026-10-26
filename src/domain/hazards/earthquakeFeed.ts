/**
 * Whether an earthquake feed may be shown, and how. Pure and deterministic: given what the Data Hub
 * declares about the data and the current time, it decides between official, stale, an explicitly
 * unverified developer preview, or withheld. Data that might be a local fixture is never presented
 * as official BMKG events.
 */

export type EarthquakeOriginInput = 'BMKG_LIVE' | 'BMKG_CACHE' | 'FIXTURE' | 'UNDECLARED';
export type FeedDisplay = 'OFFICIAL' | 'PREVIEW_UNVERIFIED' | 'WITHHELD';

/**
 * The Data Hub reuses one BMKG fetch for about a minute and the layer polls every two, so a last
 * successful fetch older than ten minutes (or older than the declared cache TTL, if longer) is stale
 * whatever the response says about itself.
 */
export const STALE_AFTER_MINUTES = 10;

export interface FeedAssessmentInput {
  readonly origin: EarthquakeOriginInput;
  /** When the Data Hub last fetched BMKG successfully (ISO), if it says. */
  readonly lastSuccessAt: string | null;
  /** The Data Hub's own `is_stale` flag; `null` when it does not say. */
  readonly declaredStale: boolean | null;
  readonly cacheTtlSeconds: number | null;
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

/**
 * Freshness from what the Data Hub declares and what its timestamp shows. Serving from its cache is
 * not stale by itself (`bmkg_cache` with `is_stale: false` is a normal, fresh answer); any explicit
 * stale flag, fallback header, missing timestamp or old timestamp is.
 */
function staleReasons(input: FeedAssessmentInput, fallback: string, ageMinutes: number | null): string[] {
  const reasons: string[] = [];
  if (input.declaredStale === true) {
    reasons.push('Data Hub menandai data ini usang: pengambilan terbaru dari BMKG belum berhasil.');
  }
  if (fallback !== 'NONE' && fallback !== '') {
    reasons.push('Data Hub menyajikan data pengganti, bukan pengambilan terbaru dari BMKG.');
  }
  const staleAfter = Math.max(STALE_AFTER_MINUTES, (input.cacheTtlSeconds ?? 0) / 60);
  if (ageMinutes === null) {
    reasons.push('Waktu pengambilan terakhir yang berhasil dari BMKG tidak disebutkan.');
  } else if (ageMinutes > staleAfter) {
    reasons.push(
      `Data terakhir berhasil diambil dari BMKG sekitar ${String(Math.round(ageMinutes))} menit lalu.`,
    );
  }
  return reasons;
}

export function assessEarthquakeFeed(input: FeedAssessmentInput): FeedAssessment {
  const successMs = input.lastSuccessAt === null ? Number.NaN : Date.parse(input.lastSuccessAt);
  const ageMinutes = Number.isNaN(successMs) ? null : Math.max(0, (input.now.getTime() - successMs) / 60_000);
  const fallback = input.fallbackHeader?.trim().toUpperCase() ?? 'NONE';

  if (input.origin === 'FIXTURE' || FIXTURE_FALLBACK.test(fallback)) {
    return {
      display: 'WITHHELD',
      isStale: true,
      ageMinutes,
      reasons: ['Data Hub menyatakan data ini berasal dari fixture lokal, bukan peristiwa BMKG.'],
    };
  }

  const reasons = staleReasons(input, fallback, ageMinutes);
  const isStale = reasons.length > 0;

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
