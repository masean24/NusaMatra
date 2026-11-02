import silhouetteSvg from '@/assets/landing/indonesia-silhouette.svg?raw';
import styles from './MapLoader.module.css';

/** The country's outline as one path (one subpath per island), read from the silhouette asset. */
const COAST_PATH = /\sd="([^"]+)"/.exec(silhouetteSvg)?.[1] ?? '';

interface MapLoaderProps {
  readonly title: string;
  readonly text: string;
}

/**
 * The Jelajahi map's loader, for both waits (downloading the official boundaries, then building the
 * 3D map): a small glass card in the middle of the map area, with the country's coastline being
 * traced and filled in slowly, and the status in words. It marks itself `data-engine="loading"`,
 * which the map's first-visit gesture hint waits on.
 */
export function MapLoader({ title, text }: MapLoaderProps) {
  return (
    <div className={styles.placeholder} data-engine="loading">
      <div className={`glass ${styles.loader}`} role="status">
        <svg className={styles.coast} viewBox="0 0 1000 375" aria-hidden="true" focusable="false">
          <path d={COAST_PATH} vectorEffect="non-scaling-stroke" />
        </svg>
        <p className={styles.loaderTitle}>{title}</p>
        <p className={styles.loaderText}>{text}</p>
      </div>
    </div>
  );
}
