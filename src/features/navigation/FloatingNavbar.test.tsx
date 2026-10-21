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

  it('starts the hover liquid only for mouse or pen, and recedes it on leave', () => {
    renderAt('/');
    const link = desktopNav().getByRole('link', { name: 'Jelajahi' });

    fireEvent.pointerEnter(link, { pointerType: 'touch', clientX: 10, clientY: 10 });
    expect(link).not.toHaveAttribute('data-liquid');

    fireEvent.pointerEnter(link, { pointerType: 'mouse', clientX: 12, clientY: 8 });
    expect(link).toHaveAttribute('data-liquid', 'on');
    expect(link.style.getPropertyValue('--liquid-x')).toBe('12px');
    expect(link.style.getPropertyValue('--liquid-y')).toBe('8px');

    fireEvent.pointerLeave(link, { pointerType: 'mouse', clientX: 40, clientY: 8 });
    expect(link).not.toHaveAttribute('data-liquid');
    expect(link.style.getPropertyValue('--liquid-x')).toBe('40px');
  });

  it('marks a press so the item can compress, and clears it on release', () => {
    renderAt('/');
    const link = desktopNav().getByRole('link', { name: 'Uji' });
    fireEvent.pointerDown(link, { pointerType: 'touch', clientX: 5, clientY: 5 });
    expect(link).toHaveAttribute('data-pressed', 'true');
    fireEvent.pointerUp(link, { pointerType: 'touch' });
    expect(link).not.toHaveAttribute('data-pressed');
  });

  it('keeps the decorative liquid out of the accessibility tree', () => {
    renderAt('/');
    const link = desktopNav().getByRole('link', { name: 'Cerita' });
    expect(link).toHaveAccessibleName('Cerita');
    link.querySelectorAll('svg').forEach((svg) => {
      expect(svg.closest('[aria-hidden="true"]')).not.toBeNull();
    });
  });
});
