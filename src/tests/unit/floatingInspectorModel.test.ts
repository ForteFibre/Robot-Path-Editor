import { describe, expect, it } from 'vitest';
import type { PathModel } from '../../domain/models';
import {
  resolveSelectedSection,
  resolveSelectedWaypoint,
  resolveSelection,
  EMPTY_RESOLVED_SELECTION,
} from '../../features/floating/floatingInspectorModel';
import {
  createPointIndex,
  resolvePathModel,
} from '../../domain/pointResolution';

const makePoint = (id: string, x = 0, y = 0) => ({
  id,
  x,
  y,
  robotHeading: null as number | null,
  isLibrary: false,
  name: id,
});

const makeWaypoint = (id: string, pointId: string) => ({
  id,
  pointId,
  libraryPointId: null as string | null,
  pathHeading: 0,
});

const makePath = (
  id: string,
  waypoints: PathModel['waypoints'],
  sectionRMin: (number | null)[] = [],
): PathModel => ({
  id,
  name: id,
  color: '#ff0000',
  visible: true,
  waypoints,
  headingKeyframes: [],
  sectionRMin,
});

describe('resolveSelectedSection', () => {
  it('returns null when selectedPath is null', () => {
    expect(resolveSelectedSection(null, 0)).toBeNull();
  });

  it('returns null when sectionIndex is null', () => {
    const points = [makePoint('p1', 0, 0), makePoint('p2', 1, 1)];
    const path = makePath('path1', [
      makeWaypoint('w1', 'p1'),
      makeWaypoint('w2', 'p2'),
    ]);
    const resolvedPath = resolvePathModel(path, createPointIndex(points));
    expect(resolveSelectedSection(resolvedPath, null)).toBeNull();
  });

  it('returns null when section waypoints do not exist', () => {
    const points = [makePoint('p1', 0, 0)];
    const path = makePath('path1', [makeWaypoint('w1', 'p1')]);
    const resolvedPath = resolvePathModel(path, createPointIndex(points));
    expect(resolveSelectedSection(resolvedPath, 0)).toBeNull();
  });

  it('returns section data when valid section index provided', () => {
    const points = [makePoint('p1', 0, 0), makePoint('p2', 3, 4)];
    const path = makePath('path1', [
      makeWaypoint('w1', 'p1'),
      makeWaypoint('w2', 'p2'),
    ]);
    const resolvedPath = resolvePathModel(path, createPointIndex(points));
    const result = resolveSelectedSection(resolvedPath, 0);

    expect(result).not.toBeNull();
    expect(result?.index).toBe(0);
    expect(result?.start.x).toBe(0);
    expect(result?.end.x).toBe(3);
    expect(result?.manualRMin).toBeNull();
  });

  it('returns manual rMin when set', () => {
    const points = [makePoint('p1', 0, 0), makePoint('p2', 3, 4)];
    const path = makePath(
      'path1',
      [makeWaypoint('w1', 'p1'), makeWaypoint('w2', 'p2')],
      [2.5],
    );
    const resolvedPath = resolvePathModel(path, createPointIndex(points));
    const result = resolveSelectedSection(resolvedPath, 0);

    expect(result?.manualRMin).toBe(2.5);
  });
});

describe('resolveSelectedWaypoint', () => {
  it('returns null when selectedPath is null', () => {
    expect(resolveSelectedWaypoint(null, [], null, 'w1')).toBeNull();
  });

  it('returns null when waypointId is null', () => {
    const points = [makePoint('p1', 0, 0)];
    const path = makePath('path1', [makeWaypoint('w1', 'p1')]);
    const resolvedPath = resolvePathModel(path, createPointIndex(points));
    expect(
      resolveSelectedWaypoint(resolvedPath, [path], null, null),
    ).toBeNull();
  });

  it('returns null for non-existent waypointId', () => {
    const points = [makePoint('p1', 0, 0)];
    const path = makePath('path1', [makeWaypoint('w1', 'p1')]);
    const resolvedPath = resolvePathModel(path, createPointIndex(points));
    expect(
      resolveSelectedWaypoint(resolvedPath, [path], null, 'nonexistent'),
    ).toBeNull();
  });

  it('returns waypoint selection with interpolated heading', () => {
    const points = [makePoint('p1', 0, 0)];
    const path = makePath('path1', [makeWaypoint('w1', 'p1')]);
    const rawPaths = [path];
    const resolvedPath = resolvePathModel(path, createPointIndex(points));
    const result = resolveSelectedWaypoint(resolvedPath, rawPaths, null, 'w1');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('w1');
    expect(result?.linkedWaypointCount).toBe(0);
  });
});

describe('resolveSelection', () => {
  it('returns EMPTY_RESOLVED_SELECTION shape when no paths match', () => {
    const result = resolveSelection([], [], [], {
      pathId: null,
      waypointId: null,
      headingKeyframeId: null,
      sectionIndex: null,
    });

    expect(result).toEqual(EMPTY_RESOLVED_SELECTION);
  });

  it('resolves waypoint selection', () => {
    const points = [makePoint('p1', 0, 0)];
    const path = makePath('path1', [makeWaypoint('w1', 'p1')]);
    const resolvedPath = resolvePathModel(path, createPointIndex(points));

    const result = resolveSelection([resolvedPath], [path], points, {
      pathId: 'path1',
      waypointId: 'w1',
      headingKeyframeId: null,
      sectionIndex: null,
    });

    expect(result.selectedPath?.id).toBe('path1');
    expect(result.selectedWaypoint?.id).toBe('w1');
    expect(result.selectedHeadingKeyframe).toBeNull();
    expect(result.selectedSection).toBeNull();
  });

  it('resolves section selection', () => {
    const points = [makePoint('p1', 0, 0), makePoint('p2', 3, 4)];
    const path = makePath('path1', [
      makeWaypoint('w1', 'p1'),
      makeWaypoint('w2', 'p2'),
    ]);
    const resolvedPath = resolvePathModel(path, createPointIndex(points));

    const result = resolveSelection([resolvedPath], [path], points, {
      pathId: 'path1',
      waypointId: null,
      headingKeyframeId: null,
      sectionIndex: 0,
    });

    expect(result.selectedSection?.index).toBe(0);
    expect(result.selectedWaypoint).toBeNull();
  });
});
