import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { prefersReducedMotion } from '@/features/motion';
import { t } from '@/lib/i18n';
import { SPLASH_LETTER_BOXES, SPLASH_LOGO, SPLASH_WORDMARK_RATIO } from './splashLogo';
import { startSplashDots } from './splashDotsCanvas';
import { EXIT_MS, PORTAL_AFTER_MS, REDUCED_FADE_MS, REDUCED_HOLD_MS, progressAt } from './splashTimeline';
import { setIntroStage } from './useIntroOnce';
import styles from './IntroSplash.module.css';

/** Set on the root by hand: a phase change must not render anything again, the Beranda least of all. */
type SplashPhase = 'playing' | 'out' | 'portal';

const EXIT_KEYS: ReadonlySet<string> = new Set(['Enter', ' ', 'Escape']);

/** Waits on the fonts the Beranda's first screen needs, where the browser can say. */
function whenPageReady(onReady: () => void): void {
  if ('fonts' in document) void document.fonts.ready.then(onReady);
  else onReady();
}

interface IntroSplashProps {
  /** Called once the overlay has gone: after the portal, or the reduced-motion fade. */
  readonly onDone: () => void;
}

/**
 * The opening over the Beranda: Indonesia appears dot by dot from a sonar in its middle, the logo's
 * sun rises, and the page comes through a soft zoom. CSS runs the steps of IntroSplash.module.css and
 * this component only starts them, writes progress to the DOM and times the exit. A click, tap,
 * Enter, Space or Escape enters at once.
 */
export function IntroSplash({ onDone }: IntroSplashProps) {
  const [reduced] = useState(prefersReducedMotion);
  const [logo] = useState(() =>
    document.documentElement.dataset.displayMode === 'glass' ? SPLASH_LOGO.glass : SPLASH_LOGO.normal,
  );
  const statuses = [t('Memetakan nusantara'), t('Memuat indikator wilayah'), t('Menyiapkan ruang kerja')];
  const lastStatus = statuses[statuses.length - 1];
  const statusesRef = useRef(statuses);

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const percentRef = useRef<HTMLElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const timers: number[] = [];
    let frame = 0;
    let phase: SplashPhase = 'playing';
    const setPhase = (next: SplashPhase) => {
      phase = next;
      root.dataset.phase = next;
    };
    setPhase('playing');
    const stopDots = startSplashDots(canvas, reduced);

    const enterPortal = () => {
      setPhase('portal');
      setIntroStage('leaving');
    };
    const leave = () => {
      if (phase !== 'playing') return;
      cancelAnimationFrame(frame);
      setPhase('out');
      if (reduced) enterPortal();
      else timers.push(window.setTimeout(enterPortal, PORTAL_AFTER_MS));
      timers.push(
        window.setTimeout(
          () => {
            onDoneRef.current();
          },
          reduced ? REDUCED_FADE_MS : EXIT_MS,
        ),
      );
    };

    if (reduced) {
      timers.push(window.setTimeout(leave, REDUCED_HOLD_MS));
    } else {
      let ready = false;
      whenPageReady(() => {
        ready = true;
      });
      const started = performance.now();
      let shownPercent = -1;
      let shownStatus = 0;
      const tick = (now: number) => {
        const { fraction, statusIndex, finished } = progressAt(now - started, ready);
        const percent = Math.round(fraction * 100);
        if (percent !== shownPercent) {
          shownPercent = percent;
          if (barRef.current) barRef.current.style.transform = `scaleX(${String(fraction)})`;
          if (percentRef.current) percentRef.current.textContent = `${String(percent)}%`;
        }
        if (statusIndex !== shownStatus && statusRef.current) {
          shownStatus = statusIndex;
          statusRef.current.textContent = statusesRef.current[statusIndex] ?? '';
        }
        if (finished) leave();
        else frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }

    const onKey = (event: KeyboardEvent) => {
      if (!EXIT_KEYS.has(event.key)) return;
      event.preventDefault();
      leave();
    };
    window.addEventListener('keydown', onKey);
    root.addEventListener('click', leave);
    return () => {
      window.removeEventListener('keydown', onKey);
      root.removeEventListener('click', leave);
      cancelAnimationFrame(frame);
      for (const timer of timers) window.clearTimeout(timer);
      stopDots();
    };
  }, [reduced]);

  const symbolStyle = {
    aspectRatio: `${String(logo.width)} / ${String(logo.height)}`,
    '--splash-sun-x': `${String(logo.sun_x)}%`,
    '--splash-sun-y': `${String(logo.sun_y)}%`,
    '--splash-sun-size': `${String(logo.sun_r * 2)}%`,
  } as CSSProperties;

  return createPortal(
    <div
      ref={rootRef}
      className={styles.overlay}
      data-intro-splash=""
      data-reduced={reduced || undefined}
      aria-hidden="true"
    >
      <div className={styles.map}>
        <div className={styles.sweep} />
        <canvas ref={canvasRef} className={styles.dots} />
      </div>

      <div className={styles.centre}>
        <div className={styles.lockup}>
          <div className={styles.glow} />
          <div className={styles.symbol} style={symbolStyle}>
            <div className={styles.orbit}>
              <svg viewBox="0 0 200 200">
                <circle className={styles.orbitRing} cx="100" cy="100" r="84" />
                <circle className={styles.satellite} cx="100" cy="16" r="3.6" />
              </svg>
            </div>
            <img className={styles.body} src={logo.body} alt="" />
            <svg className={styles.outline} viewBox={`0 0 ${String(logo.width)} ${String(logo.height)}`}>
              <path d={logo.outline} pathLength={1} />
            </svg>
            <span className={styles.ring} />
            <span className={styles.ring} />
            <img className={styles.sun} src={logo.sun} alt="" />
          </div>
          <div className={styles.wordmark} style={{ aspectRatio: SPLASH_WORDMARK_RATIO }}>
            {logo.letters.map((src, index) => {
              const box = SPLASH_LETTER_BOXES[index];
              return (
                <img
                  // A fixed list: its order never changes.
                  key={index}
                  className={styles.letter}
                  src={src}
                  alt=""
                  style={
                    {
                      '--splash-letter': index,
                      left: `${String(box?.left)}%`,
                      top: `${String(box?.top)}%`,
                      width: `${String(box?.width)}%`,
                      height: `${String(box?.height)}%`,
                    } as CSSProperties
                  }
                />
              );
            })}
          </div>
        </div>

        <div className={styles.meta}>
          <div className={styles.track}>
            <i ref={barRef} className={styles.bar} />
          </div>
          <div className={styles.status}>
            <span ref={statusRef}>{reduced ? lastStatus : statuses[0]}</span>
            <b ref={percentRef} className={styles.percent}>
              {reduced ? '100%' : '0%'}
            </b>
          </div>
          <p className={`kk-small ${styles.slogan}`}>{t('Memahami wilayah, menentukan arah.')}</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
