import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { assessEarthquakeFeed, type FeedAssessment } from '@/domain/hazards';
import { useDataHub } from '@/features/data-hub';
import { publicConfig } from '@/lib/publicConfig';
import { ApiError, type EarthquakeFeedDTO } from '@/services/api';

/** About every two minutes while the layer is on and the page is visible. */
export const POLL_INTERVAL_MS = 120_000;

/**
 * How often the age and staleness are re-judged between requests. Without it a feed whose refreshes
 * keep failing would stay labelled as fresh, because the verdict would be frozen at the last response.
 */
export const REASSESS_INTERVAL_MS = 30_000;

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
  /** Asks for a fresh answer now (for the "Coba lagi" button); a no-op while the layer is idle. */
  readonly retry: () => void;
}

interface Result {
  readonly feed: EarthquakeFeedDTO | null;
  readonly lastError: unknown;
  readonly newIds: ReadonlySet<string>;
}

const EMPTY: Result = { feed: null, lastError: null, newIds: NO_IDS };

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
  const [nowMs, setNowMs] = useState(() => Date.now());
  const loadRef = useRef<(() => void) | null>(null);
  const retry = useCallback(() => {
    loadRef.current?.();
  }, []);

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
        setNowMs(Date.now());
        setResult({ feed, lastError: null, newIds });
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

    loadRef.current = () => {
      void load();
    };
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_INTERVAL_MS);
    const reassess = window.setInterval(() => {
      setNowMs(Date.now());
    }, REASSESS_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disposed = true;
      loadRef.current = null;
      // Whatever was shown belongs to the previous activation; a later one starts from "loading".
      setResult(EMPTY);
      window.clearInterval(reassess);
      inFlight.current?.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [active, repository]);

  // Judged against the current time, not the time of the response, so age and staleness keep moving.
  const assessment = useMemo(
    () =>
      result.feed
        ? assessEarthquakeFeed({
            origin: result.feed.origin,
            lastSuccessAt: result.feed.lastSuccessAt,
            declaredStale: result.feed.declaredStale,
            cacheTtlSeconds: result.feed.cacheTtlSeconds,
            fallbackHeader: result.feed.dataFallback,
            now: new Date(nowMs),
            allowUnverifiedPreview: publicConfig.earthquakePreview,
          })
        : null,
    [result.feed, nowMs],
  );

  if (!active || repository === null) return { status: 'idle', ...EMPTY, assessment: null, retry };
  if (result.feed) return { status: 'ready', ...result, assessment, retry };
  if (result.lastError) return { status: 'error', ...result, assessment: null, retry };
  return { status: 'loading', ...result, assessment: null, retry };
}
