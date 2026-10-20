import { render, renderHook, screen } from '@testing-library/react';
import { act } from 'react';
import { enterViewport, setMediaQueryMatches } from '@/test/browserMocks';
import { Reveal } from './Reveal';
import { REDUCED_MOTION_QUERY, useReducedMotion } from './useReducedMotion';

describe('Reveal', () => {
  it('reveals once the element enters the viewport', () => {
    render(<Reveal>Isi bagian</Reveal>);
    const wrapper = screen.getByText('Isi bagian');
    expect(wrapper).toHaveAttribute('data-revealed', 'false');
    act(() => {
      enterViewport();
    });
    expect(wrapper).toHaveAttribute('data-revealed', 'true');
  });

  it('plays immediately for load-triggered (hero) content without waiting for an observer', () => {
    render(<Reveal trigger="load">Judul</Reveal>);
    expect(screen.getByText('Judul')).toHaveAttribute('data-revealed', 'true');
  });

  it('never leaves content hidden when IntersectionObserver is unavailable', () => {
    const original = window.IntersectionObserver;
    // @ts-expect-error simulating a browser without IntersectionObserver
    delete window.IntersectionObserver;
    try {
      render(<Reveal>Tetap terlihat</Reveal>);
      expect(screen.getByText('Tetap terlihat')).toHaveAttribute('data-revealed', 'true');
    } finally {
      window.IntersectionObserver = original;
    }
  });

  it('passes motion values to CSS so reduced-motion styles can drop them', () => {
    render(
      <Reveal distance={28} delay={90}>
        Teks
      </Reveal>,
    );
    const wrapper = screen.getByText('Teks');
    expect(wrapper.style.getPropertyValue('--reveal-y')).toBe('28px');
    expect(wrapper.style.getPropertyValue('--reveal-delay')).toBe('90ms');
  });
});

describe('useReducedMotion', () => {
  it('follows the prefers-reduced-motion media query', () => {
    expect(renderHook(() => useReducedMotion()).result.current).toBe(false);
    setMediaQueryMatches(REDUCED_MOTION_QUERY, true);
    expect(renderHook(() => useReducedMotion()).result.current).toBe(true);
  });
});
