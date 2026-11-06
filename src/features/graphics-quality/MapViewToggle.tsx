import { setMapView, useMapView } from './graphicsQuality';
import styles from './MapViewToggle.module.css';
import { t } from '@/lib/i18n';

/**
 * The 3D / 2D switch on the Jelajahi map: on, the map is drawn flat from above, lighter to draw and
 * moved with one finger. "3D" and "2D" are the two faces of a coin that turns over to show the view
 * in use; only the motion changes, never the colour. A low-end device starts on 2D.
 */
export function MapViewToggle() {
  const flat = useMapView() === '2d';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={flat}
      aria-label={t('Peta 2D')}
      title={flat ? t('Peta 2D aktif: tekan untuk kembali ke 3D') : t('Tampilkan peta 2D yang lebih ringan')}
      className={styles.toggle}
      onClick={() => {
        setMapView(flat ? '3d' : '2d');
      }}
    >
      <span className={styles.coin} data-face={flat ? '2d' : '3d'} aria-hidden="true">
        <span className={styles.face}>3D</span>
        <span className={`${styles.face} ${styles.back}`}>2D</span>
      </span>
    </button>
  );
}
