/**
 * How a Lab result's geographic scope is worded. The name comes from the Data Hub region registry;
 * without it the code is shown and the missing name is said, never guessed.
 */
export function scopeLabel(provinceId: string | null, provinceName: string | null): string {
  if (provinceId === null) return 'seluruh Indonesia';
  return provinceName === null
    ? `provinsi kode ${provinceId} (nama belum tersedia)`
    : `${provinceName} (kode ${provinceId})`;
}
