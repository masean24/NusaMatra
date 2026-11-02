import { useSearchParams } from 'react-router';

/** The example region when the link names none: Kabupaten Cianjur. */
export const DEFAULT_REGION = '3203';

/** The region of the worked examples, from the link (`?wilayah=`, a four-digit kabupaten/kota code). */
export function useExampleRegion(): string {
  const [params] = useSearchParams();
  const code = params.get('wilayah');
  return code !== null && /^\d{4}$/.test(code) ? code : DEFAULT_REGION;
}
