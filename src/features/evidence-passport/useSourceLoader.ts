import { useEffect, useEffectEvent, useState } from 'react';
import { useDataHub } from '@/features/data-hub';
import { ApiError, type NusaMatraDataHubRepository } from '@/services/api';

export type SourcesState<T> =
  | { readonly status: 'idle' }
  | { readonly status: 'unconfigured' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly sources: T }
  | { readonly status: 'error'; readonly error: unknown };

type Settled<T> = Extract<SourcesState<T>, { status: 'ready' | 'error' }>;

/** Snapshot integrity failures: never a gap, because the response came from other data than the record. */
const SNAPSHOT_FAILURES = new Set(['SNAPSHOT_NOT_FOUND', 'SNAPSHOT_MISMATCH', 'SNAPSHOT_DIGEST_MISMATCH']);

/**
 * A supporting request that failed is a stated gap (`null`), unless it was cancelled with the page or
 * answered from another snapshot than the pinned one: that fails the whole passport.
 */
export function supporting<T>(request: Promise<T>): Promise<T | null> {
  return request.catch((error: unknown) => {
    if (error instanceof ApiError && (error.isAborted || SNAPSHOT_FAILURES.has(error.code))) throw error;
    return null;
  });
}

/**
 * Loads everything one passport needs, once per `id`. `id` must name every input the loader reads
 * (including the mode); a new `id` shows "loading" at once and aborts the previous request, so one
 * mode's record is never shown under another. Nothing falls back from LIVE to DEMO.
 */
export function useSourceLoader<T>(
  id: string,
  load: (repository: NusaMatraDataHubRepository, signal: AbortSignal) => Promise<T>,
  enabled: boolean,
): { readonly state: SourcesState<T>; readonly retry: () => void } {
  const { repository } = useDataHub();
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<{ readonly id: string; readonly result: Settled<T> } | null>(null);
  const key = `${String(attempt)}|${id}`;
  const run = useEffectEvent(load);

  useEffect(() => {
    if (!repository || !enabled) return;
    const controller = new AbortController();
    run(repository, controller.signal).then(
      (sources) => {
        if (!controller.signal.aborted) setSettled({ id: key, result: { status: 'ready', sources } });
      },
      (error: unknown) => {
        if (controller.signal.aborted || (error instanceof ApiError && error.isAborted)) return;
        setSettled({ id: key, result: { status: 'error', error } });
      },
    );
    return () => {
      controller.abort();
    };
  }, [key, repository, enabled]);

  let state: SourcesState<T> = { status: 'loading' };
  if (!enabled) state = { status: 'idle' };
  else if (!repository) state = { status: 'unconfigured' };
  else if (settled?.id === key) state = settled.result;

  return {
    state,
    retry: () => {
      setAttempt((current) => current + 1);
    },
  };
}
