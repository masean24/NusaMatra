import { getDeviceTier } from '@/features/graphics-quality';
import type {
  AdaptedEnvelope,
  BoundaryCollectionDTO,
  DataMode,
  NusaMatraDataHubRepository,
} from '@/services/api';

/** A touch screen of phone or small-tablet size: the map's own "phone" width. */
const SMALL_TOUCH_SCREEN_QUERY = '(pointer: coarse) and (width < 960px)';

/**
 * Which boundary detail this device loads: `mobile` (about 0.5 MB, against 1.6 MB for `low`) on a small
 * touch screen or a low-end device, where the download and the decoding are what keep the map waiting.
 * The regions, their codes and their data are the same; only the outlines are simpler.
 */
export function boundaryResolution(): 'low' | 'mobile' {
  const smallTouchScreen =
    typeof window.matchMedia === 'function' && window.matchMedia(SMALL_TOUCH_SCREEN_QUERY).matches;
  return smallTouchScreen || getDeviceTier() === 'low' ? 'mobile' : 'low';
}

/**
 * The kabupaten/kota boundary collection costs up to a second of main-thread work to decode. The map
 * and the boundary notice both need it, and it does not change within a session (the snapshot is
 * fixed), so every consumer shares one request per repository and mode: no duplicate download, no
 * repeated decode, and returning to the page costs nothing. The first request also fixes the detail,
 * so turning a phone does not download the boundaries again. A failed request is not kept, so "Coba
 * lagi" really retries. Modes never share an entry.
 */
const cache = new WeakMap<
  NusaMatraDataHubRepository,
  Map<DataMode, Promise<AdaptedEnvelope<BoundaryCollectionDTO>>>
>();

export function loadBoundaries(
  repository: NusaMatraDataHubRepository,
  dataMode: DataMode,
): Promise<AdaptedEnvelope<BoundaryCollectionDTO>> {
  const byMode =
    cache.get(repository) ?? new Map<DataMode, Promise<AdaptedEnvelope<BoundaryCollectionDTO>>>();
  cache.set(repository, byMode);

  const existing = byMode.get(dataMode);
  if (existing) return existing;

  // Not tied to one component's AbortSignal: other consumers (and later visits) reuse the result.
  // DEMO sends placeholder points, so only LIVE has outlines to lighten.
  const request = repository.getBoundaries({
    dataMode,
    adminLevel: 'REGENCY',
    resolution: dataMode === 'LIVE' ? boundaryResolution() : 'low',
  });
  byMode.set(dataMode, request);
  request.catch(() => {
    if (byMode.get(dataMode) === request) byMode.delete(dataMode);
  });
  return request;
}
