export interface NavItem {
  readonly label: string;
  readonly to: string;
}

/** Items and order from Figma 49:447 "Navbar Melayang": one item per feature page. Text only: the bar is calmer without icons. */
export const PRIMARY_NAV_ITEMS: readonly NavItem[] = [
  { label: 'Jelajahi', to: '/jelajahi' },
  { label: 'Bandingkan', to: '/bandingkan' },
  { label: 'Lab Prioritas', to: '/lab-prioritas' },
  { label: 'Uji', to: '/uji-rekomendasi' },
  { label: 'Paspor Bukti', to: '/paspor-bukti' },
  { label: 'Cerita', to: '/cerita-wilayah' },
];
