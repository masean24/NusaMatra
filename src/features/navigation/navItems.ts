import { t } from '@/lib/i18n';

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
  { label: t('Jelajahi'), to: '/jelajahi' },
  { label: t('Bandingkan'), to: '/bandingkan' },
  { label: t('Lab Prioritas'), to: '/lab-prioritas' },
  { label: t('Paspor Bukti'), to: '/paspor-bukti' },
];
