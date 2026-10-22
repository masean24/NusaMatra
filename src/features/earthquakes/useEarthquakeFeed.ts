import { useEffect, useState } from 'react';
import { assessEarthquakeFeed, type FeedAssessment } from '@/domain/hazards';
import { useDataHub } from '@/features/data-hub';
import { publicConfig } from '@/lib/publicConfig';
import { ApiError, type EarthquakeFeedDTO } from '@/services/api';

/** About every two minutes while the layer is on and the page is visible. */
export const POLL_INTERVAL_MS = 120_000;

const NO_IDS: ReadonlySet<string> = new Set();

export interface EarthquakeFeedState {
  /** `idle` = layer off or not in LIVE; `loading` = first request in flight. */
  readonly status: 'idle' | 'loading' | 'ready' | 'error';
  readonly feed: EarthquakeFeedDTO | null;
  /** Judged when the response arrived (origin, staleness, preview opt-in). */
  readonly assessment: FeedAssessment | null;
  /** The last request failed; `feed` (if any) is from an earlier successful one. */
  readonly lastError: unknown;
  /** Events that appeared in the latest update but not the one before (none on the first load). */
  readonly newIds: ReadonlySet<string>;
}

interface Result {
  readonly feed: EarthquakeFeedDTO | null;
  readonly assessment: FeedAssessment | null;
  readonly lastError: unknown;
  readonly newIds: ReadonlySet<string>;
}

const EMPTY: Result = { feed: null, assessment: null, lastError: null, newIds: NO_IDS };

/**
 * Polls the Data Hub's BMKG feed while `enabled`, in LIVE only (BMKG events belong on the official
 * map, never on the DEMO illustration). Requests stop when the layer is switched off or the page is
 * left, and are skipped while the tab is hidden; returning to the tab refreshes if due. A failed
 * refresh keeps the last data, flagged, rather than dropping or pretending it is current.
 */
export function useEarthquakeFeed(enabled: boolean): EarthquakeFeedState {
  const { repository, dataMode } = useDataHub();
  const active = enabled && dataMode === 'LIVE';
  const [result, setResult] = useState<Result>(EMPTY);

  useEffect(() => {
    if (!active || repository === null) return;
    let disposed = false;
    const inFlight: { current: AbortController | null } = { current: null };
    let lastRequestAt = 0;
    let knownIds: ReadonlySet<string> | null = null;

    const load = async () => {
      inFlight.current?.abort();
      const current = new AbortController();
      inFlight.current = current;
      lastRequestAt = Date.now();
      try {
        const feed = await repository.getEarthquakeFeed({ dataMode: 'LIVE', signal: current.signal });
        if (disposed || current.signal.aborted) return;
        const ids = new Set(feed.events.map((event) => event.id));
        const previous = knownIds;
        const newIds = previous ? new Set([...ids].filter((id) => !previous.has(id))) : NO_IDS;
        knownIds = ids;
        const assessment = assessEarthquakeFeed({
          origin: feed.origin,
          lastSuccessAt: feed.lastSuccessAt,
          declaredStale: feed.declaredStale,
          cacheTtlSeconds: feed.cacheTtlSeconds,
          fallbackHeader: feed.dataFallback,
          now: new Date(),
          allowUnverifiedPreview: publicConfig.earthquakePreview,
        });
        setResult({ feed, assessment, lastError: null, newIds });
      } catch (error: unknown) {
        if (disposed || (error instanceof ApiError && error.isAborted)) return;
        setResult((previous) => ({ ...previous, lastError: error, newIds: NO_IDS }));
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRequestAt >= POLL_INTERVAL_MS) {
        void load();
      }
    };

    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disposed = true;
      inFlight.current?.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [active, repository]);

  if (!active || repository === null) return { status: 'idle', ...EMPTY };
  if (result.feed) return { status: 'ready', ...result };
  if (result.lastError) return { status: 'error', ...result };
  return { status: 'loading', ...result };
}
