import type { EarthquakeEventDTO } from '@/services/api';

const decimal = (value: number, digits: number) =>
  value.toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** "Magnitudo 5,1": BMKG does not state the magnitude scale in this feed, so no "SR". */
export const formatMagnitude = (magnitude: number) => `Magnitudo ${decimal(magnitude, 1)}`;

export const formatDepth = (depthKm: number | null) =>
  depthKm === null ? 'Kedalaman tidak disebutkan' : `${decimal(depthKm, 0)} km`;

/** "M 5,1", the short form on a card or badge that has the full word in its accessible name. */
export const formatMagnitudeShort = (magnitude: number) => `M ${decimal(magnitude, 1)}`;

/** The magnitude, place and time as one sentence, for the name of a button that shows them apart. */
export const describeEvent = (
  event: Pick<EarthquakeEventDTO, 'magnitude' | 'area' | 'occurredAt' | 'localDate' | 'localTime'>,
) =>
  `${formatMagnitude(event.magnitude)}, ${event.area ?? 'Lokasi tidak disebutkan'}, ${formatEventTime(event)}`;

/** "3,79° LU, 95,72° BT": hemisphere words instead of signs. */
export function formatEpicentre(event: Pick<EarthquakeEventDTO, 'latitude' | 'longitude'>): string {
  const lat = `${decimal(Math.abs(event.latitude), 2)}° ${event.latitude < 0 ? 'LS' : 'LU'}`;
  const lon = `${decimal(Math.abs(event.longitude), 2)}° ${event.longitude < 0 ? 'BB' : 'BT'}`;
  return `${lat}, ${lon}`;
}

/** BMKG's own local date and time when sent; otherwise the instant shown in WIB. */
export function formatEventTime(
  event: Pick<EarthquakeEventDTO, 'occurredAt' | 'localDate' | 'localTime'>,
): string {
  if (event.localDate && event.localTime) return `${event.localDate}, ${event.localTime}`;
  return `${new Date(event.occurredAt).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'medium',
  })} WIB`;
}

/** Plain-text label for the map hover, e.g. "Magnitudo 5,1 · 62 km TimurLaut MALUKUBRTDAYA". */
export const markerLabel = (event: EarthquakeEventDTO) =>
  event.area ? `${formatMagnitude(event.magnitude)}, ${event.area}` : formatMagnitude(event.magnitude);
