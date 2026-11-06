import type { EarthquakeOrigin } from '@/services/api';
import { LOCALE, t } from '@/lib/i18n';

/** Plain-language origin the Data Hub declared for the feed (`bmkg_live`, `bmkg_cache`, `fixture`, or nothing). */
export const ORIGIN_LABEL: Readonly<Record<EarthquakeOrigin, string>> = {
  BMKG_LIVE: t('Asal: langsung dari BMKG'),
  BMKG_CACHE: t('Asal: cache Data Hub (dari BMKG)'),
  FIXTURE: t('Asal: fixture lokal, bukan BMKG'),
  UNDECLARED: t('Asal: tidak dinyatakan Data Hub'),
};

/** WIB wall-clock time of the Data Hub's last successful BMKG fetch, or a statement that it is unknown. */
export function describeLastSuccess(lastSuccessAt: string | null): string {
  const parsed = lastSuccessAt === null ? Number.NaN : Date.parse(lastSuccessAt);
  if (Number.isNaN(parsed)) return t('Waktu pengambilan terakhir dari BMKG tidak disebutkan');
  const when = new Date(parsed).toLocaleString(LOCALE, {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return t('Terakhir diambil dari BMKG {0} WIB', when);
}
