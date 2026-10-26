import styles from './AppBackground.module.css';

/** The island silhouette of the Kapur & Kobalt palette, centred on (310, 240) in its own units. */
const ISLAND =
  'M120 140C180 60 330 40 420 90C520 145 560 250 500 330C440 410 300 430 200 390C100 350 60 220 120 140Z';

/** Contour rings: the same island, scaled down and turned a little each time, like a topographic map. */
const CONTOURS = [
  [2, 4],
  [1.7, -3],
  [1.45, 6],
  [1.22, -5],
  [1, 2],
  [0.8, -4],
  [0.6, 5],
  [0.42, -2],
] as const;

/**
 * The page background every route shares, the same on every page, behind all content (decorative,
 * static):
 *   1. colour: the calm Kaca gradient, the light the glass cards refract (Kaca only);
 *   2. contour: faint topographic rings of the island silhouette (both modes).
 * It is an illustration, not a map; nothing here carries data.
 */
export function AppBackground() {
  return (
    <div className={styles.background} aria-hidden="true">
      <div className={styles.colour} />
      <svg className={styles.contour} viewBox="0 0 1000 1000" focusable="false">
        {CONTOURS.map(([scale, rotate]) => (
          <path
            key={scale}
            d={ISLAND}
            transform={`translate(500 500) scale(${String(scale)}) rotate(${String(rotate)}) translate(-310 -240)`}
          />
        ))}
      </svg>
    </div>
  );
}
