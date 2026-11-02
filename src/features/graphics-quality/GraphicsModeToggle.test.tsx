import { fireEvent, render, screen } from '@testing-library/react';
import { GraphicsModeToggle } from './GraphicsModeToggle';
import {
  GRAPHICS_MODE_STORAGE_KEY,
  QUALITY_PROFILES,
  getQualityProfile,
  isSoftwareRenderer,
  resetGraphicsModeForTests,
} from './graphicsQuality';

afterEach(() => {
  window.localStorage.clear();
  resetGraphicsModeForTests();
  document.documentElement.removeAttribute('data-graphics');
});

describe('3D / 2D toggle', () => {
  it('starts in 3D and switches to the light 2D mode, remembered for the next visit', () => {
    render(<GraphicsModeToggle />);
    const toggle = screen.getByRole('switch', { name: 'Mode ringan 2D' });
    expect(toggle).not.toBeChecked();
    expect(toggle.querySelector('[data-face]')).toHaveAttribute('data-face', '3d');

    fireEvent.click(toggle);

    expect(toggle).toBeChecked();
    expect(toggle.querySelector('[data-face]')).toHaveAttribute('data-face', '2d');
    expect(window.localStorage.getItem(GRAPHICS_MODE_STORAGE_KEY)).toBe('low');
    expect(document.documentElement.getAttribute('data-graphics')).toBe('low');
    expect(getQualityProfile()).toBe(QUALITY_PROFILES.low);
  });

  it('the light mode turns the 3D scenes into pictures and flattens the map', () => {
    expect(QUALITY_PROFILES.low).toMatchObject({ scenes3d: false, flatMap: true, maxPixelRatio: 1 });
    expect(QUALITY_PROFILES.high).toMatchObject({ scenes3d: true, flatMap: false });
  });
});

describe('software rendering', () => {
  it('recognises CPU-only WebGL renderers', () => {
    expect(
      isSoftwareRenderer('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)'),
    ).toBe(true);
    expect(isSoftwareRenderer('llvmpipe (LLVM 15.0.7, 256 bits)')).toBe(true);
    expect(isSoftwareRenderer('ANGLE (NVIDIA, NVIDIA GeForce RTX 3050 Laptop GPU Direct3D11)')).toBe(false);
    expect(isSoftwareRenderer('Adreno (TM) 610')).toBe(false);
  });
});
