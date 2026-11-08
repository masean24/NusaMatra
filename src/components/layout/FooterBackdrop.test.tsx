import { act, render } from '@testing-library/react';
import { FooterBackdrop } from './FooterBackdrop';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubIntersectionObserver() {
  const instances: {
    callback: IntersectionObserverCallback;
    options?: IntersectionObserverInit | undefined;
    target?: Element | undefined;
  }[] = [];
  class FakeObserver {
    readonly entry: (typeof instances)[number];
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.entry = { callback, options };
      instances.push(this.entry);
    }
    observe(target: Element) {
      this.entry.target = target;
    }
    disconnect() {}
  }
  vi.stubGlobal('IntersectionObserver', FakeObserver);
  return instances;
}

describe('footer backdrop', () => {
  it('is decoration only: every layer is hidden from screen readers', () => {
    const { container } = render(
      <footer>
        <FooterBackdrop />
      </footer>,
    );
    const layers = container.querySelectorAll('footer > *');
    expect(layers).toHaveLength(3);
    for (const layer of layers) expect(layer.getAttribute('aria-hidden')).toBe('true');
  });

  it('defaults to the glow and takes the shadow when asked', () => {
    const { container, rerender } = render(<FooterBackdrop />);
    expect(container.querySelectorAll('[data-bottom="glow"]')).toHaveLength(3);
    rerender(<FooterBackdrop bottom="shadow" />);
    expect(container.querySelectorAll('[data-bottom="shadow"]')).toHaveLength(3);
  });

  it('gives each instance its own gradient ids, and every fill points at one of its own', () => {
    const { container } = render(
      <>
        <FooterBackdrop />
        <FooterBackdrop />
      </>,
    );
    const ids = [...container.querySelectorAll('[id]')].map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const node of container.querySelectorAll('[fill^="url(#"]')) {
      const target = /^url\(#(.+)\)$/.exec(node.getAttribute('fill') ?? '')?.[1];
      expect(ids).toContain(target);
    }
  });

  it('raises the wordmark once a quarter of the footer is on screen, and not before', () => {
    const observers = stubIntersectionObserver();
    const { container } = render(
      <footer>
        <FooterBackdrop />
      </footer>,
    );
    const wordmark = container.querySelector('svg[viewBox="0 0 1123 126"]');
    expect(wordmark?.hasAttribute('data-shown')).toBe(false);
    expect(observers).toHaveLength(1);
    const [observer] = observers;
    if (!observer) throw new Error('no IntersectionObserver was created');
    expect(observer.options?.threshold).toBe(0.25);
    expect(observer.target?.tagName).toBe('FOOTER');
    act(() => {
      observer.callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    expect(wordmark?.hasAttribute('data-shown')).toBe(true);
  });

  it('shows the wordmark at once where IntersectionObserver is missing', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { container } = render(<FooterBackdrop />);
    expect(container.querySelector('svg[viewBox="0 0 1123 126"]')?.hasAttribute('data-shown')).toBe(true);
  });
});
