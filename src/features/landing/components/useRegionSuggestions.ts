import { useDataHubResource, type ResourceState } from '@/features/data-hub';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { DataHubRegionDTO } from '@/services/api';
import { normalizeRegionQuery } from './regionSearch';

/** Suggestions start once the query can narrow the list; fewer letters match almost everything. */
export const SUGGESTION_MIN_LENGTH = 2;
const SUGGESTION_DEBOUNCE_MS = 250;
const SUGGESTION_LIMIT = 6;

export interface RegionSuggestions {
  readonly state: ResourceState<readonly DataHubRegionDTO[]>;
  /** The query the shown state belongs to; it trails the typed text by the debounce. */
  readonly query: string;
}

/**
 * Region names matching what the user is typing, from the same Data Hub search Jelajahi uses
 * (DEMO or LIVE, whichever is active). Nothing is suggested before two letters, and no name is
 * invented when the Data Hub is unavailable.
 */
export function useRegionSuggestions(typed: string): RegionSuggestions {
  const query = useDebouncedValue(normalizeRegionQuery(typed), SUGGESTION_DEBOUNCE_MS);
  const enabled = query.length >= SUGGESTION_MIN_LENGTH;
  const resource = useDataHubResource(
    `landing-suggestions|${query}`,
    async (repository, dataMode, signal) => {
      const envelope = await repository.searchRegions({ dataMode, query, signal });
      return envelope.data.slice(0, SUGGESTION_LIMIT);
    },
    enabled,
  );
  return { state: resource.state, query };
}
