import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

/** docs/04 §5.1: the selected region is shareable navigation state and lives in the URL. */
export const REGION_PARAM = 'wilayah';

/** Region ids are stable identifiers (e.g. "ID-DEMO-JAWA"); anything else in the URL is ignored. */
const REGION_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

export function parseRegionId(raw: string | null): string | null {
  const value = raw?.trim() ?? '';
  return REGION_ID_PATTERN.test(value) ? value : null;
}

/** Host-owned region selection for map pages: read from and written to `?wilayah=`. */
export function useRegionSelection(): {
  selectedRegionId: string | null;
  selectRegion: (regionId: string) => void;
  clearRegion: () => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedRegionId = parseRegionId(searchParams.get(REGION_PARAM));

  const selectRegion = useCallback(
    (regionId: string) => {
      const id = parseRegionId(regionId);
      if (!id) return;
      setSearchParams((params) => {
        params.set(REGION_PARAM, id);
        return params;
      });
    },
    [setSearchParams],
  );

  const clearRegion = useCallback(() => {
    setSearchParams((params) => {
      params.delete(REGION_PARAM);
      return params;
    });
  }, [setSearchParams]);

  return { selectedRegionId, selectRegion, clearRegion };
}
