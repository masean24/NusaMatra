import { useEffect, useMemo, useState } from 'react';
import type { HexTheme } from './hexColors';
import { hexDatasetUrl, loadHexDatasetOnce, type HexDataset } from './hexDataset';
import { HexGraticule } from './HexGraticule';
import { POSTER_HEIGHT, POSTER_WIDTH, buildHexPoster } from './posterGeometry';
import styles from './HexIndonesiaMap.module.css';

/** Soft contact shadow: one blur over the whole shadow layer, not one filter per tile. */
const SHADOW_BLUR = 1.6;
const SHADOW_OPACITY = 0.3;

interface HexPosterProps {
  readonly theme: HexTheme;
}

/**
 * A still picture of the current hexagon map (same camera, grid, heights and palette as the 3D
 * scene) for the area while the scene loads and for browsers without WebGL. It follows the active
 * theme, keeps the area's size, and is the only thing ever shown instead of the live scene.
 */
export function HexPoster({ theme }: HexPosterProps) {
  const [dataset, setDataset] = useState<HexDataset | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadHexDatasetOnce(hexDatasetUrl()).then(
      (loaded) => {
        if (!cancelled) setDataset(loaded);
      },
      () => undefined, // the poster stays a clean empty grid; the scene reports the failure
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const picture = useMemo(() => (dataset ? buildHexPoster(dataset, theme) : null), [dataset, theme]);

  return (
    <div className={styles.root} data-display-mode={theme} data-hex-poster>
      <HexGraticule />
      {picture && (
        <svg
          className={styles.poster}
          viewBox={`0 0 ${String(POSTER_WIDTH)} ${String(POSTER_HEIGHT)}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <filter id="hex-poster-soft" x="-5%" y="-5%" width="110%" height="110%">
              <feGaussianBlur stdDeviation={SHADOW_BLUR} />
            </filter>
          </defs>
          <g filter="url(#hex-poster-soft)" opacity={SHADOW_OPACITY}>
            {picture.shadows.map((shape) => (
              <polygon key={shape.key} points={shape.points} fill={shape.fill} />
            ))}
          </g>
          {picture.tiles.map((shape) => (
            <polygon key={shape.key} points={shape.points} fill={shape.fill} />
          ))}
          {picture.outlines.map((shape) => (
            <polygon key={shape.key} className={styles.noData} points={shape.points} fill="none" />
          ))}
        </svg>
      )}
      <p className={styles.badge}>Garis pantai: Natural Earth · Sel hexagon: data simulasi</p>
    </div>
  );
}
