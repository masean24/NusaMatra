import { vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { DisplayModeProvider } from '@/features/theme';
import { FloatingNavbar } from './FloatingNavbar';
import { PRIMARY_NAV_ITEMS } from './navItems';

function renderAt(path: string) {
  const router = createMemoryRouter([{ path: '*', element: <FloatingNavbar /> }], { initialEntries: [path] });
  render(
    <DisplayModeProvider>
      <RouterProvider router={router} />
    </DisplayModeProvider>,
  );
  return router;
}

/** Desktop and mobile layouts are both rendered (CSS picks one); the first nav is the desktop bar. */
function desktopNav() {
  const [desktop] = screen.getAllByRole('navigation', { name: 'Navigasi utama' });
  if (!desktop) throw new Error('desktop navigation not rendered');
  return within(desktop);
}

describe('FloatingNavbar', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists the Figma items in order with real destinations', () => {
    renderAt('/');
    const links = desktopNav().getAllByRole('link');
    expect(links).toHaveLength(PRIMARY_NAV_ITEMS.length);
    PRIMARY_NAV_ITEMS.forEach((item, index) => {
      // The accessible name ignores the aria-hidden "on liquid" copy of the label.
      expect(links[index]).toHaveAccessibleName(item.label);
      expect(links[index]).toHaveAttribute('href', item.to);
    });
  });

  it('offers only the four working features; unfinished pages are not primary destinations', () => {
    renderAt('/');
    expect(
      desktopNav()
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Jelajahi', 'Bandingkan', 'Lab Prioritas', 'Paspor Bukti']);
    for (const nav of screen.getAllByRole('navigation', { name: 'Navigasi utama' })) {
      expect(within(nav).queryByRole('link', { name: 'Uji' })).toBeNull();
      expect(within(nav).queryByRole('link', { name: 'Cerita' })).toBeNull();
    }
  });

  it('marks exactly one item as the current page', () => {
    renderAt('/bandingkan');
    const current = desktopNav()
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName('Bandingkan');
  });

  it('moves the active state with navigation, including browser back', async () => {
    const router = renderAt('/');
    await userEvent.click(desktopNav().getByRole('link', { name: 'Lab Prioritas' }));
    expect(desktopNav().getByRole('link', { name: 'Lab Prioritas' })).toHaveAttribute('aria-current', 'page');

    await userEvent.click(desktopNav().getByRole('link', { name: 'Bandingkan' }));
    expect(desktopNav().getByRole('link', { name: 'Lab Prioritas' })).not.toHaveAttribute('aria-current');

    await router.navigate(-1);
    // `findByRole` alone resolves as soon as the link exists, before the history pop has rendered;
    // wait for the state itself (this raced when the whole suite ran under load).
    await waitFor(() => {
      expect(desktopNav().getByRole('link', { name: 'Lab Prioritas' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });
    expect(desktopNav().getByRole('link', { name: 'Bandingkan' })).not.toHaveAttribute('aria-current');
  });

  it('rests the single selection pill on the current route', () => {
    renderAt('/bandingkan');
    const links = desktopNav().getAllByRole('link');
    expect(links.filter((link) => link.dataset['targeted'] === 'true')).toHaveLength(1);
    expect(desktopNav().getByRole('link', { name: 'Bandingkan' })).toHaveAttribute('data-targeted', 'true');
    expect(document.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });

  it('previews hover with the same pill for mouse and pen only, and returns to the route on leave', () => {
    renderAt('/bandingkan');
    const route = desktopNav().getByRole('link', { name: 'Bandingkan' });
    const other = desktopNav().getByRole('link', { name: 'Paspor Bukti' });

    fireEvent.pointerEnter(other, { pointerType: 'touch' });
    expect(route).toHaveAttribute('data-targeted', 'true');

    fireEvent.pointerEnter(other, { pointerType: 'mouse' });
    expect(other).toHaveAttribute('data-targeted', 'true');
    expect(route).not.toHaveAttribute('data-targeted');
    expect(window.location.pathname).not.toBe('/paspor-bukti'); // hover never navigates

    const list = other.closest('ul')?.parentElement;
    if (!list) throw new Error('link list not found');
    fireEvent.pointerLeave(list, { pointerType: 'mouse' });
    expect(route).toHaveAttribute('data-targeted', 'true');
    expect(other).not.toHaveAttribute('data-targeted');
  });

  it('follows keyboard focus with the pill and returns when focus leaves the list', async () => {
    // jsdom has no :focus-visible; report keyboard-style focus the way a browser would.
    // eslint-disable-next-line @typescript-eslint/unbound-method -- invoked with the right `this` below
    const matches = Element.prototype.matches;
    vi.spyOn(Element.prototype, 'matches').mockImplementation(function (this: Element, selector: string) {
      return selector === ':focus-visible' || matches.call(this, selector);
    });
    renderAt('/');
    const first = desktopNav().getAllByRole('link')[0];
    if (!first) throw new Error('no links');
    first.focus();
    await userEvent.keyboard('{Tab}');
    const second = desktopNav().getAllByRole('link')[1];
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute('data-targeted', 'true');
  });

  it('keeps the decorative pill out of the accessibility tree and the tab order', () => {
    renderAt('/jelajahi');
    const [desktop] = screen.getAllByRole('navigation', { name: 'Navigasi utama' });
    const pill = desktop?.querySelector('span[aria-hidden="true"]');
    expect(pill).not.toBeNull();
    expect(desktopNav().getAllByRole('listitem')).toHaveLength(PRIMARY_NAV_ITEMS.length);
  });
});
