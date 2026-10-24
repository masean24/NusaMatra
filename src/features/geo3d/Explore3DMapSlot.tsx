import type { Ref } from 'react';
import dioramaGlassUrl from '@/assets/figma/landing/diorama-nusantara-kaca.svg';
import dioramaUrl from '@/assets/figma/landing/diorama-nusantara.svg';
import { StatusMessage, type StatusKind } from '@/components/feedback/StatusMessage';
import { useReducedMotion } from '@/features/motion';
import { useDisplayMode } from '@/features/theme';
import { publicConfig } from '@/lib/publicConfig';
import type { Explore3DMapProps, GeoCameraHandle, GeoDataMode } from './contract';
import { EngineSlot, type EngineSlotState } from './EngineSlot';
import { geoEngineRegistry } from './engineRegistry';
import styles from './Explore3DMapSlot.module.css';

const PLACEHOLDER_STATUS: Record<EngineSlotState, { kind: StatusKind; title: string; children: string }> = {
  loading: {
    kind: 'loading',
    title: 'Memuat peta 3D…',
    children: 'Pratinjau di bawah ini adalah ilustrasi, bukan peta geografis akurat.',
  },
  failed: {
    kind: 'unavailable',
    title: 'Peta 3D tidak dapat ditampilkan',
    children: 'Perangkat atau browser ini tidak dapat menjalankan peta 3D. Gambar ini hanya ilustrasi.',
  },
  absent: {
    kind: 'info',
    title: 'Peta 3D belum tersedia',
    children: 'Gambar ini hanya ilustrasi, bukan peta geografis akurat.',
  },
};

/** LIVE shows no illustration behind the status, so its copy must not mention one. */
const LIVE_STATUS: Record<EngineSlotState, { kind: StatusKind; title: string; children: string }> = {
  loading: {
    kind: 'loading',
    title: 'Menyiapkan peta 3D…',
    children: 'Membangun batas wilayah resmi dari BIG.',
  },
  failed: {
    kind: 'unavailable',
    title: 'Peta 3D tidak dapat ditampilkan',
    children:
      'Perangkat atau browser ini tidak dapat menjalankan peta 3D. Pilih wilayah lewat daftar di panel.',
  },
  absent: {
    kind: 'info',
    title: 'Peta 3D belum tersedia',
    children: 'Pilih wilayah lewat daftar di panel.',
  },
};

interface Explore3DMapSlotProps {
  readonly geography: Explore3DMapProps['geography'];
  readonly selectedRegionId: string | null;
  readonly onRegionSelect: Explore3DMapProps['onRegionSelect'];
  readonly onRegionHover?: Explore3DMapProps['onRegionHover'];
  readonly cameraRef?: Ref<GeoCameraHandle> | undefined;
  readonly overlayPoints?: Explore3DMapProps['overlayPoints'];
  readonly selectedOverlayId?: Explore3DMapProps['selectedOverlayId'];
  readonly onOverlaySelect?: Explore3DMapProps['onOverlaySelect'];
  readonly className?: string | undefined;
  /** The mode the page is in right now; defaults to the build-time mode. */
  readonly dataMode?: GeoDataMode | undefined;
}

/**
 * Integration slot for the external `Explore3DMap` on Peta Utama / Jelajahi. Region selection is
 * controlled by the host page; this slot only forwards it. While the engine loads, or if it
 * cannot run, an honest static preview with a status message stands in for it.
 */
export function Explore3DMapSlot({
  geography,
  selectedRegionId,
  onRegionSelect,
  onRegionHover,
  cameraRef,
  overlayPoints,
  selectedOverlayId,
  onOverlaySelect,
  className,
  dataMode = publicConfig.dataMode,
}: Explore3DMapSlotProps) {
  const { mode } = useDisplayMode();
  const reducedMotion = useReducedMotion();

  return (
    <section className={[styles.frame, className].filter(Boolean).join(' ')} aria-label="Peta 3D wilayah">
      <EngineSlot
        engine={geoEngineRegistry.Explore3DMap}
        engineProps={{
          displayMode: mode,
          dataMode,
          reducedMotion,
          geography,
          selectedRegionId,
          onRegionSelect,
          onRegionHover,
          cameraRef,
          overlayPoints,
          selectedOverlayId,
          onOverlaySelect,
        }}
        placeholder={(state) =>
          dataMode === 'LIVE' ? (
            // Official geometry is on its way: no illustration that could pass for the map, just a quiet
            // skeleton of the same size, so nothing jumps when the map appears.
            <div className={`${styles.placeholder} ${styles.skeleton}`}>
              <StatusMessage className={styles.status} {...LIVE_STATUS[state]} />
            </div>
          ) : (
            <div className={styles.placeholder}>
              <img
                className={styles.art}
                src={mode === 'glass' ? dioramaGlassUrl : dioramaUrl}
                alt=""
                width={700}
                height={640}
                decoding="async"
              />
              <StatusMessage className={styles.status} {...PLACEHOLDER_STATUS[state]} />
            </div>
          )
        }
      />
    </section>
  );
}
