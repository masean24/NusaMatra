import {
  FRAME_PROBE,
  MAP_VIEW_STORAGE_KEY,
  getAutoFlat,
  getMapView,
  judgeFrames,
  reportMapFrame,
  resetGraphicsModeForTests,
  setMapView,
} from './graphicsQuality';

const repeat = (value: number, times: number) => Array.from({ length: times }, () => value);
const feed = (deltas: readonly number[]) => {
  for (const delta of deltas) reportMapFrame(delta);
};

afterEach(() => {
  window.localStorage.clear();
  resetGraphicsModeForTests();
});

describe('judgeFrames', () => {
  it('waits for enough drawn frames before judging', () => {
    expect(judgeFrames(repeat(90, FRAME_PROBE.samples - 1))).toBe('pending');
  });

  it('calls a map slow when its median frame takes longer than the limit', () => {
    expect(judgeFrames(repeat(FRAME_PROBE.slowMedianMs + 10, FRAME_PROBE.samples))).toBe('slow');
  });

  it('calls it smooth at or under the limit, even with a few slow frames', () => {
    const mostlySmooth = [...repeat(17, FRAME_PROBE.samples - 5), ...repeat(200, 5)];
    expect(judgeFrames(mostlySmooth)).toBe('ok');
    expect(judgeFrames(repeat(FRAME_PROBE.slowMedianMs, FRAME_PROBE.samples))).toBe('ok');
  });

  it('leaves out pauses between bursts of drawing, which say nothing about drawing speed', () => {
    const withPauses = [...repeat(17, FRAME_PROBE.samples), ...repeat(FRAME_PROBE.maxGapMs + 1, 40)];
    expect(judgeFrames(withPauses)).toBe('ok');
  });
});

describe('falling back to the flat map when the 3D map stutters', () => {
  it('switches a capable device to 2D for this visit only, and says so', () => {
    resetGraphicsModeForTests('high');
    expect(getMapView()).toBe('3d');

    feed(repeat(90, FRAME_PROBE.samples));

    expect(getMapView()).toBe('2d');
    expect(getAutoFlat()).toBe(true);
    // Not stored: the next visit measures again instead of inheriting this one.
    expect(window.localStorage.getItem(MAP_VIEW_STORAGE_KEY)).toBeNull();
  });

  it('keeps 3D when the map draws smoothly, and stops measuring for the visit', () => {
    resetGraphicsModeForTests('high');
    feed(repeat(17, FRAME_PROBE.samples));
    feed(repeat(90, FRAME_PROBE.samples * 2));

    expect(getMapView()).toBe('3d');
    expect(getAutoFlat()).toBe(false);
  });

  it("never overrides the visitor's own choice of 3D", () => {
    window.localStorage.setItem(MAP_VIEW_STORAGE_KEY, '3d');
    resetGraphicsModeForTests('high');
    feed(repeat(90, FRAME_PROBE.samples));

    expect(getMapView()).toBe('3d');
    expect(getAutoFlat()).toBe(false);
  });

  it('a choice made after the switch is the visitor’s and is remembered', () => {
    resetGraphicsModeForTests('high');
    feed(repeat(90, FRAME_PROBE.samples));
    setMapView('3d');

    expect(getMapView()).toBe('3d');
    expect(getAutoFlat()).toBe(false);
    expect(window.localStorage.getItem(MAP_VIEW_STORAGE_KEY)).toBe('3d');
    feed(repeat(90, FRAME_PROBE.samples));
    expect(getMapView()).toBe('3d');
  });

  it('ignores frames while the page is hidden, when the browser slows them on purpose', () => {
    resetGraphicsModeForTests('high');
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    feed(repeat(90, FRAME_PROBE.samples));
    visibility.mockRestore();

    expect(getMapView()).toBe('3d');
  });
});
