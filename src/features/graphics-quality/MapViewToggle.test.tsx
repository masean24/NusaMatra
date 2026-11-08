import { act, fireEvent, render, screen } from '@testing-library/react';
import { MapViewToggle } from './MapViewToggle';
import {
  FRAME_PROBE,
  MAP_VIEW_STORAGE_KEY,
  QUALITY_PROFILES,
  deviceTierFrom,
  getQualityProfile,
  isSoftwareRenderer,
  reportMapFrame,
  resetGraphicsModeForTests,
} from './graphicsQuality';

afterEach(() => {
  window.localStorage.clear();
  resetGraphicsModeForTests();
});

describe('Jelajahi 3D / 2D map toggle', () => {
  it('starts in 3D on a capable device and flattens the map, remembered for the next visit', () => {
    resetGraphicsModeForTests('high');
    render(<MapViewToggle />);
    const toggle = screen.getByRole('switch', { name: 'Peta 2D' });
    expect(toggle).not.toBeChecked();
    expect(toggle.querySelector('[data-face]')).toHaveAttribute('data-face', '3d');

    fireEvent.click(toggle);

    expect(toggle).toBeChecked();
    expect(toggle.querySelector('[data-face]')).toHaveAttribute('data-face', '2d');
    expect(window.localStorage.getItem(MAP_VIEW_STORAGE_KEY)).toBe('2d');
    // Only the map changes: the device keeps its 3D scenes and pixel ratio.
    expect(getQualityProfile()).toEqual({ ...QUALITY_PROFILES.high, flatMap: true, decorativeMotion: false });
  });

  it('a low-end device starts with a flat map, and may still choose 3D for it', () => {
    resetGraphicsModeForTests('low');
    render(<MapViewToggle />);
    const toggle = screen.getByRole('switch', { name: 'Peta 2D' });
    expect(toggle).toBeChecked();
    expect(getQualityProfile()).toEqual(QUALITY_PROFILES.low);

    fireEvent.click(toggle);

    expect(toggle).not.toBeChecked();
    expect(getQualityProfile()).toMatchObject({ scenes3d: false, flatMap: false, maxPixelRatio: 1 });
  });

  it('says so when the map turned flat by itself, and the notice goes once the visitor chooses', () => {
    resetGraphicsModeForTests('high');
    render(<MapViewToggle />);
    const toggle = screen.getByRole('switch', { name: 'Peta 2D' });
    expect(screen.queryByText(/beralih ke 2D/)).not.toBeInTheDocument();

    act(() => {
      for (let i = 0; i < FRAME_PROBE.samples; i += 1) reportMapFrame(90);
    });

    expect(toggle).toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Peta beralih ke 2D agar lebih lancar. Tekan 3D untuk kembali.',
    );

    fireEvent.click(toggle);

    expect(toggle).not.toBeChecked();
    expect(screen.queryByText(/beralih ke 2D/)).not.toBeInTheDocument();
  });

  it("the visitor's stored choice wins over the device default", () => {
    window.localStorage.setItem(MAP_VIEW_STORAGE_KEY, '3d');
    resetGraphicsModeForTests('low');
    expect(getQualityProfile().flatMap).toBe(false);
  });
});

describe('device tier', () => {
  it('is low for software rendering, 4 GB or less, 2 cores or fewer, or save-data', () => {
    expect(deviceTierFrom({ softwareRendering: true, memoryGb: 8, cpuCores: 8 })).toBe('low');
    expect(deviceTierFrom({ softwareRendering: false, memoryGb: 4, cpuCores: 8 })).toBe('low');
    expect(deviceTierFrom({ softwareRendering: false, memoryGb: 8, cpuCores: 2 })).toBe('low');
    expect(deviceTierFrom({ softwareRendering: false, saveData: true })).toBe('low');
  });

  it('is high when nothing points to a weak device, including browsers that report nothing', () => {
    expect(deviceTierFrom({ softwareRendering: false, memoryGb: 8, cpuCores: 8 })).toBe('high');
    expect(deviceTierFrom({ softwareRendering: false })).toBe('high');
  });

  it('recognises CPU-only WebGL renderers', () => {
    expect(
      isSoftwareRenderer('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)'),
    ).toBe(true);
    expect(isSoftwareRenderer('llvmpipe (LLVM 15.0.7, 256 bits)')).toBe(true);
    expect(isSoftwareRenderer('ANGLE (NVIDIA, NVIDIA GeForce RTX 3050 Laptop GPU Direct3D11)')).toBe(false);
    expect(isSoftwareRenderer('Adreno (TM) 610')).toBe(false);
  });
});
