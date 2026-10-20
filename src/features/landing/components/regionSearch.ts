/** Where a landing search goes. Jelajahi owns the actual region lookup once the Data Hub exists. */
export const REGION_SEARCH_PATH = '/jelajahi';
export const REGION_SEARCH_PARAM = 'cari';

export function normalizeRegionQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export function regionSearchHref(query: string): string {
  return `${REGION_SEARCH_PATH}?${new URLSearchParams({ [REGION_SEARCH_PARAM]: query }).toString()}`;
}
