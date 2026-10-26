import {
  CELL_DURATION_MS,
  ENTRANCE_TOTAL_MS,
  SETTLED_POSE,
  buildEntranceSchedule,
  evaluateEntrance,
  evaluateReducedEntrance,
} from './hexEntrance';

const xs = Array.from({ length: 200 }, (_, index) => index * 0.3);

describe('buildEntranceSchedule', () => {
  it('is identical for the same seed, so the entrance never changes between visits', () => {
    expect(buildEntranceSchedule(xs)).toEqual(buildEntranceSchedule(xs));
    expect(buildEntranceSchedule(xs, 1)).not.toEqual(buildEntranceSchedule(xs, 2));
  });

  it('finishes within about one second and gives every cell 3–5 shakes and 1–2 blinks', () => {
    const schedule = buildEntranceSchedule(xs);
    expect(Math.max(...schedule.map((cell) => cell.delay)) + CELL_DURATION_MS).toBeLessThanOrEqual(
      ENTRANCE_TOTAL_MS,
    );
    for (const cell of schedule) {
      expect(cell.shakes.length).toBeGreaterThanOrEqual(3);
      expect(cell.shakes.length).toBeLessThanOrEqual(5);
      expect(cell.blinks.length).toBeGreaterThanOrEqual(1);
      expect(cell.blinks.length).toBeLessThanOrEqual(2);
    }
  });

  it('starts the west before the east on average', () => {
    const schedule = buildEntranceSchedule(xs);
    const mean = (cells: typeof schedule) => cells.reduce((sum, cell) => sum + cell.delay, 0) / cells.length;
    expect(mean(schedule.slice(0, 50))).toBeLessThan(mean(schedule.slice(150)));
  });
});

describe('evaluateEntrance', () => {
  const [cell] = buildEntranceSchedule(xs);
  if (!cell) throw new Error('no schedule');

  it('keeps a cell hidden until its delay', () => {
    expect(evaluateEntrance(cell, cell.delay - 1)).toMatchObject({ scale: 0, opacity: 0 });
  });

  it('lands exactly on the grid slot at full size', () => {
    expect(evaluateEntrance(cell, cell.delay + CELL_DURATION_MS)).toEqual(SETTLED_POSE);
    expect(evaluateEntrance(cell, ENTRANCE_TOTAL_MS + 5000)).toEqual(SETTLED_POSE);
  });

  it('shakes and overshoots while settling', () => {
    const poses = Array.from({ length: 24 }, (_, step) =>
      evaluateEntrance(cell, cell.delay + (step / 24) * CELL_DURATION_MS),
    );
    expect(Math.max(...poses.map((pose) => pose.scale))).toBeGreaterThan(1.05);
    expect(poses.some((pose) => Math.abs(pose.offsetX) + Math.abs(pose.offsetZ) > 0.01)).toBe(true);
    expect(poses.some((pose) => pose.opacity < 0.9 && pose.opacity > 0)).toBe(true);
  });
});

describe('evaluateReducedEntrance', () => {
  it('only fades: no offsets, no scale change', () => {
    const halfway = evaluateReducedEntrance(250);
    expect(halfway.offsetX).toBe(0);
    expect(halfway.scale).toBe(1);
    expect(halfway.opacity).toBeGreaterThan(0);
    expect(halfway.opacity).toBeLessThan(1);
    expect(evaluateReducedEntrance(5000)).toEqual(SETTLED_POSE);
  });
});
