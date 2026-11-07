import type { DepthClass } from '@/domain/hazards';
import { t } from '@/lib/i18n';

/** BMKG's own page on the scale; the meanings below are shortened from it. */
export const BMKG_MMI_PAGE = 'https://www.bmkg.go.id/gempabumi/skala-mmi';

/** What a level of the MMI scale means, shortened from BMKG's description. */
export function mmiMeaning(level: number): string | null {
  switch (level) {
    case 1:
      return t('Tidak terasa, kecuali oleh beberapa orang dalam keadaan luar biasa.');
    case 2:
      return t('Terasa oleh beberapa orang; benda ringan yang digantung bergoyang.');
    case 3:
      return t('Terasa nyata di dalam rumah, seakan ada truk lewat.');
    case 4:
      return t('Pada siang hari terasa oleh banyak orang di dalam rumah; jendela dan pintu berderik.');
    case 5:
      return t('Terasa oleh hampir semua penduduk; banyak orang terbangun, gerabah pecah.');
    case 6:
      return t('Terasa oleh semua penduduk; kebanyakan lari keluar, kerusakan ringan.');
    case 7:
      return t('Semua orang keluar rumah; bangunan berkonstruksi kurang baik retak hingga hancur.');
    case 8:
      return t('Kerusakan ringan pada bangunan kuat; bangunan kurang baik retak, dinding dapat lepas.');
    case 9:
      return t('Bangunan kuat rusak, rangka rumah tidak lurus, pipa dalam rumah putus.');
    case 10:
      return t('Bangunan kayu yang kuat rusak, tanah terbelah, rel melengkung, tanah longsor.');
    case 11:
      return t('Hanya sedikit bangunan tetap berdiri; jembatan rusak, tanah terbelah.');
    case 12:
      return t('Hancur sama sekali; gelombang tampak di permukaan tanah, benda terlempar ke udara.');
    default:
      return null;
  }
}

export function depthClassText(depthClass: DepthClass): string {
  switch (depthClass) {
    case 'shallow':
      return t('Gempa dangkal, kurang dari 60 km');
    case 'intermediate':
      return t('Gempa menengah, 60 sampai 300 km');
    case 'deep':
      return t('Gempa dalam, lebih dari 300 km');
  }
}
