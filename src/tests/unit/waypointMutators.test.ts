import { createPath, createPoint, createWaypoint } from '../../domain/models';
import { normalizeDomainState, updateWaypoint } from '../../store/domain';
import type { DomainState } from '../../store/types';

const createWaypointDomain = (): {
  domain: DomainState;
  pathId: string;
  waypointIds: string[];
  pointIds: string[];
} => {
  const path = createPath(0);
  path.id = 'path-waypoint-mutators';

  const points = [
    createPoint({
      id: 'point-1',
      x: 0,
      y: 0,
      name: 'WP 1',
      isLibrary: false,
    }),
    createPoint({
      id: 'point-2',
      x: 1,
      y: 0,
      name: 'WP 2',
      isLibrary: false,
    }),
    createPoint({
      id: 'point-3',
      x: 2,
      y: 0,
      name: '',
      isLibrary: false,
    }),
  ];

  const waypoints = points.map((point, index) =>
    createWaypoint({
      id: `waypoint-${index + 1}`,
      pointId: point.id,
      libraryPointId: null,
      pathHeading: 0,
    }),
  );

  path.waypoints = waypoints;

  return {
    domain: normalizeDomainState({
      paths: [path],
      points,
      lockedPointIds: [],
      activePathId: path.id,
    }),
    pathId: path.id,
    waypointIds: waypoints.map((waypoint) => waypoint.id),
    pointIds: points.map((point) => point.id),
  };
};

describe('waypointMutators', () => {
  it('uses the actual waypoint index when restoring a default waypoint name', () => {
    const { domain, pathId, waypointIds, pointIds } = createWaypointDomain();
    const targetWaypointId = waypointIds[2];
    const targetPointId = pointIds[2];

    if (targetWaypointId === undefined || targetPointId === undefined) {
      throw new Error('target waypoint fixture missing');
    }

    const result = updateWaypoint(
      domain,
      pathId,
      targetWaypointId,
      { name: '   ' },
      'path',
    );

    const updatedPoint = result.points.find(
      (point) => point.id === targetPointId,
    );

    expect(updatedPoint?.name).toBe('WP 3');
    expect(updatedPoint?.name).not.toBe('WP 1');
  });
});
