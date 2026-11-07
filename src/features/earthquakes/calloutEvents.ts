import type { EarthquakeEventDTO } from '@/services/api';

export const newestFirst = (events: readonly EarthquakeEventDTO[]): EarthquakeEventDTO[] =>
  [...events].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));

/**
 * The events that get a card on the map. With one selected, only that one: the panel tells the rest
 * and the map stays clear around it. Otherwise all compete, newest first, so a zoomed-in view still
 * labels what is on screen; the map shows only as many as fit.
 */
export function calloutEvents(
  events: readonly EarthquakeEventDTO[],
  selectedId: string | null,
): EarthquakeEventDTO[] {
  const selected = events.find((event) => event.id === selectedId);
  return selected ? [selected] : newestFirst(events);
}
