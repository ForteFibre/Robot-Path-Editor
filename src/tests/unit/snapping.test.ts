import { EMPTY_SNAP_GUIDE } from '../../domain/geometry';
import { resolveAngleSnap, resolvePointSnap } from '../../domain/snapping';
import { DEFAULT_SNAP_SETTINGS } from '../../domain/snapSettings';
import type {
  AngleSnapContext,
  PointSnapContext,
} from '../../domain/snapping/types';

const createPointContext = (
  overrides: Partial<PointSnapContext> = {},
): PointSnapContext => ({
  candidates: [],
  previousPoint: null,
  previousHeadingDeg: null,
  previousSegmentStart: null,
  settings: DEFAULT_SNAP_SETTINGS,
  threshold: 2,
  ...overrides,
});

const createAngleContext = (
  overrides: Partial<AngleSnapContext> = {},
): AngleSnapContext => ({
  origin: { x: 0, y: 0 },
  target: { x: 10, y: 0 },
  previousHeadingDeg: null,
  previousPoint: null,
  previousSegmentStart: null,
  settings: DEFAULT_SNAP_SETTINGS,
  thresholdDeg: 8,
  force: false,
  ...overrides,
});

describe('snapping', () => {
  it('uses the combined align x/y label when both axes snap', () => {
    const snapped = resolvePointSnap(
      { x: 10.4, y: 20.2 },
      createPointContext({
        candidates: [
          { x: 12, y: 99 },
          { x: 99, y: 18.4 },
        ],
      }),
    );

    expect(snapped.point).toEqual({ x: 12, y: 18.4 });
    expect(snapped.guide).toMatchObject({
      x: 12,
      y: 18.4,
      label: 'align x/y',
    });
  });

  it('snaps parallel to the previous segment', () => {
    const snapped = resolvePointSnap(
      { x: 12, y: 1 },
      createPointContext({
        previousPoint: { x: 10, y: 0 },
        previousSegmentStart: { x: 0, y: 0 },
        settings: {
          ...DEFAULT_SNAP_SETTINGS,
          alignX: false,
          alignY: false,
          previousHeadingLine: false,
          segmentParallel: true,
          segmentPerpendicular: false,
        },
      }),
    );

    expect(snapped.point.x).toBeCloseTo(12);
    expect(snapped.point.y).toBeCloseTo(0);
    expect(snapped.guide.label).toBe('parallel segment');
  });

  it('snaps perpendicular to the previous segment', () => {
    const snapped = resolvePointSnap(
      { x: 11, y: 3 },
      createPointContext({
        previousPoint: { x: 10, y: 0 },
        previousSegmentStart: { x: 0, y: 0 },
        settings: {
          ...DEFAULT_SNAP_SETTINGS,
          alignX: false,
          alignY: false,
          previousHeadingLine: false,
          segmentParallel: false,
          segmentPerpendicular: true,
        },
        threshold: 2,
      }),
    );

    expect(snapped.point.x).toBeCloseTo(10);
    expect(snapped.point.y).toBeCloseTo(3);
    expect(snapped.guide.label).toBe('perpendicular segment');
  });

  it('returns the source and empty guide when no point candidate applies', () => {
    const source = { x: 5, y: 7 };
    const snapped = resolvePointSnap(
      source,
      createPointContext({
        settings: {
          ...DEFAULT_SNAP_SETTINGS,
          alignX: false,
          alignY: false,
          previousHeadingLine: false,
          segmentParallel: false,
          segmentPerpendicular: false,
        },
      }),
    );

    expect(snapped.point).toEqual(source);
    expect(snapped.guide).toEqual(EMPTY_SNAP_GUIDE);
  });

  it('snaps heading to the previous segment heading', () => {
    const snapped = resolveAngleSnap(
      createAngleContext({
        target: { x: 8, y: 9 },
        previousPoint: { x: 10, y: 10 },
        previousSegmentStart: { x: 0, y: 0 },
        settings: {
          ...DEFAULT_SNAP_SETTINGS,
          previousWaypointHeading: false,
          cardinalAngles: false,
          segmentHeading: true,
        },
        thresholdDeg: 4,
      }),
    );

    expect(snapped.angle).toBe(45);
    expect(snapped.guide.label).toBe('segment heading');
  });

  it('returns the raw angle when no angle candidate applies', () => {
    const snapped = resolveAngleSnap(
      createAngleContext({
        target: { x: 10, y: 3 },
        settings: {
          ...DEFAULT_SNAP_SETTINGS,
          previousWaypointHeading: false,
          cardinalAngles: false,
          segmentHeading: false,
        },
      }),
    );

    expect(snapped.angle).toBeCloseTo(16.699, 2);
    expect(snapped.guide).toEqual(EMPTY_SNAP_GUIDE);
  });
});
