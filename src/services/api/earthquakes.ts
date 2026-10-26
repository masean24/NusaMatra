/**
 * BMKG earthquake feed from the Data Hub (`GET /api/v1/earthquakes/geojson`): validated at the
 * boundary into plain values. Strings from the feed are kept as text and only ever rendered by
 * React; derived fields the Data Hub adds (`severity`, `tsunami_risk`, `visual_color`,
 * `visual_radius_px`) are dropped, because they are not BMKG statements.
 */
import { ApiError } from './apiError';
import type { HttpResponseContext } from './httpClient';
import type { DataMode } from './wireTypes';

/** Where the Data Hub says the events came from. `UNDECLARED` = it does not say. */
export type EarthquakeOrigin = 'BMKG_LIVE' | 'BMKG_CACHE' | 'FIXTURE' | 'UNDECLARED';

export interface EarthquakeEventDTO {
  readonly id: string;
  /** ISO 8601 instant as sent by the source; never synthesised. */
  readonly occurredAt: string;
  /** BMKG's own local-time strings, shown as sent ("21 Okt 2026", "18:58:36 WIB"). */
  readonly localDate: string | null;
  readonly localTime: string | null;
  readonly magnitude: number;
  readonly depthKm: number | null;
  readonly longitude: number;
  readonly latitude: number;
  readonly area: string | null;
  /** BMKG's own tsunami/potency statement, verbatim. */
  readonly potency: string | null;
  /** Felt reports (MMI with places), verbatim. */
  readonly felt: string | null;
  readonly shakemapUrl: string | null;
  readonly source: string;
}

export interface EarthquakeFeedDTO {
  readonly events: readonly EarthquakeEventDTO[];
  readonly origin: EarthquakeOrigin;
  /** When the Data Hub last fetched BMKG successfully (`metadata.last_success_at`), if it says. */
  readonly lastSuccessAt: string | null;
  /** The Data Hub's own freshness verdict (`metadata.is_stale`); `null` when it does not say. */
  readonly declaredStale: boolean | null;
  /** How long the Data Hub reuses one BMKG fetch (`metadata.cache_ttl_seconds`), if it says. */
  readonly cacheTtlSeconds: number | null;
  readonly sourcePortal: string | null;
  /** Response headers that describe the data. */
  readonly serverMode: string | null;
  readonly dataFallback: string | null;
  /** Features dropped because they failed validation (never repaired or guessed). */
  readonly rejectedCount: number;
  readonly receivedAt: string;
}

/** Plausible box around Indonesia's seismic monitoring area; anything outside is rejected, not clipped. */
const LON_RANGE = [85, 150] as const;
const LAT_RANGE = [-20, 15] as const;
const SHAKEMAP_HOST = 'data.bmkg.go.id';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
const finite = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

function readOrigin(metadata: Record<string, unknown>): EarthquakeOrigin {
  // Data Hub contract (backend e672231): bmkg_live | bmkg_cache | fixture. Anything else is undeclared.
  const declared = text(metadata.data_origin)?.toLowerCase();
  if (declared === 'bmkg_live') return 'BMKG_LIVE';
  if (declared === 'bmkg_cache') return 'BMKG_CACHE';
  if (declared === 'fixture') return 'FIXTURE';
  return 'UNDECLARED';
}

function instant(value: unknown): string | null {
  const raw = text(value);
  return raw && !Number.isNaN(Date.parse(raw)) ? raw : null;
}

function safeShakemap(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && url.hostname === SHAKEMAP_HOST ? url.href : null;
  } catch {
    return null;
  }
}

function toEvent(feature: unknown): EarthquakeEventDTO | null {
  if (!isRecord(feature) || !isRecord(feature.geometry) || !isRecord(feature.properties)) return null;
  const { geometry, properties } = feature;
  if (geometry.type !== 'Point' || !Array.isArray(geometry.coordinates)) return null;
  const longitude = finite(geometry.coordinates[0]);
  const latitude = finite(geometry.coordinates[1]);
  if (longitude === null || latitude === null) return null;
  if (longitude < LON_RANGE[0] || longitude > LON_RANGE[1]) return null;
  if (latitude < LAT_RANGE[0] || latitude > LAT_RANGE[1]) return null;

  const id = text(properties.id) ?? text(feature.id);
  const occurredAt = text(properties.datetime);
  const magnitude = finite(properties.magnitude);
  if (!id || !occurredAt || Number.isNaN(Date.parse(occurredAt)) || magnitude === null) return null;

  return {
    id,
    occurredAt,
    localDate: text(properties.date),
    localTime: text(properties.time),
    magnitude,
    depthKm: finite(properties.depth_km),
    longitude,
    latitude,
    area: text(properties.area),
    potency: text(properties.potency),
    felt: text(properties.felt),
    shakemapUrl: safeShakemap(properties.shakemap_url),
    source: text(properties.source) ?? 'tidak disebutkan',
  };
}

export function mapEarthquakeFeed(
  raw: unknown,
  context: HttpResponseContext,
  requestedMode: DataMode,
): EarthquakeFeedDTO {
  if (!isRecord(raw) || raw.type !== 'FeatureCollection' || !Array.isArray(raw.features)) {
    throw new ApiError(500, 'MALFORMED_ENVELOPE', context.requestId, 'network.unavailable', {
      serverMessage: 'Earthquake feed must be a GeoJSON FeatureCollection',
    });
  }
  const serverMode = context.serverMode?.toUpperCase() ?? null;
  if (serverMode !== null && serverMode !== requestedMode) {
    throw new ApiError(409, 'MODE_MISMATCH', context.requestId, 'data.live_unavailable', {
      serverMessage: `Earthquake feed answered ${serverMode} for a ${requestedMode} request`,
    });
  }

  const metadata = isRecord(raw.metadata) ? raw.metadata : {};
  const seen = new Set<string>();
  const events: EarthquakeEventDTO[] = [];
  let rejectedCount = 0;
  for (const feature of raw.features) {
    const event = toEvent(feature);
    if (!event || seen.has(event.id)) {
      rejectedCount += 1;
      continue;
    }
    seen.add(event.id);
    events.push(event);
  }
  events.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));

  const ttl = finite(metadata.cache_ttl_seconds);
  return {
    events,
    origin: readOrigin(metadata),
    // Older responses only carried `cached_at`; it means the same instant.
    lastSuccessAt: instant(metadata.last_success_at) ?? instant(metadata.cached_at),
    declaredStale: typeof metadata.is_stale === 'boolean' ? metadata.is_stale : null,
    cacheTtlSeconds: ttl !== null && ttl >= 0 ? ttl : null,
    sourcePortal: text(metadata.source_portal),
    serverMode,
    dataFallback: context.dataFallback,
    rejectedCount,
    receivedAt: context.clientReceivedAt,
  };
}
