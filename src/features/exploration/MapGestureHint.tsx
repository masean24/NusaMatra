import { useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '@/features/motion';
import styles from './MapGestureHint.module.css';

const SEEN_KEY = 'nusa-matra:map-hint-seen';
/** How long the hint stays when the visitor does not touch the map first. */
const VISIBLE_MS = 6500;
/** A longer gap between frames is a freeze, and counts as one ordinary frame. */
const MAX_FRAME_MS = 50;
const TOUCH_QUERY = '(pointer: coarse)';

function alreadySeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Private mode or blocked storage: the hint may show again next visit, which is harmless.
  }
}

/**
 * The first time someone opens Jelajahi: how to move the 3D map. Touch screens see a short pinch
 * animation; mouse users see what each button and the wheel do. It fades on the first touch, click
 * or scroll, or after a few seconds, and is not shown again on this device. It never blocks the map.
 */
export function MapGestureHint() {
  const touch = useMediaQuery(TOUCH_QUERY);
  const [visible, setVisible] = useState(() => !alreadySeen());
  const hintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    // The hint waits for the map: while the 3D engine is still loading (its slot says
    // data-engine="loading") it stays hidden behind the map's own loader, and neither the clock
    // nor a click counts yet. Without an engine slot (tests, no WebGL) it shows at once.
    let ready = false;
    const checkReady = () => {
      const engine = hintRef.current?.parentElement?.querySelector('[data-engine]');
      ready = !engine || engine.getAttribute('data-engine') === 'ready';
      if (hintRef.current) hintRef.current.dataset.waiting = String(!ready);
    };
    // Remembered on dismissal, not on mount: the map stage can remount while data loads, and a
    // flag written on the first mount would hide the hint before anyone saw it.
    const hide = () => {
      if (!ready) return;
      rememberSeen();
      setVisible(false);
    };
    // Counted in rendered frames, not wall time: building the map can block the main thread for
    // seconds, and a plain timeout would expire during that freeze, before the hint was ever seen.
    let shownMs = 0;
    let last = performance.now();
    checkReady();
    let frame = requestAnimationFrame(function tick(now) {
      checkReady();
      if (ready) shownMs += Math.min(now - last, MAX_FRAME_MS);
      last = now;
      if (shownMs >= VISIBLE_MS) hide();
      else frame = requestAnimationFrame(tick);
    });
    const events = ['pointerdown', 'wheel', 'keydown'] as const;
    for (const event of events) window.addEventListener(event, hide, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      for (const event of events) window.removeEventListener(event, hide);
    };
  }, [visible]);

  if (!visible) return null;
  return (
    <div ref={hintRef} className={`glass ${styles.hint}`} role="status">
      {touch ? (
        <>
          <span className={styles.pinch} aria-hidden="true">
            <span className={styles.finger} data-finger="a" />
            <span className={styles.finger} data-finger="b" />
          </span>
          <p className={styles.text}>Cubit untuk memperbesar, geser dengan satu jari untuk memutar peta</p>
        </>
      ) : (
        <ul role="list" className={styles.list} aria-label="Cara memakai peta 3D">
          <li>
            <span className={styles.key}>Klik kiri</span> + geser untuk memutar 3D
          </li>
          <li>
            <span className={styles.key}>Klik kanan</span> + geser untuk menggeser peta
          </li>
          <li>
            <span className={styles.key}>Scroll</span> untuk memperbesar atau memperkecil
          </li>
        </ul>
      )}
    </div>
  );
}
