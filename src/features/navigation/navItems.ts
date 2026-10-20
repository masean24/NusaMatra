import type { IconName } from '@/components/ui/Icon/Icon';

export interface NavItem {
  readonly label: string;
  readonly to: string;
  readonly icon: IconName;
}

/** Items, order and icons from Figma 49:447 "Navbar Melayang": one item per feature page. */
export const PRIMARY_NAV_ITEMS: readonly NavItem[] = [
  { label: 'Jelajahi', to: '/jelajahi', icon: 'map' },
  { label: 'Bandingkan', to: '/bandingkan', icon: 'compare' },
  { label: 'Lab Prioritas', to: '/lab-prioritas', icon: 'lab' },
  { label: 'Uji', to: '/uji-rekomendasi', icon: 'test' },
  { label: 'Paspor Bukti', to: '/paspor-bukti', icon: 'passport' },
  { label: 'Cerita', to: '/cerita-wilayah', icon: 'story' },
];
