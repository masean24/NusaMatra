/** Where a landing search goes. Jelajahi owns the actual region lookup once the Data Hub exists. */
export const REGION_SEARCH_PATH = '/jelajahi';
export const REGION_SEARCH_PARAM = 'cari';
/** The Data Hub region open in Jelajahi (a BPS-style code such as "3201"), shareable in the URL. */
export const REGION_CODE_PARAM = 'kode';

export function normalizeRegionQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export function regionSearchHref(query: string): string {
  return `${REGION_SEARCH_PATH}?${new URLSearchParams({ [REGION_SEARCH_PARAM]: query }).toString()}`;
}

/** Lower case, single spaces, and without the "Kabupaten"/"Kab."/"Kota" that people may leave out. */
function bareName(name: string): string {
  return normalizeRegionQuery(name)
    .toLowerCase()
    .replace(/^(kabupaten|kab\.?|kota)\s+/, '');
}

/**
 * The one region a typed search clearly means, among the regions the Data Hub found for it, or
 * null when it is not clear. Clear: the full name typed ("Kota Bandung"), or the only region with
 * the typed name ("Cianjur"), or the only region found at all. "Bandung" (a kabupaten and a kota)
 * is not clear: the visitor chooses.
 */
export function regionMatchingQuery<T extends { readonly displayName: string }>(
  query: string,
  regions: readonly T[],
): T | null {
  const typed = normalizeRegionQuery(query).toLowerCase();
  const fullName = regions.filter(
    (region) => normalizeRegionQuery(region.displayName).toLowerCase() === typed,
  );
  if (fullName.length === 1) return fullName[0] ?? null;
  const sameName = regions.filter((region) => bareName(region.displayName) === bareName(typed));
  if (sameName.length === 1) return sameName[0] ?? null;
  return regions.length === 1 ? (regions[0] ?? null) : null;
}

/** Jelajahi with one region already open, for a suggestion the user picked. */
export function regionProfileHref(code: string): string {
  return `${REGION_SEARCH_PATH}?${new URLSearchParams({ [REGION_CODE_PARAM]: code }).toString()}`;
}
