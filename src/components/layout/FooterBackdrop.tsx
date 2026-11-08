import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { HILL_PATHS, STARS, WORDMARK } from './footerArt';
import styles from './FooterBackdrop.module.css';

export type FooterBottom = 'glow' | 'shadow';

interface FooterBackdropProps {
  /** What fades up from the footer's bottom edge over the wordmark: light (`glow`) or dark (`shadow`). */
  readonly bottom?: FooterBottom;
}

/**
 * The footer's backdrop: sky, layered hills with the sun rising between them (stars in Kaca), and the
 * official NUSA MATRA wordmark, large and fading, cut by the bottom edge. Decoration only: hidden from
 * screen readers and never in the way of a click. Normal and Kaca differ in colour only (CSS), so a
 * mode switch never redraws the paths.
 */
export function FooterBackdrop({ bottom = 'glow' }: FooterBackdropProps) {
  // Gradient and filter ids must be unique per instance and valid inside url(#…).
  const id = `fb${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const wordmarkRef = useRef<SVGSVGElement>(null);
  // Without IntersectionObserver there is nothing to wait for: the wordmark is simply there.
  const [shown, setShown] = useState(() => typeof IntersectionObserver === 'undefined');

  // The wordmark rises in once, when a quarter of the footer is first on screen.
  useEffect(() => {
    const wordmark = wordmarkRef.current;
    if (!wordmark || shown) return;
    const target = wordmark.closest('footer') ?? wordmark;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [shown]);

  const url = (name: string) => `url(#${id}-${name})`;

  return (
    <>
      <div
        className={styles.backdrop}
        data-bottom={bottom}
        aria-hidden="true"
        style={{ '--fb-hill4-filter': url('hill4-shadow') } as CSSProperties}
      >
        <div className={styles.sky} />
        <svg
          className={styles.landscape}
          viewBox="0 0 1440 420"
          preserveAspectRatio="xMidYMax slice"
          focusable="false"
        >
          <defs>
            {HILL_PATHS.map((_, layer) => (
              <linearGradient key={layer} id={`${id}-hill${layer}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" className={styles[`hill${layer}Top`]} />
                <stop offset="1" className={styles[`hill${layer}Bottom`]} />
              </linearGradient>
            ))}
            <radialGradient id={`${id}-sun-glow`}>
              <stop offset="0" stopColor="rgb(255 150 80)" stopOpacity="0.42" />
              <stop offset="0.5" stopColor="rgb(255 150 80)" stopOpacity="0.14" />
              <stop offset="1" stopColor="rgb(255 150 80)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`${id}-sun`}>
              <stop offset="0" stopColor="#FF8A3D" />
              <stop offset="0.55" stopColor="#FF9A55" />
              <stop offset="1" stopColor="#FFB27A" />
            </radialGradient>
            {/* drop-shadow(0 -6px 18px rgba(30,63,217,.18)) as an SVG filter: CSS shorthand filters
                are not drawn on shapes inside an SVG in every browser. */}
            <filter id={`${id}-hill4-shadow`} x="-10%" y="-40%" width="120%" height="180%">
              <feDropShadow dx="0" dy="-6" stdDeviation="9" floodColor="rgb(30 63 217)" floodOpacity="0.18" />
            </filter>
          </defs>
          <g className={styles.stars}>
            {STARS.map(([x, y, r, opacity], index) => (
              <circle key={index} cx={x} cy={y} r={r} fill="#fff" opacity={opacity} />
            ))}
          </g>
          <path d={HILL_PATHS[0]} fill={url('hill0')} />
          <circle className={styles.sunGlowNormal} cx="880" cy="196" r="150" fill={url('sun-glow')} />
          <circle className={styles.sunGlowGlass} cx="880" cy="196" r="170" fill={url('sun-glow')} />
          <circle cx="880" cy="196" r="44" fill={url('sun')} />
          {HILL_PATHS.slice(1).map((path, index) => (
            <path
              key={index}
              className={index === 3 ? styles.hill4 : undefined}
              d={path}
              fill={url(`hill${index + 1}`)}
            />
          ))}
        </svg>
      </div>
      <svg
        ref={wordmarkRef}
        className={styles.wordmark}
        data-bottom={bottom}
        data-shown={shown || undefined}
        viewBox={`0 0 ${WORDMARK.width} ${WORDMARK.height}`}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id={`${id}-wordmark`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className={styles.wordmarkStop0} />
            <stop offset="0.55" className={styles.wordmarkStop55} />
            <stop offset="1" className={styles.wordmarkStop100} />
          </linearGradient>
        </defs>
        <path d={WORDMARK.path} fill={url('wordmark')} fillRule="evenodd" />
      </svg>
      <div className={styles.mist} data-bottom={bottom} aria-hidden="true" />
    </>
  );
}
