import { t } from '@/lib/i18n';

/**
 * How a Lab result's geographic scope is worded. The name comes from the Data Hub region registry;
 * without it the code is shown and the missing name is said, never guessed.
 */
export function scopeLabel(provinceId: string | null, provinceName: string | null): string {
  if (provinceId === null) return t('seluruh Indonesia');
  return provinceName === null
    ? t('provinsi kode {0} (nama belum tersedia)', provinceId)
    : t('{0} (kode {1})', provinceName, provinceId);
}
