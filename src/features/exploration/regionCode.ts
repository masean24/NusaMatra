import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { REGION_SEARCH_PARAM } from '@/features/landing';
import { parseRegionId } from './regionSelection';

/** The Data Hub region chosen in the Jelajahi list (a BPS-style code such as "3201"), shareable in the URL. */
export const REGION_CODE_PARAM = 'kode';

/**
 * Jelajahi's URL state: the search text (`?cari=`, also what the landing search hands over) and the
 * selected Data Hub region (`?kode=`). The illustrative 3D map keeps its own `?wilayah=`.
 */
export function useRegionBrowserParams(): {
  readonly query: string;
  readonly selectedCode: string | null;
  readonly setQuery: (query: string) => void;
  readonly selectCode: (code: string | null) => void;
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
    (code: string | null) => {
      setSearchParams((params) => {
        if (code) params.set(REGION_CODE_PARAM, code);
        else params.delete(REGION_CODE_PARAM);
        return params;
      });
    },
    [setSearchParams],
  );

  return { query, selectedCode, setQuery, selectCode };
}
