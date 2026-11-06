import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import logoMarkUrl from '@/assets/figma/landing/logo-mark.png';
import { prefersReducedMotion } from '@/features/motion';
import { COASTLINE_ISLANDS, COASTLINE_VIEWBOX, COASTLINE_WIDTH } from './introCoastline';
import { setIntroStage } from './useIntroOnce';
import styles from './IntroGarisPantai.module.css';
import { t } from '@/lib/i18n';

/** The opening leaves by itself at 4.7 s; the progress line runs to that moment. */
const AUTO_EXIT_MS = 4700;
/** The curtain lifts in 1.15 s; the overlay is removed just after. */
const CURTAIN_MS = 1180;
/** Reduced motion: the still opening shows for 1.2 s and fades in 0.4 s. */
const REDUCED_HOLD_MS = 1200;
const REDUCED_FADE_MS = 400;

/** The coastline draws west to east: each island starts 0.35 s + up to 0.9 s by its western edge. */
const DRAW_START_S = 0.35;
const DRAW_SPREAD_S = 0.9;

function drawDelaySeconds(islandWestEdge: number): number {
  return DRAW_START_S + (islandWestEdge / COASTLINE_WIDTH) * DRAW_SPREAD_S;
}

/** The cursor light trails the pointer: each frame it closes 8% of the gap, so it feels heavy. */
const CURSOR_LERP = 0.08;
/** Below this gap (px) the light has arrived and the frame loop rests until the pointer moves. */
const CURSOR_REST_PX = 0.5;

const EXIT_KEYS: ReadonlySet<string> = new Set(['Enter', ' ', 'Escape']);

/** Every island as one shape, for the dot texture's clip. */
const LAND_PATH = COASTLINE_ISLANDS.map((island) => island.d).join('');

interface IntroGarisPantaiProps {
  /** Called once the overlay has gone (after the curtain, or the reduced-motion fade). */
  readonly onDone: () => void;
}

/**
 * The "Garis Pantai" opening over the Beranda: Indonesia's coastline draws itself from Sumatra to
 * Papua, the Nusa Matra mark settles in, then the overlay lifts like a curtain. Every step is a CSS
 * animation (IntroGarisPantai.module.css); this component only times the exit and moves the cursor
 * light, written to CSS variables so no frame re-renders React. A click, tap, Enter, Space or Escape
 * enters at once.
 */
