import { useEffect, useState } from 'react';
import { setMapView, useAutoFlat, useMapView } from './graphicsQuality';
import styles from './MapViewToggle.module.css';
import { t } from '@/lib/i18n';

/** How long the "switched to 2D" note stays; the switch itself keeps showing 2D. */
const AUTO_FLAT_NOTE_MS = 8000;

/**
 * The 3D / 2D switch on the Jelajahi map: on, the map is drawn flat from above, lighter to draw and
 * moved with one finger. "3D" and "2D" are the two faces of a coin that turns over to show the view
 * in use; only the motion changes, never the colour. A low-end device starts on 2D, and a 3D map
 * that stutters turns flat by itself, with a short note beside the switch saying so.
 */
export function MapViewToggle() {
  const flat = useMapView() === '2d';
  const autoFlat = useAutoFlat();
  const [noteGone, setNoteGone] = useState(false);
  const showNote = autoFlat && !noteGone;

  useEffect(() => {
    if (!showNote) return;
    const timer = window.setTimeout(() => {
      setNoteGone(true);
    }, AUTO_FLAT_NOTE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [showNote]);

  return (
    <span className={styles.anchor}>
      <button
        type="button"
        role="switch"
        aria-checked={flat}
        aria-label={t('Peta 2D')}
        title={
          flat ? t('Peta 2D aktif: tekan untuk kembali ke 3D') : t('Tampilkan peta 2D yang lebih ringan')
        }
        className={styles.toggle}
        onClick={() => {
          setNoteGone(true);
          setMapView(flat ? '3d' : '2d');
        }}
      >
        <span className={styles.coin} data-face={flat ? '2d' : '3d'} aria-hidden="true">
          <span className={styles.face}>3D</span>
          <span className={`${styles.face} ${styles.back}`}>2D</span>
        </span>
      </button>
      {/* Always present, so the message is announced when it appears. */}
      <span role="status" className={showNote ? styles.note : styles.noteEmpty}>
        {showNote ? t('Peta beralih ke 2D agar lebih lancar. Tekan 3D untuk kembali.') : null}
      </span>
    </span>
  );
}
