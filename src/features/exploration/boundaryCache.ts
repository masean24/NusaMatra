import type {
  AdaptedEnvelope,
  BoundaryCollectionDTO,
  DataMode,
  NusaMatraDataHubRepository,
} from '@/services/api';

/**
 * The kabupaten/kota boundary collection is ~5 MB and costs about a second of main-thread work to
 * decode. The map and the boundary notice both need it, and it does not change within a session
 * (the snapshot is fixed), so every consumer shares one request per repository and mode: no
 * duplicate download, no repeated decode, and returning to the page costs nothing. A failed
 * request is not kept, so "Coba lagi" really retries. Modes never share an entry.
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
  const request = repository.getBoundaries({ dataMode, adminLevel: 'REGENCY' });
  byMode.set(dataMode, request);
  request.catch(() => {
    if (byMode.get(dataMode) === request) byMode.delete(dataMode);
  });
  return request;
}
