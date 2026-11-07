import { magnitudeBand } from '@/domain/hazards';
import type { EarthquakeEventDTO } from '@/services/api';
import { calloutEvents } from './calloutEvents';

const event = (id: string, occurredAt: string) => ({ id, occurredAt }) as EarthquakeEventDTO;

describe('calloutEvents', () => {
  const events = [
    event('old', '2026-10-01T00:00:00Z'),
    event('new', '2026-10-03T00:00:00Z'),
    event('mid', '2026-10-02T00:00:00Z'),
  ];

  it('orders the newest first', () => {
    expect(calloutEvents(events, null).map(({ id }) => id)).toEqual(['new', 'mid', 'old']);
  });

  it('gives a card to the selected event alone, so the map stays clear around it', () => {
    expect(calloutEvents(events, 'old').map(({ id }) => id)).toEqual(['old']);
  });

  it('falls back to all of them when the selected event has left the feed', () => {
    expect(calloutEvents(events, 'gone')).toHaveLength(3);
  });
});

describe('magnitudeBand', () => {
  it.each([
    [6.1, 'strong'],
    [5, 'strong'],
    [4.9, 'moderate'],
    [4, 'moderate'],
    [3.9, 'light'],
  ])('reads magnitude %d as %s', (magnitude, band) => {
    expect(magnitudeBand(magnitude)).toBe(band);
  });
});
