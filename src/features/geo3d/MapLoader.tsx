import type { CSSProperties } from 'react';
import silhouetteUrl from '@/assets/landing/indonesia-silhouette.svg';
import styles from './MapLoader.module.css';

interface MapLoaderProps {
  readonly title: string;
  readonly text: string;
}

/**
 * The Jelajahi map's loader, for both waits (downloading the official boundaries, then building the
 * 3D map): a small glass card in the middle of the map area, with the country's outline and a light
 * sweeping across it, and the status in words. It marks itself `data-engine="loading"`, which the
 * map's first-visit gesture hint waits on.
 */
export function MapLoader({ title, text }: MapLoaderProps) {
  return (
    <div className={styles.placeholder} data-engine="loading">
      <div className={`glass ${styles.loader}`} role="status">
        <span
          className={styles.loaderMap}
          style={{ '--silhouette': `url("${silhouetteUrl}")` } as CSSProperties}
          aria-hidden="true"
        >
          <span className={styles.loaderSweep} />
        </span>
        <p className={styles.loaderTitle}>{title}</p>
        <p className={styles.loaderText}>{text}</p>
      </div>
    </div>
  );
}
