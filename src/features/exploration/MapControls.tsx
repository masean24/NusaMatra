import type { RefObject } from 'react';
import type { GeoCameraHandle } from '@/features/geo3d';
import styles from './MapControls.module.css';

/** One wheel-notch-like step: about a fifth closer or farther, within the map's own limits. */
const ZOOM_IN = 0.8;
const ZOOM_OUT = 1.25;

interface MapControlsProps {
  readonly cameraRef: RefObject<GeoCameraHandle | null>;
  /** False until the 3D map is running; the buttons stay visible but disabled. */
  readonly ready: boolean;
}

/** Zoom and reset for the 3D map: the same camera the mouse wheel and drag move. */
export function MapControls({ cameraRef, ready }: MapControlsProps) {
  return (
    <div role="group" aria-label="Kontrol peta" className={styles.controls}>
      <button
        type="button"
        className={styles.button}
        aria-label="Perbesar peta"
        disabled={!ready}
        onClick={() => {
          cameraRef.current?.zoomBy(ZOOM_IN);
        }}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.glyph}>
          <path d="M10 4v12M4 10h12" />
        </svg>
      </button>
      <button
        type="button"
        className={styles.button}
        aria-label="Perkecil peta"
        disabled={!ready}
        onClick={() => {
          cameraRef.current?.zoomBy(ZOOM_OUT);
        }}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.glyph}>
          <path d="M4 10h12" />
        </svg>
      </button>
      <button
        type="button"
        className={styles.button}
        aria-label="Kembalikan tampilan seluruh Indonesia"
        disabled={!ready}
        onClick={() => {
          cameraRef.current?.resetView();
        }}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.glyph}>
          <path d="M4.5 9.5a5.5 5.5 0 1 0 1.6-3.9M4.5 3.5v3h3" />
        </svg>
      </button>
    </div>
  );
}