export function IntroGarisPantai({ onDone }: IntroGarisPantaiProps) {
  const [reduced] = useState(prefersReducedMotion);
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const onDoneRef = useRef(onDone);
  const id = useId();
  const dotsId = `${id}-dots`;
  const landId = `${id}-land`;

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const leave = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    setIntroStage('leaving');
    timersRef.current.push(
      window.setTimeout(
        () => {
          onDoneRef.current();
        },
        reduced ? REDUCED_FADE_MS : CURTAIN_MS,
      ),
    );
  }, [reduced]);

  // Focus, the automatic exit, and the ways in: a click or tap anywhere on the overlay, or a key
  // anywhere. Every timer is cleared if the overlay goes early.
  useEffect(() => {
    const root = rootRef.current;
    const timers = timersRef.current;
    // Focus moves into the dialog itself, so a screen reader announces it and the keys reach it.
    root?.focus({ preventScroll: true });
    timers.push(window.setTimeout(leave, reduced ? REDUCED_HOLD_MS : AUTO_EXIT_MS));
    const onKey = (event: KeyboardEvent) => {
      if (!EXIT_KEYS.has(event.key)) return;
      event.preventDefault();
      leave();
    };
    window.addEventListener('keydown', onKey);
    root?.addEventListener('click', leave);
    return () => {
      window.removeEventListener('keydown', onKey);
      root?.removeEventListener('click', leave);
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [leave, reduced]);

  // The cursor light: eased toward the pointer frame by frame, resting once it has arrived.
  useEffect(() => {
    const root = rootRef.current;
    const map = mapRef.current;
    if (reduced || !root || !map) return;
    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const light = { ...target };
    let mapBox = map.getBoundingClientRect();
    let frame = 0;

    const draw = () => {
      light.x += (target.x - light.x) * CURSOR_LERP;
      light.y += (target.y - light.y) * CURSOR_LERP;
      root.style.setProperty('--intro-cursor-x', `${light.x.toFixed(1)}px`);
      root.style.setProperty('--intro-cursor-y', `${light.y.toFixed(1)}px`);
      map.style.setProperty('--intro-map-x', `${(light.x - mapBox.left).toFixed(1)}px`);
      map.style.setProperty('--intro-map-y', `${(light.y - mapBox.top).toFixed(1)}px`);
      const arrived = Math.hypot(target.x - light.x, target.y - light.y) < CURSOR_REST_PX;
      frame = arrived ? 0 : requestAnimationFrame(draw);
    };
    const onMove = (event: PointerEvent) => {
      target.x = event.clientX;
      target.y = event.clientY;
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const onResize = () => {
      mapBox = map.getBoundingClientRect();
    };
    draw();
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', onResize);
    };
  }, [reduced]);

  return createPortal(
    <div
      ref={rootRef}
      className={styles.overlay}
      data-phase={leaving ? 'leaving' : 'playing'}
      data-reduced={reduced || undefined}
      role="dialog"
      aria-modal="true"
      aria-label={t('Pembuka Nusa Matra. Tekan Enter untuk masuk.')}
      tabIndex={-1}
    >
      <div ref={mapRef} className={styles.map} aria-hidden="true">
        <div className={styles.mapExit}>
          <div className={styles.mapDim}>
            <svg className={styles.layer} viewBox={COASTLINE_VIEWBOX}>
              <defs>
                <pattern id={dotsId} width="9" height="10" patternUnits="userSpaceOnUse">
                  <circle cx="0" cy="0" r="1.6" />
                  <circle cx="9" cy="0" r="1.6" />
                  <circle cx="0" cy="10" r="1.6" />
                  <circle cx="9" cy="10" r="1.6" />
                  <circle cx="4.5" cy="5" r="1.6" />
                </pattern>
                <clipPath id={landId}>
                  <path d={LAND_PATH} />
                </clipPath>
              </defs>
              <rect
                className={styles.dots}
                width="960"
                height="420"
                fill={`url(#${dotsId})`}
                clipPath={`url(#${landId})`}
              />
              <g className={styles.coast}>
                {COASTLINE_ISLANDS.map((island, index) => (
                  <path
                    // A fixed list: its order never changes.
                    key={index}
                    d={island.d}
                    pathLength={1}
                    style={{
                      animationDelay: `${drawDelaySeconds(island.x).toFixed(3)}s`,
                    }}
                  />
                ))}
              </g>
            </svg>
            {/* The brighter dots, seen only through a soft circle around the cursor light. */}
            <svg className={`${styles.layer} ${styles.dotsNearCursor}`} viewBox={COASTLINE_VIEWBOX}>
              <rect width="960" height="420" fill={`url(#${dotsId})`} clipPath={`url(#${landId})`} />
            </svg>
          </div>
        </div>
      </div>

      <div className={styles.ink} aria-hidden="true" />
      <div className={styles.cursorLight} aria-hidden="true" />

      <div className={styles.lockupExit}>
        <div className={styles.lockup}>
          <div className={styles.symbolBox}>
            <span className={styles.sun} aria-hidden="true" />
            <img className={styles.symbol} src={logoMarkUrl} alt="" width={132} height={120} />
          </div>
          <div className={styles.wordMask}>
            <p className={styles.word}>
              Nusa <span className={styles.accent}>Matra</span>
            </p>
          </div>
          <span className={styles.divider} aria-hidden="true" />
          <p className={styles.tagline}>
            <span>{t('Memahami wilayah')}</span> <span>{t('Menentukan arah')}</span>
          </p>
        </div>
      </div>

      <span className={styles.progress} aria-hidden="true">
        <span className={styles.progressFill} />
      </span>
    </div>,
    document.body,
  );
}
