import {
  computeShortestDubinsPath,
  computeDubinsArcCentersForPath,
  sampleResolvedDubinsPath,
} from '../../domain/dubins';
import {
  computeAutoSectionDubinsPath,
  computeManualSectionDubinsPath,
} from '../../domain/sectionDubins';
import { resolveSectionRMin } from '../../domain/sectionRadius';

const classifyConnectionPattern = (
  path: NonNullable<ReturnType<typeof computeShortestDubinsPath>>,
  turningRadius: number,
): 'curve-line' | 'curve-only' | 'curve-curve' => {
  const segmentLengths = path.params.map(
    (normalized) => normalized * turningRadius,
  );
  const straightLength = segmentLengths.reduce((sum, length, index) => {
    return path.segmentTypes[index] === 'S' && length > 1e-6
      ? sum + length
      : sum;
  }, 0);
  const curveCount = segmentLengths.reduce((count, length, index) => {
    return path.segmentTypes[index] !== 'S' && length > 1e-6
      ? count + 1
      : count;
  }, 0);

  if (straightLength > 1e-6) {
    return 'curve-line';
  }

  return curveCount <= 1 ? 'curve-only' : 'curve-curve';
};

describe('dubins', () => {
  it('selects a finite shortest candidate', () => {
    const shortest = computeShortestDubinsPath(
      { x: 0, y: 0, headingDeg: 0 },
      { x: 1, y: 0, headingDeg: 0 },
      0.2,
    );

    expect(shortest).not.toBeNull();
    expect(shortest?.normalizedLength).toBeGreaterThan(0);
    expect(shortest?.segmentTypes).toHaveLength(3);
  });

  it('samples start/end points including heading continuity', () => {
    const path = computeShortestDubinsPath(
      { x: 0, y: 0, headingDeg: 0 },
      { x: 0.8, y: 0.4, headingDeg: 90 },
      0.15,
    );
    const result =
      path === null
        ? null
        : sampleResolvedDubinsPath(
            { x: 0, y: 0, headingDeg: 0 },
            { x: 0.8, y: 0.4, headingDeg: 90 },
            0.15,
            path,
            0.05,
          );

    expect(result).not.toBeNull();

    const first = result?.samples[0];
    const last = result?.samples.at(-1);

    expect(first?.x).toBeCloseTo(0, 4);
    expect(first?.y).toBeCloseTo(0, 4);
    expect(last?.x).toBeCloseTo(0.8, 3);
    expect(last?.y).toBeCloseTo(0.4, 3);
    expect(last?.headingDeg).toBeCloseTo(90, 0);
  });

  it('does not select triple-curve words in default shortest path search', () => {
    const shortest = computeShortestDubinsPath(
      { x: 0, y: 0, headingDeg: 0 },
      { x: 1, y: 0, headingDeg: 180 },
      1,
    );

    expect(shortest).not.toBeNull();
    expect(shortest?.word === 'RLR' || shortest?.word === 'LRL').toBe(false);
  });

  it('classifies generated paths into curve-line / curve-only / curve-curve', () => {
    const curveLine = computeShortestDubinsPath(
      { x: 0, y: 0, headingDeg: 0 },
      { x: 1.2, y: 0.6, headingDeg: 90 },
      0.2,
    );
    const curveOnly = computeShortestDubinsPath(
      { x: 0, y: 0, headingDeg: 0 },
      { x: 0.5, y: 0.5, headingDeg: 90 },
      0.5,
    );
    const curveCurve = computeShortestDubinsPath(
      { x: 0, y: 0, headingDeg: 0 },
      { x: 0.4, y: 0, headingDeg: 180 },
      0.2,
    );

    expect(curveLine).not.toBeNull();
    expect(curveOnly).not.toBeNull();
    expect(curveCurve).not.toBeNull();

    if (curveLine === null || curveOnly === null || curveCurve === null) {
      throw new Error('expected all pattern fixtures to resolve to a path');
    }

    expect(classifyConnectionPattern(curveLine, 0.2)).toBe('curve-line');
    expect(classifyConnectionPattern(curveOnly, 0.5)).toBe('curve-only');
    expect(classifyConnectionPattern(curveCurve, 0.2)).toBe('curve-curve');
  });

  it('does not report arc centers for straight sections', () => {
    const path = computeShortestDubinsPath(
      { x: 0, y: 0, headingDeg: 0 },
      { x: 1, y: 0, headingDeg: 0 },
      0.5,
    );
    const centers =
      path === null
        ? {}
        : computeDubinsArcCentersForPath(
            { x: 0, y: 0, headingDeg: 0 },
            path,
            0.5,
          );

    expect(centers.startCenter).toBeUndefined();
    expect(centers.endCenter).toBeUndefined();
  });

  it('keeps the current auto radius selection stable at a geometric boundary fixture', () => {
    const path = {
      waypoints: [
        { x: 0, y: 0, pathHeading: 0 },
        { x: 10, y: 10, pathHeading: 90 },
      ],
      sectionRMin: [null],
    };
    const radius = resolveSectionRMin(path, 0);

    if (radius === null) {
      throw new Error('expected finite auto radius');
    }

    const pathA = computeAutoSectionDubinsPath(
      { x: 0, y: 0, headingDeg: 0 },
      { x: 10, y: 10, headingDeg: 90 },
    );
    const pathB = computeAutoSectionDubinsPath(
      { x: 0, y: 0, headingDeg: 0 },
      { x: 10, y: 10, headingDeg: 90 },
    );

    expect(pathA).not.toBeNull();
    expect(pathB).not.toBeNull();
    expect(pathA?.path.word).toBe(pathB?.path.word);
    expect(pathA?.path.params).toEqual(pathB?.path.params);
    expect(pathA?.turningRadius).toBeCloseTo(radius, 6);
  });

  it('selects only allowed auto connection shapes', () => {
    const start = { x: 0, y: 0, headingDeg: 0 };
    const end = { x: 10, y: 10, headingDeg: 90 };
    const auto = computeAutoSectionDubinsPath(start, end);

    expect(auto).not.toBeNull();
    if (auto?.connection === 's-curve') {
      expect(['LSR', 'RSL']).toContain(auto.path.word);
      expect(auto.path.params[1]).toBeCloseTo(0, 5);
    } else {
      expect(auto?.connection).toBe('curve-line');
      expect(['LSL', 'RSR']).toContain(auto?.path.word);
      expect(
        Math.min(auto?.path.params[0] ?? 1, auto?.path.params[2] ?? 1),
      ).toBeCloseTo(0, 5);
    }
    expect(auto?.turningRadius).toBe(
      resolveSectionRMin(
        {
          waypoints: [
            { x: start.x, y: start.y, pathHeading: start.headingDeg },
            { x: end.x, y: end.y, pathHeading: end.headingDeg },
          ],
          sectionRMin: [null],
        },
        0,
      ),
    );
  });

  it('prefers the auto candidate with the smaller total arc before radius', () => {
    const auto = computeAutoSectionDubinsPath(
      { x: 0, y: 0, headingDeg: 0 },
      { x: 10, y: 10, headingDeg: 90 },
    );

    expect(auto).not.toBeNull();
    if (auto?.connection === 's-curve') {
      expect(auto.path.params[0] + auto.path.params[2]).toBeLessThanOrEqual(
        Math.PI + 1e-4,
      );
    } else {
      expect(
        Math.max(auto?.path.params[0] ?? 0, auto?.path.params[2] ?? 0),
      ).toBeLessThanOrEqual(Math.PI + 1e-4);
    }
  });

  it('uses all words for manual shortest-path resolution', () => {
    const manual = computeManualSectionDubinsPath(
      { x: 0, y: 0, headingDeg: 0 },
      { x: 1, y: 0, headingDeg: 180 },
      1,
    );

    expect(manual).not.toBeNull();
    expect(manual?.mode).toBe('manual');
    expect(manual?.path.word === 'RLR' || manual?.path.word === 'LRL').toBe(
      true,
    );
  });

  it('keeps auto word/connection stable over a 0.1-degree heading sweep where auto resolves', () => {
    const transitions: string[] = [];
    let previous: string | null = null;
    const results: { heading: number; signature: string }[] = [];
    let activeRunLength = 0;
    let longestRun = 0;

    for (let heading = 10; heading <= 170; heading += 0.1) {
      const auto = computeAutoSectionDubinsPath(
        { x: 0, y: 0, headingDeg: 0 },
        { x: 10, y: 10, headingDeg: heading },
      );
      const result =
        auto === null
          ? null
          : {
              connection: auto.connection,
              word: auto.path.word,
              radius: auto.turningRadius,
            };

      if (result === null) {
        activeRunLength = 0;
        continue;
      }
      const signature = `${result.connection}:${result.word}`;
      results.push({ heading, signature });
      activeRunLength += 1;
      longestRun = Math.max(longestRun, activeRunLength);
      if (signature !== previous) {
        transitions.push(signature);
        previous = signature;
      }
    }

    expect(transitions.length).toBeLessThanOrEqual(5);
    expect(longestRun).toBeGreaterThan(300);

    for (let index = 1; index < results.length - 1; index += 1) {
      const previousResult = results[index - 1];
      const currentResult = results[index];
      const nextResult = results[index + 1];

      if (
        currentResult !== undefined &&
        previousResult !== undefined &&
        previousResult.signature === nextResult?.signature
      ) {
        expect(currentResult.signature).toBe(previousResult.signature);
      }
    }
  });

  it('does not return null for a 0.1-degree auto heading sweep', () => {
    for (let heading = 0; heading <= 180; heading += 0.1) {
      const result = computeAutoSectionDubinsPath(
        { x: 0, y: 0, headingDeg: 0 },
        { x: 10, y: 10, headingDeg: heading },
      );

      expect(result).not.toBeNull();
    }
  });

  it('does not return null for same-heading lateral-offset auto sections', () => {
    const result = computeAutoSectionDubinsPath(
      { x: 0, y: 0, headingDeg: 0 },
      { x: 10, y: 5, headingDeg: 0 },
    );

    expect(result).not.toBeNull();
  });

  it('keeps the reported auto word out of CCC on the boundary fixture from the editor', () => {
    const result = computeAutoSectionDubinsPath(
      { x: 2.45, y: 21.10625, headingDeg: 270 },
      { x: 26.2, y: 4.00625, headingDeg: 0 },
    );

    expect(result).not.toBeNull();
    expect(result?.path.word === 'LRL' || result?.path.word === 'RLR').toBe(
      false,
    );
  });
});
