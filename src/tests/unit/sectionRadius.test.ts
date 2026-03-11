import {
  computeSectionRMax,
  resolveSectionDubins,
  resolveSectionRMin,
} from '../../domain/sectionRadius';

describe('sectionRadius', () => {
  it('returns the auto-selected maximum radius for an S-curve fixture', () => {
    const start = { x: 0, y: 0, pathHeading: 0 };
    const end = { x: 10, y: 10, pathHeading: 90 };

    const rMax = computeSectionRMax(start, end);

    expect(rMax).toBeCloseTo(10, 6);
  });

  it('prioritizes manual section rMin when present', () => {
    const path = {
      waypoints: [
        { x: 0, y: 0, pathHeading: 0 },
        { x: 10, y: 10, pathHeading: 90 },
      ],
      sectionRMin: [3],
    };

    expect(resolveSectionRMin(path, 0)).toBe(3);
  });

  it('returns null for straight sections', () => {
    const path = {
      waypoints: [
        { x: 0, y: 0, pathHeading: 0 },
        { x: 1, y: 0, pathHeading: 0 },
      ],
      sectionRMin: [null],
    };

    expect(resolveSectionRMin(path, 0)).toBeNull();
  });

  it('auto uses only allowed degenerate path shapes', () => {
    const resolved = resolveSectionDubins(
      { x: 0, y: 0, pathHeading: 0 },
      { x: 10, y: 10, pathHeading: 90 },
      null,
    );

    expect(resolved).not.toBeNull();
    expect(resolved?.mode).toBe('auto');
    if (resolved?.connection === 's-curve') {
      expect(['LSR', 'RSL']).toContain(resolved.path.word);
      expect(resolved.path.params[1]).toBeCloseTo(0, 5);
      return;
    }

    expect(resolved?.connection).toBe('curve-line');
    expect(['LSL', 'RSR']).toContain(resolved?.path.word);
    expect(
      Math.min(resolved?.path.params[0] ?? 1, resolved?.path.params[2] ?? 1),
    ).toBeCloseTo(0, 5);
  });

  it('auto never returns disallowed non-degenerate shapes', () => {
    const resolved = resolveSectionDubins(
      { x: 0, y: 0, pathHeading: 0 },
      { x: 10, y: 0, pathHeading: 90 },
      null,
    );

    expect(resolved).not.toBeNull();
    expect(resolved?.mode).toBe('auto');
    if (resolved?.connection === 's-curve') {
      expect(['LSR', 'RSL']).toContain(resolved.path.word);
      expect(resolved.path.params[1]).toBeCloseTo(0, 5);
      return;
    }

    expect(resolved?.connection).toBe('curve-line');
    expect(['LSL', 'RSR']).toContain(resolved?.path.word);
    expect(
      Math.min(resolved?.path.params[0] ?? 1, resolved?.path.params[2] ?? 1),
    ).toBeCloseTo(0, 5);
    expect(resolved?.path.params[1] ?? -1).toBeGreaterThanOrEqual(0);
  });
});
