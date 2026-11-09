import { useMemo, useState, type CSSProperties } from 'react';
import { useDataHubResource } from '@/features/data-hub';
import { publicConfig } from '@/lib/publicConfig';
import { latestQuakeForHero, quakeMagnitude, quakeTimeAgo } from './latestQuake';
import styles from './HeroLatestQuake.module.css';
import { t } from '@/lib/i18n';

/**
 * The newest BMKG earthquake, marked where it happened on the hero's hexagon map, with a small note
 * beside it (magnitude, place, how long ago). Information only: no button. It reads the feed once
 * when the page opens; it shows nothing in DEMO, while loading, or when the feed is not the official
 * fresh one, so the hero stays as it was.
 */
export function HeroLatestQuake() {
  const feed = useDataHubResource('hero-latest-quake', async (repository, dataMode, signal) =>
    dataMode === 'LIVE' ? repository.getEarthquakeFeed({ dataMode, signal }) : null,
  );
  // The time the note counts from: when the page opened (it is read once, not polled).
  const [nowMs] = useState(() => Date.now());
  const loaded = feed.state.status === 'success' ? feed.state.data : null;
  const quake = useMemo(
    () => (loaded ? latestQuakeForHero(loaded, new Date(nowMs), publicConfig.earthquakePreview) : null),
    [loaded, nowMs],
  );
  if (!quake) return null;

  const { event, u, v } = quake;
  const place = event.area ?? t('Lokasi tidak disebutkan');
  const ago = quakeTimeAgo(event.occurredAt, nowMs);
  const position = { '--quake-u': `${(u * 100).toFixed(2)}%`, '--quake-v': `${(v * 100).toFixed(2)}%` };

  return (
    <div className={styles.layer} style={position as CSSProperties}>
      <span className={styles.marker} aria-hidden="true" />
      <p
        className={styles.note}
        data-side={u > 0.62 ? 'left' : 'right'}
        data-side-narrow={u > 0.5 ? 'left' : 'right'}
      >
        <span className={styles.kicker}>{t('Gempa terbaru')}</span>
        <span className={styles.line}>
          <strong>{quakeMagnitude(event.magnitude)}</strong> <span className={styles.place}>{place}</span>
        </span>
        <span className={styles.meta}>{t('{0}, sumber BMKG', ago)}</span>
      </p>
    </div>
  );
}
