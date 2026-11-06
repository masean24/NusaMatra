import { PROGRESS_HOLD, READY_TIMEOUT_MS, progressAt } from './splashTimeline';

describe('progressAt', () => {
  it('waits for its start, then runs a smoothstep to the end', () => {
    expect(progressAt(0, true).fraction).toBe(0);
    expect(progressAt(800, true).fraction).toBe(0);
    expect(progressAt(1700, true).fraction).toBeCloseTo(0.5);
    expect(progressAt(2600, true)).toEqual({ fraction: 1, statusIndex: 2, finished: true });
  });

  it('changes the status text each third of the time', () => {
    expect(progressAt(1000, true).statusIndex).toBe(0);
    expect(progressAt(1500, true).statusIndex).toBe(1);
    expect(progressAt(2200, true).statusIndex).toBe(2);
  });

  it('holds at 90% while the page is not ready', () => {
    expect(progressAt(2599, false).fraction).toBeLessThanOrEqual(PROGRESS_HOLD);
    expect(progressAt(2900, false)).toEqual({ fraction: PROGRESS_HOLD, statusIndex: 2, finished: false });
  });

  it('never holds past the time limit', () => {
    expect(progressAt(READY_TIMEOUT_MS, false)).toEqual({ fraction: 1, statusIndex: 2, finished: true });
  });
});
