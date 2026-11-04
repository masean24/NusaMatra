import type { NusaMatraDataHubRepository } from '@/services/api';
import { setMediaQueryMatches } from '@/test/browserMocks';
import { boundaryResolution, loadBoundaries } from './boundaryCache';

const SMALL_TOUCH = '(pointer: coarse) and (width < 960px)';

let deviceTier: 'high' | 'low' = 'high';
vi.mock('@/features/graphics-quality', () => ({ getDeviceTier: () => deviceTier }));

function fakeRepository(answer: () => Promise<unknown> = () => Promise.resolve({})) {
  const getBoundaries = vi.fn(answer);
  return { repository: { getBoundaries } as unknown as NusaMatraDataHubRepository, getBoundaries };
}

afterEach(() => {
  deviceTier = 'high';
});

describe('boundaryResolution', () => {
  it('keeps the detailed outlines on a capable device with a mouse', () => {
    expect(boundaryResolution()).toBe('low');
  });

  it('lightens them on a small touch screen', () => {
    setMediaQueryMatches(SMALL_TOUCH, true);
    expect(boundaryResolution()).toBe('mobile');
  });

  it('lightens them on a low-end device of any size', () => {
    deviceTier = 'low';
    expect(boundaryResolution()).toBe('mobile');
  });
});

describe('loadBoundaries', () => {
  it('asks LIVE for the detail this device should load', async () => {
    setMediaQueryMatches(SMALL_TOUCH, true);
    const { repository, getBoundaries } = fakeRepository();
    await loadBoundaries(repository, 'LIVE');
    expect(getBoundaries).toHaveBeenCalledWith({
      dataMode: 'LIVE',
      adminLevel: 'REGENCY',
      resolution: 'mobile',
    });
  });

  it('leaves DEMO alone: its placeholder points have no outlines to lighten', async () => {
    deviceTier = 'low';
    const { repository, getBoundaries } = fakeRepository();
    await loadBoundaries(repository, 'DEMO');
    expect(getBoundaries).toHaveBeenCalledWith(expect.objectContaining({ resolution: 'low' }));
  });

  it('does not download again when the screen changes after the first request', async () => {
    const { repository, getBoundaries } = fakeRepository();
    await loadBoundaries(repository, 'LIVE');
    setMediaQueryMatches(SMALL_TOUCH, true);
    await loadBoundaries(repository, 'LIVE');
    expect(getBoundaries).toHaveBeenCalledTimes(1);
  });

  it('asks again after a failure, so "Coba lagi" really retries', async () => {
    let fail = true;
    const { repository, getBoundaries } = fakeRepository(() =>
      fail ? Promise.reject(new Error('offline')) : Promise.resolve({}),
    );
    await expect(loadBoundaries(repository, 'LIVE')).rejects.toThrow('offline');
    fail = false;
    await loadBoundaries(repository, 'LIVE');
    expect(getBoundaries).toHaveBeenCalledTimes(2);
  });
});
