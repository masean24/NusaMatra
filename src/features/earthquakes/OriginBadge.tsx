import { Chip } from '@/components/ui/Chip/Chip';
import type { EarthquakeOrigin } from '@/services/api';
import { ORIGIN_LABEL } from './originText';

/**
 * Names where the events came from. A cached answer is honest and normal, so it is worded plainly;
 * an undeclared or fixture origin is flagged. Freshness is a separate chip and is never implied here.
 */
export function OriginBadge({ origin }: { readonly origin: EarthquakeOrigin }) {
  const declared = origin === 'BMKG_LIVE' || origin === 'BMKG_CACHE';
  return <Chip tone={declared ? 'neutral' : 'warning'}>{ORIGIN_LABEL[origin]}</Chip>;
}
