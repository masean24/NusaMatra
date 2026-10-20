/**
 * Small, explicit stand-ins for browser APIs jsdom does not implement. Tests opt into the
 * behaviour they need (a matching media query, an element entering the viewport).
 */
const matchingQueries = new Set<string>();

export function setMediaQueryMatches(query: string, matches: boolean): void {
  if (matches) matchingQueries.add(query);
  else matchingQueries.delete(query);
}

export function installMatchMedia(): void {
  window.matchMedia = (query: string) =>
    ({
      media: query,
      matches: matchingQueries.has(query),
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

export function resetMediaQueries(): void {
  matchingQueries.clear();
}

type ObserverRecord = {
  callback: IntersectionObserverCallback;
  elements: Set<Element>;
  observer: IntersectionObserver;
};
const observers: ObserverRecord[] = [];

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '0px';
  readonly thresholds = [0];
  readonly scrollMargin = '0px';
  private readonly record: ObserverRecord;

  constructor(callback: IntersectionObserverCallback) {
    this.record = { callback, elements: new Set(), observer: this };
    observers.push(this.record);
  }

  observe(element: Element): void {
    this.record.elements.add(element);
  }

  unobserve(element: Element): void {
    this.record.elements.delete(element);
  }

  disconnect(): void {
    this.record.elements.clear();
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

export function installIntersectionObserver(): void {
  window.IntersectionObserver = MockIntersectionObserver;
}

/** Simulates every observed element scrolling into view. */
export function enterViewport(): void {
  for (const record of observers) {
    const entries = [...record.elements].map(
      (target) => ({ target, isIntersecting: true, intersectionRatio: 1 }) as IntersectionObserverEntry,
    );
    if (entries.length > 0) record.callback(entries, record.observer);
  }
}

export function resetIntersectionObservers(): void {
  observers.length = 0;
}
