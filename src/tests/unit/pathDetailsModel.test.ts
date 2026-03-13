import { describe, expect, it } from 'vitest';
import {
  formatSeconds,
  buildSequentialItems,
  getItemLabel,
  getItemSubtitle,
} from '../../features/path-details/pathDetailsModel';
import type { ResolvedPathModel } from '../../domain/pointResolution';
import type { WaypointTiming } from '../../domain/pathTiming';

const makePoint = (id: string, x = 0, y = 0) => ({
  id,
  x,
  y,
  robotHeading: null as number | null,
  isLibrary: false,
  name: id,
});

const makeResolvedWaypoint = (id: string, pointId: string, x = 0, y = 0) => ({
  id,
  pointId,
  libraryPointId: null as string | null,
  pathHeading: 0,
  point: makePoint(pointId, x, y),
  libraryPoint: null,
  name: id,
  x,
  y,
});

const makeResolvedPath = (
  waypoints: ResolvedPathModel['waypoints'],
  headingKeyframes: ResolvedPathModel['headingKeyframes'] = [],
): ResolvedPathModel => ({
  id: 'path1',
  name: 'Test Path',
  color: '#ff0000',
  visible: true,
  waypoints,
  headingKeyframes,
  sectionRMin: [],
});

describe('formatSeconds', () => {
  it('formats zero seconds', () => {
    expect(formatSeconds(0)).toBe('0 s');
  });

  it('formats whole seconds without trailing zeros', () => {
    expect(formatSeconds(3)).toBe('3 s');
  });

  it('formats decimal seconds', () => {
    expect(formatSeconds(1.5)).toBe('1.5 s');
  });

  it('formats to 2 decimal places maximum', () => {
    expect(formatSeconds(1.23)).toBe('1.23 s');
  });

  it('removes trailing zeros after decimal', () => {
    expect(formatSeconds(1.1)).toBe('1.1 s');
  });
});

describe('buildSequentialItems', () => {
  it('returns empty array for path with no waypoints', () => {
    const path = makeResolvedPath([]);
    const result = buildSequentialItems(path, new Map());
    expect(result).toHaveLength(0);
  });

  it('returns waypoint items in order', () => {
    const wps = [
      makeResolvedWaypoint('w1', 'p1'),
      makeResolvedWaypoint('w2', 'p2'),
      makeResolvedWaypoint('w3', 'p3'),
    ];
    const path = makeResolvedPath(wps);
    const result = buildSequentialItems(path, new Map());

    expect(result).toHaveLength(3);
    expect(result[0]?.type).toBe('waypoint');
    expect(result[0]?.id).toBe('w1');
    expect(result[1]?.id).toBe('w2');
    expect(result[2]?.id).toBe('w3');
  });

  it('interleaves heading keyframes after their section waypoint', () => {
    const wps = [
      makeResolvedWaypoint('w1', 'p1', 0, 0),
      makeResolvedWaypoint('w2', 'p2', 5, 0),
      makeResolvedWaypoint('w3', 'p3', 10, 0),
    ];
    const hks = [
      {
        id: 'hk1',
        sectionIndex: 0,
        sectionRatio: 0.5,
        robotHeading: 90,
        name: 'HK 1',
        x: 2.5,
        y: 0,
        pathHeading: 0,
      },
      {
        id: 'hk2',
        sectionIndex: 1,
        sectionRatio: 0.5,
        robotHeading: 180,
        name: 'HK 2',
        x: 7.5,
        y: 0,
        pathHeading: 0,
      },
    ];
    const path = makeResolvedPath(wps, hks);
    const result = buildSequentialItems(path, new Map());

    expect(result).toHaveLength(5);
    expect(result[0]?.id).toBe('w1');
    expect(result[1]?.id).toBe('hk1');
    expect(result[2]?.id).toBe('w2');
    expect(result[3]?.id).toBe('hk2');
    expect(result[4]?.id).toBe('w3');
  });

  it('sorts heading keyframes within a section by sectionRatio', () => {
    const wps = [
      makeResolvedWaypoint('w1', 'p1', 0, 0),
      makeResolvedWaypoint('w2', 'p2', 5, 0),
    ];
    const hks = [
      {
        id: 'hk_late',
        sectionIndex: 0,
        sectionRatio: 0.8,
        robotHeading: 90,
        name: 'HK Late',
        x: 4,
        y: 0,
        pathHeading: 0,
      },
      {
        id: 'hk_early',
        sectionIndex: 0,
        sectionRatio: 0.2,
        robotHeading: 45,
        name: 'HK Early',
        x: 1,
        y: 0,
        pathHeading: 0,
      },
    ];
    const path = makeResolvedPath(wps, hks);
    const result = buildSequentialItems(path, new Map());

    expect(result[1]?.id).toBe('hk_early');
    expect(result[2]?.id).toBe('hk_late');
  });

  it('attaches timing data to waypoint items', () => {
    const wps = [makeResolvedWaypoint('w1', 'p1')];
    const path = makeResolvedPath(wps);
    const timing: WaypointTiming = {
      waypointId: 'w1',
      name: 'w1',
      index: 0,
      cumulativeDistance: 0,
      time: 1.5,
      velocity: 2,
    };
    const timingsById = new Map([['w1', timing]]);
    const result = buildSequentialItems(path, timingsById);

    expect(result[0]?.type).toBe('waypoint');
    if (result[0]?.type === 'waypoint') {
      expect(result[0].timing?.time).toBe(1.5);
    }
  });
});

describe('getItemLabel', () => {
  it('returns data.name when present for a waypoint', () => {
    const item = {
      type: 'waypoint' as const,
      id: 'w1',
      index: 0,
      data: { ...makeResolvedWaypoint('w1', 'p1'), name: 'My WP' },
      timing: null,
    };
    expect(getItemLabel(item)).toBe('My WP');
  });

  it('returns fallback label when name is empty for a waypoint', () => {
    const item = {
      type: 'waypoint' as const,
      id: 'w1',
      index: 2,
      data: { ...makeResolvedWaypoint('w1', 'p1'), name: '' },
      timing: null,
    };
    expect(getItemLabel(item)).toBe('Waypoint 3');
  });
});

describe('getItemSubtitle', () => {
  it('returns WP subtitle for waypoint items', () => {
    const item = {
      type: 'waypoint' as const,
      id: 'w1',
      index: 0,
      data: makeResolvedWaypoint('w1', 'p1'),
      timing: null,
    };
    expect(getItemSubtitle(item)).toBe('WP 1');
  });

  it('returns HK subtitle for headingKeyframe items', () => {
    const item = {
      type: 'headingKeyframe' as const,
      id: 'hk1',
      index: 0,
      data: {
        id: 'hk1',
        sectionIndex: 1,
        sectionRatio: 0.5,
        robotHeading: 90,
        name: 'HK1',
        x: 0,
        y: 0,
        pathHeading: 0,
      },
    };
    expect(getItemSubtitle(item)).toBe('HK 1 (Sect 2)');
  });
});
