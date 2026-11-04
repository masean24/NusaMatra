import type { EarthquakeEventDTO } from '@/services/api';

/**
 * The order in which events get a card on the map: the selected one, then the newest. All of them
 * compete, so a zoomed-in view still labels what is on screen; the map shows only as many as fit.
 */
export function calloutEvents(
  events: readonly EarthquakeEventDTO[],
  selectedId: string | null,
): EarthquakeEventDTO[] {
  const newest = [...events].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  const selected = events.find((event) => event.id === selectedId);
  return selected ? [selected, ...newest.filter((event) => event !== selected)] : newest;
}
