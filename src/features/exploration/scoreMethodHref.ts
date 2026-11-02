/** Address of the "Cara skor dihitung" page (/metodologi). */
export const SCORE_METHOD_PATH = '/metodologi';

/** The id of that page's worked example, which a link may jump to. */
export const SCORE_EXAMPLE_ID = 'contoh';

/**
 * The "Cara skor dihitung" page, opened at its worked example for this indicator and, when one is
 * chosen, this region. The page reads both from the address and fetches the numbers itself.
 */
export function scoreMethodHref(indicatorId: string, regionId: string | null): string {
  const query = new URLSearchParams({ indikator: indicatorId });
  if (regionId !== null) query.set('wilayah', regionId);
  return `${SCORE_METHOD_PATH}?${query.toString()}#${SCORE_EXAMPLE_ID}`;
}
