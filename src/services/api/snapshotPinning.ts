/**
 * Snapshot pinning (Data Hub v2.2). A pinned request names its snapshot (`?snapshot=<id>`) and every
 * response must come back with the same id AND the same `content_sha256`. Nothing here falls back to
 * the latest snapshot: a pin the Data Hub cannot honour is an error.
 */
import { ApiError } from './apiError';
import type { AdaptedEnvelope, DataHubSnapshotDTO, SnapshotPin } from './wireTypes';

/** The query parameter that pins a request; empty when the request is not pinned. */
export function pinQuery(pin: SnapshotPin | null | undefined): { readonly snapshot?: string } {
  return pin ? { snapshot: pin.snapshotId } : {};
}

/** Refuses a response from another snapshot, or with another digest, than the one it was pinned to. */
export function assertPinned<T>(
  envelope: AdaptedEnvelope<T>,
  pin: SnapshotPin | null | undefined,
): AdaptedEnvelope<T> {
  if (!pin) return envelope;
  const { meta } = envelope;
  if (meta.snapshotId !== pin.snapshotId) {
    throw new ApiError(502, 'SNAPSHOT_MISMATCH', meta.serverRequestId, 'network.unavailable', {
      serverMessage: `Pinned to ${pin.snapshotId}, received ${meta.snapshotId}`,
    });
  }
  if (meta.contentSha256 !== pin.contentSha256) {
    throw new ApiError(502, 'SNAPSHOT_DIGEST_MISMATCH', meta.serverRequestId, 'network.unavailable', {
      serverMessage: `Pinned digest ${pin.contentSha256}, received ${meta.contentSha256 ?? 'none'}`,
    });
  }
  return envelope;
}

/**
 * The snapshot a new record may be pinned to: the one active default that the Data Hub calls
 * reproducible and that states its digest. `null` when there is none, or more than one (ambiguous):
 * the caller then records that it could not pin, instead of choosing.
 */
export function selectActiveReproducible(
  snapshots: readonly DataHubSnapshotDTO[],
): (SnapshotPin & { readonly entry: DataHubSnapshotDTO }) | null {
  const candidates = snapshots.filter(
    (entry) => entry.isActiveDefault && entry.isReproducible && entry.contentSha256 !== null,
  );
  const [only] = candidates;
  if (candidates.length !== 1 || !only?.contentSha256) return null;
  return { snapshotId: only.snapshotId, contentSha256: only.contentSha256, entry: only };
}
