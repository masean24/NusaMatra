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

/** Jelajahi with one region already open, for a suggestion the user picked. */
export function regionProfileHref(code: string): string {
  return `${REGION_SEARCH_PATH}?${new URLSearchParams({ [REGION_CODE_PARAM]: code }).toString()}`;
}
