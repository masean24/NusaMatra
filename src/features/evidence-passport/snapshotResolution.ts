import {
  ApiError,
  selectActiveReproducible,
  type AdaptedEnvelope,
  type DataHubSnapshotDTO,
  type DataMode,
  type NusaMatraDataHubRepository,
  type SnapshotDetailDTO,
  type SnapshotPin,
} from '@/services/api';

/**
 * Which snapshot a passport's requests are pinned to (Data Hub v2.2), decided before any data request.
 * `PINNED`: every response must repeat this id and digest, or the passport is not made.
 * `UNPINNED`: no reproducible snapshot to pin to; the record says so and makes no reproducibility claim.
 */
export type SnapshotPinning =
  | {
      readonly status: 'PINNED';
      /** `LINK`: the snapshot named in the link. `ACTIVE`: the Data Hub's active reproducible snapshot. */
      readonly origin: 'LINK' | 'ACTIVE';
      readonly pin: SnapshotPin;
      readonly detail: AdaptedEnvelope<SnapshotDetailDTO>;
    }
  | { readonly status: 'UNPINNED'; readonly reason: string };

export interface ResolvedSnapshot {
  readonly pinning: SnapshotPinning;
  /** The snapshot list, when it was asked for (no snapshot in the link); `null` = not asked or failed. */
  readonly list: AdaptedEnvelope<readonly DataHubSnapshotDTO[]> | null;
}

/** The pin to pass to every data request; `null` = unpinned. */
export const pinOf = (pinning: SnapshotPinning): SnapshotPin | null =>
  pinning.status === 'PINNED' ? pinning.pin : null;

function notReproducible(snapshotId: string, requestId: string | null): ApiError {
  return new ApiError(409, 'SNAPSHOT_NOT_REPRODUCIBLE', requestId, 'network.unavailable', {
    serverMessage: `Snapshot ${snapshotId} is not reproducible and is no longer the active snapshot`,
  });
}

/**
 * A snapshot named in the link is fetched by id: unknown is an error (404 `SNAPSHOT_NOT_FOUND`), never
 * a silent switch to the latest. One the Data Hub calls unreproducible is used only while it is still
 * the active snapshot (DEMO), and then unpinned; otherwise the passport is refused.
 *
 * Without a snapshot in the link, the active reproducible snapshot is pinned. Its detail must agree
 * with the list on the digest. If none qualifies (DEMO, or an older Data Hub), the passport is
 * unpinned and says so.
 */
export async function resolvePassportSnapshot(
  repository: NusaMatraDataHubRepository,
  mode: DataMode,
  linkSnapshotId: string | null | undefined,
  signal?: AbortSignal,
): Promise<ResolvedSnapshot> {
  if (linkSnapshotId) {
    const detail = await repository.getSnapshotDetail({ dataMode: mode, snapshotId: linkSnapshotId, signal });
    const { data } = detail;
    if (data.isReproducible && data.contentSha256) {
      const pin = { snapshotId: data.snapshotId, contentSha256: data.contentSha256 };
      return { pinning: { status: 'PINNED', origin: 'LINK', pin, detail }, list: null };
    }
    if (!data.isActiveDefault) throw notReproducible(linkSnapshotId, detail.meta.serverRequestId);
    return {
      pinning: {
        status: 'UNPINNED',
        reason: `Data Hub menyatakan snapshot ${data.snapshotId} tidak dapat direproduksi (tanpa sidik isi data).`,
      },
      list: null,
    };
  }

  let list: AdaptedEnvelope<readonly DataHubSnapshotDTO[]>;
  try {
    list = await repository.getSnapshots(mode, signal);
  } catch (error: unknown) {
    if (error instanceof ApiError && error.isAborted) throw error;
    return {
      pinning: {
        status: 'UNPINNED',
        reason: 'Daftar snapshot tidak dapat dimuat, jadi tidak ada snapshot yang dapat dikunci.',
      },
      list: null,
    };
  }
  const active = selectActiveReproducible(list.data);
  if (!active) {
    return {
      pinning: {
        status: 'UNPINNED',
        reason:
          'Data Hub tidak menandai tepat satu snapshot aktif yang dapat direproduksi dengan sidik isi data.',
      },
      list,
    };
  }
  const detail = await repository.getSnapshotDetail({
    dataMode: mode,
    snapshotId: active.snapshotId,
    signal,
  });
  if (detail.data.contentSha256 !== active.contentSha256 || !detail.data.isReproducible) {
    throw new ApiError(502, 'SNAPSHOT_DIGEST_MISMATCH', detail.meta.serverRequestId, 'network.unavailable', {
      serverMessage: 'Snapshot list and snapshot detail disagree on content_sha256 or reproducibility',
    });
  }
  const pin = { snapshotId: active.snapshotId, contentSha256: active.contentSha256 };
  return { pinning: { status: 'PINNED', origin: 'ACTIVE', pin, detail }, list };
}
