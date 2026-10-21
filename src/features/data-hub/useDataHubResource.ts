import { useEffect, useEffectEvent, useState } from 'react';
import { ApiError, type DataMode, type NusaMatraDataHubRepository } from '@/services/api';
import { useDataHub } from './useDataHub';

export type ResourceState<T> =
  | { readonly status: 'idle' }
  | { readonly status: 'unconfigured' }
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly data: T }
  | { readonly status: 'error'; readonly error: unknown };

type Settled<T> = Extract<ResourceState<T>, { status: 'success' | 'error' }>;

export type ResourceLoader<T> = (
  repository: NusaMatraDataHubRepository,
  dataMode: DataMode,
  signal: AbortSignal,
) => Promise<T>;

/**
 * Loads one Data Hub resource for the current mode and aborts it when the inputs change or the
 * component leaves. `key` must name every input the loader reads, apart from the mode, which is
 * always part of the identity: switching DEMO ↔ LIVE shows "loading" at once and the previous
 * mode's data is never rendered, so DEMO numbers cannot appear under LIVE.
 *
 * `enabled: false` yields `idle` (for requests that wait on a selection).
 */
export function useDataHubResource<T>(
  key: string,
  load: ResourceLoader<T>,
  enabled = true,
): { readonly state: ResourceState<T>; readonly retry: () => void } {
  const { repository, dataMode } = useDataHub();
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<{ readonly id: string; readonly result: Settled<T> } | null>(null);
  const run = useEffectEvent(load);

  const id = `${dataMode}|${String(attempt)}|${key}`;

  useEffect(() => {
    if (!repository || !enabled) return;
    const controller = new AbortController();
    run(repository, dataMode, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setSettled({ id, result: { status: 'success', data } });
      },
      (error: unknown) => {
        if (controller.signal.aborted || (error instanceof ApiError && error.isAborted)) return;
        setSettled({ id, result: { status: 'error', error } });
      },
    );
    return () => {
      controller.abort();
    };
  }, [id, repository, dataMode, enabled]);

  let state: ResourceState<T> = { status: 'loading' };
  if (!repository) state = { status: 'unconfigured' };
  else if (!enabled) state = { status: 'idle' };
  else if (settled?.id === id) state = settled.result;

  return {
    state,
    retry: () => {
      setAttempt((current) => current + 1);
    },
  };
}
