export interface NavItem {
  readonly label: string;
  readonly to: string;
}

/**
 * The four working features, in the order of Figma 49:447 "Navbar Melayang". Text only: the bar is
 * calmer without icons. Uji Rekomendasi and Cerita Wilayah are still in development, so they are not
 * primary destinations; their routes stay and say so on the page itself.
 */
export const PRIMARY_NAV_ITEMS: readonly NavItem[] = [
  { label: 'Jelajahi', to: '/jelajahi' },
  { label: 'Bandingkan', to: '/bandingkan' },
  { label: 'Lab Prioritas', to: '/lab-prioritas' },
  { label: 'Paspor Bukti', to: '/paspor-bukti' },
];
