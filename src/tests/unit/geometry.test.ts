import {
  headingDegFromPoints,
  interpolateAngleDeg,
  normalizeAngleDeg,
  screenToWorld,
  shortestAngleDeltaDeg,
  worldToScreen,
} from '../../domain/geometry';
import {
  getCanvasGridValues,
  getCanvasGridSize,
  getCanvasRenderStep,
  getHeadingHandleDistance,
  getNextCanvasScale,
  zoomCanvasTransformAtPoint,
} from '../../domain/canvas';
import {
  DEFAULT_SNAP_SETTINGS,
  resolveAngleSnap,
  resolvePointSnap,
} from '../../domain/snapping';
import { resolveSnapThresholds } from '../../domain/snapThresholds';

describe('geometry', () => {
  it('normalizes angles into [0, 360)', () => {
    expect(normalizeAngleDeg(-45)).toBe(315);
    expect(normalizeAngleDeg(370)).toBe(10);
  });

  it('computes shortest delta and interpolates across 360 boundary', () => {
    expect(shortestAngleDeltaDeg(350, 10)).toBe(20);
    expect(interpolateAngleDeg(350, 10, 0.5)).toBe(0);
  });

  it('computes heading from two points', () => {
    expect(headingDegFromPoints({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(0);
    expect(headingDegFromPoints({ x: 0, y: 0 }, { x: 0, y: 1 })).toBe(90);
  });

  it('converts between ROS world coordinates and screen coordinates', () => {
    const transform = { x: 200, y: 100, k: 20 };
    const world = { x: -7.5, y: -5 };

    expect(worldToScreen(world, transform)).toEqual({ x: 300, y: 250 });
    expect(screenToWorld({ x: 300, y: 250 }, transform)).toEqual(world);
  });

  it('snaps near candidate x/y values', () => {
    const snapped = resolvePointSnap(
      { x: 10.4, y: 20.2 },
      {
        candidates: [
          { x: 12, y: 99 },
          { x: -3, y: 18 },
        ],
        previousPoint: null,
        previousHeadingDeg: null,
        previousSegmentStart: null,
        settings: DEFAULT_SNAP_SETTINGS,
        threshold: 2,
      },
    );

    expect(snapped.point).toEqual({ x: 12, y: 20.2 });
    expect(snapped.guide.x).toBe(12);
    expect(snapped.guide.y).toBeNull();
    expect(snapped.guide.label).toBe('align x');
  });

  it('snaps points to previous heading line', () => {
    const snapped = resolvePointSnap(
      { x: 12, y: 9 },
      {
        candidates: [],
        previousPoint: { x: 10, y: 10 },
        previousHeadingDeg: 0,
        previousSegmentStart: null,
        settings: DEFAULT_SNAP_SETTINGS,
        threshold: 2,
      },
    );

    expect(snapped.point.x).toBeCloseTo(12);
    expect(snapped.point.y).toBeCloseTo(10);
    expect(snapped.guide.label).toBe('prev heading line');
  });

  it('snaps heading to a cardinal angle', () => {
    const snapped = resolveAngleSnap({
      origin: { x: 0, y: 0 },
      target: { x: 10, y: 0.8 },
      previousHeadingDeg: null,
      previousPoint: null,
      previousSegmentStart: null,
      settings: DEFAULT_SNAP_SETTINGS,
      thresholdDeg: 8,
      force: false,
    });

    expect(snapped.angle).toBe(0);
    expect(snapped.guide.label).toBe('0 deg');
  });

  it('snaps heading to previous waypoint heading before cardinal angles', () => {
    const snapped = resolveAngleSnap({
      origin: { x: 0, y: 0 },
      target: { x: 8, y: 8.5 },
      previousHeadingDeg: 48,
      previousPoint: { x: -5, y: -5 },
      previousSegmentStart: null,
      settings: DEFAULT_SNAP_SETTINGS,
      thresholdDeg: 8,
      force: false,
    });

    expect(snapped.angle).toBe(48);
    expect(snapped.guide.label).toBe('prev waypoint heading');
  });

  it('can force angle snapping outside the normal threshold', () => {
    const snapped = resolveAngleSnap({
      origin: { x: 0, y: 0 },
      target: { x: 10, y: 3 },
      previousHeadingDeg: null,
      previousPoint: null,
      previousSegmentStart: null,
      settings: DEFAULT_SNAP_SETTINGS,
      thresholdDeg: 2,
      force: true,
    });

    expect(snapped.angle).toBe(0);
    expect(snapped.guide.label).toBe('0 deg');
  });

  it('keeps raw angle when snapping is not applied', () => {
    const snapped = resolveAngleSnap({
      origin: { x: 0, y: 0 },
      target: { x: 10, y: 3 },
      previousHeadingDeg: null,
      previousPoint: null,
      previousSegmentStart: null,
      settings: {
        ...DEFAULT_SNAP_SETTINGS,
        cardinalAngles: false,
        previousWaypointHeading: false,
        segmentHeading: false,
      },
      thresholdDeg: 8,
      force: false,
    });

    expect(snapped.angle).toBeCloseTo(16.699, 2);
    expect(snapped.guide.label).toBeNull();
  });

  it('keeps render sampling denser as zoom increases', () => {
    expect(getCanvasRenderStep(1)).toBe(2);
    expect(getCanvasRenderStep(8)).toBe(1);
    expect(getCanvasRenderStep(400)).toBe(0.02);
  });

  it('adjusts grid spacing to keep screen density readable', () => {
    expect(getCanvasGridSize(5)).toBe(20);
    expect(getCanvasGridSize(20)).toBe(5);
    expect(getCanvasGridSize(80)).toBe(1);
    expect(getCanvasGridSize(400)).toBe(0.2);
  });

  it('returns grid values across the visible range', () => {
    expect(getCanvasGridValues(-130, 220, 100)).toEqual([
      -200, -100, 0, 100, 200, 300,
    ]);
    expect(getCanvasGridValues(-12, 12, 5)).toEqual([
      -15, -10, -5, 0, 5, 10, 15,
    ]);
  });

  it('keeps heading handle distance constant in screen space', () => {
    expect(getHeadingHandleDistance(1)).toBe(32);
    expect(getHeadingHandleDistance(2)).toBe(16);
    expect(getHeadingHandleDistance(8)).toBe(4);
  });

  it('zooms around the cursor while allowing high zoom levels', () => {
    const next = zoomCanvasTransformAtPoint(
      { x: 200, y: 100, k: 1 },
      300,
      220,
      -120,
    );

    expect(next.k).toBeCloseTo(getNextCanvasScale(1, -120));
    expect(next.k).toBeGreaterThan(1);
    expect(next.x).toBeLessThan(200);
    expect(next.y).toBeLessThan(100);
  });

  it('tightens point snap distance as zoom increases', () => {
    const lowZoom = resolveSnapThresholds(5);
    const highZoom = resolveSnapThresholds(200);

    expect(highZoom.point).toBeLessThan(lowZoom.point);
    expect(highZoom.angleDeg).toBe(lowZoom.angleDeg);
  });
});
