import { fireEvent, render, screen } from '@testing-library/react';
import { GraphicsQualitySetting } from './GraphicsQualitySetting';
import {
  QUALITY_PROFILES,
  QUALITY_STORAGE_KEY,
  getQualityProfile,
  resetQualityForTests,
  resolveAutoLevel,
} from './graphicsQuality';

afterEach(() => {
  window.localStorage.clear();
  resetQualityForTests();
  document.documentElement.removeAttribute('data-quality');
});

describe('graphics quality', () => {
  it('starts touch-first or few-core devices on BALANCED and others on HIGH', () => {
    expect(resolveAutoLevel({ coarsePointer: true, cores: 8 })).toBe('balanced');
    expect(resolveAutoLevel({ coarsePointer: false, cores: 4 })).toBe('balanced');
    expect(resolveAutoLevel({ coarsePointer: false, cores: 8 })).toBe('high');
    expect(resolveAutoLevel({ coarsePointer: false, cores: undefined })).toBe('high');
  });

  it('LITE draws one pixel per CSS pixel, without decoration or rich glass', () => {
    expect(QUALITY_PROFILES.lite).toEqual({ maxPixelRatio: 1, decorativeMotion: false, richGlass: false });
  });

  it('applies and remembers a manual choice', () => {
    render(<GraphicsQualitySetting />);
    expect(screen.getByRole('radio', { name: /Otomatis/ })).toBeChecked();

    fireEvent.click(screen.getByRole('radio', { name: /Ringan/ }));

    expect(screen.getByRole('radio', { name: /Ringan/ })).toBeChecked();
    expect(window.localStorage.getItem(QUALITY_STORAGE_KEY)).toBe('lite');
    expect(document.documentElement.getAttribute('data-quality')).toBe('lite');
    expect(getQualityProfile()).toBe(QUALITY_PROFILES.lite);
  });

  it('reads a stored choice on the next visit', () => {
    window.localStorage.setItem(QUALITY_STORAGE_KEY, 'balanced');
    expect(getQualityProfile()).toBe(QUALITY_PROFILES.balanced);
  });
});
