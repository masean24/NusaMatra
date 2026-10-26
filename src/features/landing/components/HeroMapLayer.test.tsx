import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEMO_HERO_CARDS } from '@/data/fixtures/landingDemo';
import { HERO_PINS, pinPositionInZone } from '../heroMapPins';
import { HeroMapLayer } from './HeroMapLayer';

describe('HERO_PINS', () => {
  it('maps every pin to a distinct region card, and every card to a pin', () => {
    expect(HERO_PINS.map((pin) => pin.id).sort()).toEqual(DEMO_HERO_CARDS.map((card) => card.id).sort());
  });

  it('places each pin inside the hero zone', () => {
    for (const pin of HERO_PINS) {
      const { u, v } = pinPositionInZone(pin);
      expect(u).toBeGreaterThan(0.05);
      expect(u).toBeLessThan(0.95);
      expect(v).toBeGreaterThan(0.1);
      expect(v).toBeLessThan(0.95);
    }
  });
});

describe('HeroMapLayer', () => {
  beforeEach(() => {
    // jsdom has no ResizeObserver; the layer only needs it to re-measure on resize.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has one pin button per region card and reports which one was pressed', async () => {
    const onToggle = vi.fn();
    render(<HeroMapLayer visible activeId="b" onToggle={onToggle} reducedMotion={false} />);

    const pins = screen.getAllByRole('button');
    expect(pins).toHaveLength(3);
    expect(screen.getByRole('button', { name: /Wilayah B/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Wilayah A/ })).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(screen.getByRole('button', { name: /Wilayah C/ }));
    expect(onToggle).toHaveBeenCalledWith('c');
  });

  it('keeps the pins out of the tab order until they have dropped in', () => {
    render(<HeroMapLayer visible={false} activeId={null} onToggle={() => undefined} reducedMotion />);
    for (const pin of screen.getAllByRole('button', { hidden: true })) {
      expect(pin).toHaveAttribute('tabindex', '-1');
    }
  });
});
