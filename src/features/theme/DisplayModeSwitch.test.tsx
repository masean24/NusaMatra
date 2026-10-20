import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setMediaQueryMatches } from '@/test/browserMocks';
import { DISPLAY_MODE_STORAGE_KEY, OPAQUE_SURFACES_QUERY } from './displayModePreference';
import { DisplayModeProvider } from './DisplayModeProvider';
import { DisplayModeSwitch } from './DisplayModeSwitch';

function renderSwitch() {
  return render(
    <DisplayModeProvider>
      <DisplayModeSwitch />
    </DisplayModeProvider>,
  );
}

describe('DisplayModeSwitch', () => {
  it('is an accessible switch named "Mode tampilan kaca"', () => {
    renderSwitch();
    const toggle = screen.getByRole('switch', { name: 'Mode tampilan kaca' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(document.documentElement).toHaveAttribute('data-display-mode', 'normal');
  });

  it('switches to Kaca, applies it to the document and remembers it', async () => {
    renderSwitch();
    await userEvent.click(screen.getByRole('switch', { name: 'Mode tampilan kaca' }));
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement).toHaveAttribute('data-display-mode', 'glass');
    expect(window.localStorage.getItem(DISPLAY_MODE_STORAGE_KEY)).toBe('glass');
  });

  it('restores the saved preference on the next visit', () => {
    window.localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, 'glass');
    renderSwitch();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement).toHaveAttribute('data-display-mode', 'glass');
  });

  it('works from the keyboard', async () => {
    renderSwitch();
    await userEvent.tab();
    expect(screen.getByRole('switch')).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('turns Kaca off and disables the switch when the device asks for opaque surfaces', () => {
    window.localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, 'glass');
    setMediaQueryMatches(OPAQUE_SURFACES_QUERY, true);
    renderSwitch();
    const toggle = screen.getByRole('switch');
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toHaveAccessibleDescription(/kontras tinggi atau transparansi rendah/);
    expect(document.documentElement).toHaveAttribute('data-display-mode', 'normal');
  });
});
