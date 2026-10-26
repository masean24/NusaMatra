import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { REGION_CODE_PARAM, REGION_SEARCH_PARAM } from '@/features/landing';
import { parseRegionId } from './regionSelection';

export { REGION_CODE_PARAM };

/**
 * Jelajahi's URL state: the search text (`?cari=`, also what the landing search hands over) and the
 * selected Data Hub region (`?kode=`). The illustrative 3D map keeps its own `?wilayah=`.
 */
export function useRegionBrowserParams(): {
  readonly query: string;
  readonly selectedCode: string | null;
  readonly setQuery: (query: string) => void;
  /** `clearQuery`: also drop the search text, in the same URL update (two updates would race). */
  readonly selectCode: (code: string | null, options?: { readonly clearQuery?: boolean }) => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get(REGION_SEARCH_PARAM) ?? '';
  const selectedCode = parseRegionId(searchParams.get(REGION_CODE_PARAM));

  const setQuery = useCallback(
    (next: string) => {
      setSearchParams(
        (params) => {
          if (next) params.set(REGION_SEARCH_PARAM, next);
          else params.delete(REGION_SEARCH_PARAM);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const selectCode = useCallback(
    (code: string | null, options?: { readonly clearQuery?: boolean }) => {
      setSearchParams((params) => {
        if (code) params.set(REGION_CODE_PARAM, code);
        else params.delete(REGION_CODE_PARAM);
        if (options?.clearQuery) params.delete(REGION_SEARCH_PARAM);
        return params;
      });
    },
    [setSearchParams],
  );

  return { query, selectedCode, setQuery, selectCode };
}
