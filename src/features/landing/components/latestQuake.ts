import { assessEarthquakeFeed } from '@/domain/hazards';
import { HERO_ORIGIN, lonLatToPlane, projectToHeroFrame } from '@/lib/heroMapCamera';
import type { EarthquakeEventDTO, EarthquakeFeedDTO } from '@/services/api';
import { locale, t } from '@/lib/i18n';

/** The newest BMKG earthquake and where its epicentre lands in the hero zone (0–1 from the top left). */
export interface HeroQuake {
  readonly event: EarthquakeEventDTO;
  readonly u: number;
  readonly v: number;
}

/** A marker this close to an edge of the zone would be cut off; such an event is not shown. */
const EDGE = 0.03;

/**
 * The one earthquake the hero shows: the newest in the feed, and only when the feed is the official
 * BMKG one and fresh (the same checks as the Jelajahi layer). Anything else shows nothing, so the
 * hero never presents unverified or stale data as current.
 */
export function latestQuakeForHero(
  feed: EarthquakeFeedDTO,
  now: Date,
  allowUnverifiedPreview: boolean,
): HeroQuake | null {
  const assessment = assessEarthquakeFeed({
    origin: feed.origin,
    lastSuccessAt: feed.lastSuccessAt,
    declaredStale: feed.declaredStale,
    cacheTtlSeconds: feed.cacheTtlSeconds,
    fallbackHeader: feed.dataFallback,
    now,
    allowUnverifiedPreview,
  });
  if (assessment.display !== 'OFFICIAL' || assessment.isStale) return null;

  let latest: EarthquakeEventDTO | null = null;
  for (const event of feed.events) {
    const time = Date.parse(event.occurredAt);
    if (Number.isNaN(time)) continue;
    if (!latest || time > Date.parse(latest.occurredAt)) latest = event;
  }
  if (!latest) return null;

  const { x, z } = lonLatToPlane(latest.longitude, latest.latitude, HERO_ORIGIN);
  const { u, v } = projectToHeroFrame([x, 0, z]);
  if (u < EDGE || u > 1 - EDGE || v < EDGE || v > 1 - EDGE) return null;
  return { event: latest, u, v };
}

/** "M 5,1": the short form; the full word is in the sentence screen readers get. */
export function quakeMagnitude(magnitude: number): string {
  return `M ${magnitude.toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
}

/** "2 jam yang lalu", from the event's own time. */
export function quakeTimeAgo(occurredAt: string, nowMs: number): string {
  const elapsed = nowMs - Date.parse(occurredAt);
  if (Number.isNaN(elapsed)) return '';
  if (elapsed < 60_000) return t('Baru saja');
  const relative = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
  if (elapsed < 3_600_000) return relative.format(-Math.floor(elapsed / 60_000), 'minute');
  if (elapsed < 86_400_000) return relative.format(-Math.floor(elapsed / 3_600_000), 'hour');
  return relative.format(-Math.floor(elapsed / 86_400_000), 'day');
}
