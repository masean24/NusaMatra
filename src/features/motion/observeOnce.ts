type Callback = () => void;

const observers = new Map<number, IntersectionObserver>();
const callbacks = new WeakMap<Element, Callback>();

function observerFor(threshold: number): IntersectionObserver {
  let observer = observers.get(threshold);
  if (!observer) {
    observer = new IntersectionObserver(
      (entries, self) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          self.unobserve(entry.target);
          callbacks.get(entry.target)?.();
          callbacks.delete(entry.target);
        }
      },
      { threshold },
    );
    observers.set(threshold, observer);
  }
  return observer;
}

/**
 * Calls `onEnter` once, the first time `threshold` of the element is visible. One observer is
 * shared per threshold. Without IntersectionObserver the callback fires immediately, so content
 * can never stay hidden.
 */
export function observeOnce(element: Element, threshold: number, onEnter: Callback): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    onEnter();
    return () => undefined;
  }
  const observer = observerFor(threshold);
  callbacks.set(element, onEnter);
  observer.observe(element);
  return () => {
    observer.unobserve(element);
    callbacks.delete(element);
  };
}
