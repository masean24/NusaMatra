import { HERO_ORIGIN, lonLatToPlane, projectToHeroFrame } from '@/lib/heroMapCamera';
import styles from './HexGraticule.module.css';

/** Drawn in the zone's 720 × 660 design units; the SVG stretches to the zone, which keeps that ratio. */
const WIDTH = 720;
const HEIGHT = 660;

const PARALLELS = [
  { lat: 5, label: '5° LU' },
  { lat: 0, label: '0°' },
  { lat: -5, label: '5° LS' },
  { lat: -10, label: '10° LS' },
] as const;
const MERIDIANS = [100, 110, 120, 130, 140] as const;
const MERIDIAN_LAT_SPAN = [8, -13] as const;

function framePoint(lon: number, lat: number): { x: number; y: number } {
  const { x, z } = lonLatToPlane(lon, lat, HERO_ORIGIN);
  const { u, v } = projectToHeroFrame([x, 0, z]);
  return { x: u * WIDTH, y: v * HEIGHT };
}

/**
 * The thin grid, the dashed equator and the latitude labels behind the hexagons. It is decoration:
 * the labels name the parallels, but no value on the map depends on reading them.
 */
export function HexGraticule() {
  const north = MERIDIAN_LAT_SPAN[0];
  const south = MERIDIAN_LAT_SPAN[1];
  return (
    <svg
      className={styles.graticule}
      viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="none"
    >
      {MERIDIANS.map((lon) => {
        const top = framePoint(lon, north);
        const bottom = framePoint(lon, south);
        return <line key={lon} className={styles.grid} x1={top.x} y1={top.y} x2={bottom.x} y2={bottom.y} />;
      })}
      {PARALLELS.map(({ lat, label }) => {
        const { y } = framePoint(118, lat);
        return (
          <g key={lat}>
            <line className={lat === 0 ? styles.equator : styles.grid} x1={0} y1={y} x2={WIDTH} y2={y} />
            <text className={styles.label} x={WIDTH - 12} y={y - 6} textAnchor="end">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
