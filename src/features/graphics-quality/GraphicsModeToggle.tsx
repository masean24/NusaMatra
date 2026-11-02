import { setGraphicsMode, useGraphicsMode } from './graphicsQuality';
import styles from './GraphicsModeToggle.module.css';

/**
 * The 3D / 2D switch beside the Normal–Kaca switch: on, the heavy 3D scenes become 2D pictures and
 * the Jelajahi map is drawn flat from above. "3D" and "2D" are the two faces of a coin that turns
 * over to show the mode in use; only the motion changes, never the colour.
 */
export function GraphicsModeToggle() {
  const low = useGraphicsMode() === 'low';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={low}
      aria-label="Mode ringan 2D"
      title={low ? 'Mode ringan 2D aktif: tekan untuk kembali ke 3D' : 'Aktifkan mode ringan 2D'}
      className={styles.toggle}
      onClick={() => {
        setGraphicsMode(low ? 'high' : 'low');
      }}
    >
      <span className={styles.coin} data-face={low ? '2d' : '3d'} aria-hidden="true">
        <span className={styles.face}>3D</span>
        <span className={`${styles.face} ${styles.back}`}>2D</span>
      </span>
    </button>
  );
}
