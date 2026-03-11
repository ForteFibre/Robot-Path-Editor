import {
  createLibraryPoint,
  createPath,
  createPoint,
  createWaypoint,
} from '../../domain/models';
import { discretizePathDetailed } from '../../domain/interpolation';
import {
  createPointIndex,
  resolvePathModel,
} from '../../domain/pointResolution';
import { resolveDropInsertionAfterWaypointId } from '../../features/canvas/dropInsertion';
import {
  addLibraryPointFromSelection,
  insertLibraryWaypoint,
  insertLibraryWaypointAtEndOfPath,
  normalizeDomainState,
  unlinkWaypointPoint,
  updateLibraryPoint,
  updateLibraryPointRobotHeading,
} from '../../store/domain';
import type { DomainState } from '../../store/types';

const createEmptyDomain = (): {
  domain: DomainState;
  pathId: string;
  libraryPointId: string;
} => {
  const path = createPath(0);
  path.id = 'path-empty';

  const libraryPoint = createLibraryPoint('Library Point', {
    id: 'lib-empty',
    x: 5,
    y: 6,
  });

  return {
    domain: normalizeDomainState({
      paths: [path],
      points: [libraryPoint],
      lockedPointIds: [],
      activePathId: path.id,
    }),
    pathId: path.id,
    libraryPointId: libraryPoint.id,
  };
};

const createLinearDomain = (): {
  domain: DomainState;
  pathId: string;
  libraryPointId: string;
  waypointIds: string[];
} => {
  const path = createPath(0);
  path.id = 'path-linear';

  const libraryPoint = createLibraryPoint('Library Point', {
    id: 'lib-linear',
    x: 99,
    y: 42,
  });

  const waypointPoints = [0, 10, 20].map((x, index) =>
    createPoint({
      id: `pt-${index + 1}`,
      x,
      y: 0,
      isLibrary: false,
      name: `WP ${index + 1}`,
    }),
  );

  const waypoints = waypointPoints.map((point, index) =>
    createWaypoint({
      id: `wp-${index + 1}`,
      pointId: point.id,
      libraryPointId: null,
      pathHeading: 0,
    }),
  );

  path.waypoints = waypoints;

  return {
    domain: normalizeDomainState({
      paths: [path],
      points: [libraryPoint, ...waypointPoints],
      lockedPointIds: [],
      activePathId: path.id,
    }),
    pathId: path.id,
    libraryPointId: libraryPoint.id,
    waypointIds: waypoints.map((waypoint) => waypoint.id),
  };
};

const getResolvedDropFixture = (domain: DomainState, pathId: string) => {
  const path = domain.paths.find((candidate) => candidate.id === pathId);
  if (path === undefined) {
    throw new Error('path fixture missing');
  }

  return {
    activePath: resolvePathModel(path, createPointIndex(domain.points)),
    detail: discretizePathDetailed(path, domain.points, 0.1),
  };
};

describe('library waypoint insertion ordering', () => {
  it('saves the selected waypoint robot heading when creating a library point', () => {
    const path = createPath(0);
    path.id = 'path-selection';

    const selectedPoint = createPoint({
      id: 'selected-point',
      x: 1,
      y: 2,
      robotHeading: 270,
      isLibrary: false,
      name: 'Selected Waypoint',
    });

    path.waypoints = [
      createWaypoint({
        id: 'selected-waypoint',
        pointId: selectedPoint.id,
        libraryPointId: null,
        pathHeading: 0,
      }),
    ];

    const domain = normalizeDomainState({
      paths: [path],
      points: [selectedPoint],
      lockedPointIds: [],
      activePathId: path.id,
    });

    const result = addLibraryPointFromSelection(domain, {
      pathId: path.id,
      waypointId: 'selected-waypoint',
      headingKeyframeId: null,
      sectionIndex: null,
    });

    const libraryPoint = result.domain.points.find(
      (point) => point.id === result.pointId,
    );
    const linkedWaypoint = result.domain.paths[0]?.waypoints[0];

    expect(libraryPoint?.isLibrary).toBe(true);
    expect(libraryPoint?.robotHeading).toBe(270);
    expect(linkedWaypoint?.libraryPointId).toBe(result.pointId);
  });

  it('inserts into an empty path as the first waypoint when appending from the library panel', () => {
    const { domain, pathId, libraryPointId } = createEmptyDomain();

    const result = insertLibraryWaypointAtEndOfPath(
      domain,
      libraryPointId,
      pathId,
    );

    expect(result.waypointId).not.toBeNull();

    const path = result.domain.paths.find(
      (candidate) => candidate.id === pathId,
    );
    const insertedWaypoint = path?.waypoints[0];
    const insertedPoint = result.domain.points.find(
      (point) => point.id === insertedWaypoint?.pointId,
    );

    expect(path?.waypoints).toHaveLength(1);
    expect(insertedWaypoint?.id).toBe(result.waypointId);
    expect(insertedWaypoint?.libraryPointId).toBe(libraryPointId);
    expect(insertedPoint?.x).toBe(5);
    expect(insertedPoint?.y).toBe(6);
  });

  it('propagates library robot heading updates to linked waypoint points', () => {
    const { domain, pathId, libraryPointId } = createEmptyDomain();
    const withHeading = updateLibraryPointRobotHeading(
      domain,
      libraryPointId,
      45,
    );
    const firstInsert = insertLibraryWaypointAtEndOfPath(
      withHeading,
      libraryPointId,
      pathId,
    );
    const secondInsert = insertLibraryWaypointAtEndOfPath(
      firstInsert.domain,
      libraryPointId,
      pathId,
    );
    const insertedPath = secondInsert.domain.paths[0];

    if (insertedPath === undefined) {
      throw new Error('expected inserted path');
    }

    const insertedPointsBeforeUpdate = insertedPath.waypoints
      .map((waypoint) =>
        secondInsert.domain.points.find(
          (point) => point.id === waypoint.pointId,
        ),
      )
      .filter(
        (point): point is NonNullable<typeof point> => point !== undefined,
      );

    expect(
      insertedPointsBeforeUpdate.every((point) => point.robotHeading === 45),
    ).toBe(true);

    const updatedDomain = updateLibraryPointRobotHeading(
      secondInsert.domain,
      libraryPointId,
      135,
    );
    const updatedLibraryPoint = updatedDomain.points.find(
      (point) => point.id === libraryPointId,
    );
    const updatedPath = updatedDomain.paths[0];

    if (updatedPath === undefined) {
      throw new Error('expected updated path');
    }

    const linkedWaypointPoints = updatedPath.waypoints
      .map((waypoint) =>
        updatedDomain.points.find((point) => point.id === waypoint.pointId),
      )
      .filter(
        (point): point is NonNullable<typeof point> => point !== undefined,
      );

    expect(updatedLibraryPoint?.robotHeading).toBe(135);
    expect(
      linkedWaypointPoints.every((point) => point.robotHeading === 135),
    ).toBe(true);
  });

  it('propagates library name updates to linked waypoint local point names', () => {
    const { domain, pathId, libraryPointId } = createEmptyDomain();
    const firstInsert = insertLibraryWaypointAtEndOfPath(
      domain,
      libraryPointId,
      pathId,
    );
    const secondInsert = insertLibraryWaypointAtEndOfPath(
      firstInsert.domain,
      libraryPointId,
      pathId,
    );

    const updatedDomain = updateLibraryPoint(
      secondInsert.domain,
      libraryPointId,
      {
        name: 'Library Renamed',
      },
    );
    const updatedLibraryPoint = updatedDomain.points.find(
      (point) => point.id === libraryPointId,
    );
    const updatedPath = updatedDomain.paths[0];

    if (updatedPath === undefined) {
      throw new Error('expected updated path');
    }

    const linkedWaypointPoints = updatedPath.waypoints
      .map((waypoint) =>
        updatedDomain.points.find((point) => point.id === waypoint.pointId),
      )
      .filter(
        (point): point is NonNullable<typeof point> => point !== undefined,
      );

    expect(updatedLibraryPoint?.name).toBe('Library Renamed');
    expect(linkedWaypointPoints).toHaveLength(2);
    expect(
      linkedWaypointPoints.every((point) => point.name === 'Library Renamed'),
    ).toBe(true);
  });

  it('keeps the shared name on unlink and ignores later library renames', () => {
    const { domain, pathId, libraryPointId } = createEmptyDomain();
    const inserted = insertLibraryWaypointAtEndOfPath(
      domain,
      libraryPointId,
      pathId,
    );

    if (inserted.waypointId === null) {
      throw new Error('expected inserted waypoint');
    }

    const renamedShared = updateLibraryPoint(inserted.domain, libraryPointId, {
      name: 'Shared Before Unlink',
    });
    const unlinked = unlinkWaypointPoint(
      renamedShared,
      pathId,
      inserted.waypointId,
    );
    const renamedLibraryAgain = updateLibraryPoint(unlinked, libraryPointId, {
      name: 'Library After Unlink',
    });
    const unlinkedPath = renamedLibraryAgain.paths[0];
    const unlinkedWaypoint = unlinkedPath?.waypoints[0];
    const unlinkedPoint = renamedLibraryAgain.points.find(
      (point) => point.id === unlinkedWaypoint?.pointId,
    );
    const updatedLibraryPoint = renamedLibraryAgain.points.find(
      (point) => point.id === libraryPointId,
    );

    expect(unlinkedWaypoint?.libraryPointId).toBeNull();
    expect(unlinkedPoint?.name).toBe('Shared Before Unlink');
    expect(updatedLibraryPoint?.name).toBe('Library After Unlink');
  });

  it('ignores library robot heading updates while the library point is locked', () => {
    const { domain, pathId, libraryPointId } = createEmptyDomain();
    const firstInsert = insertLibraryWaypointAtEndOfPath(
      domain,
      libraryPointId,
      pathId,
    );
    const secondInsert = insertLibraryWaypointAtEndOfPath(
      firstInsert.domain,
      libraryPointId,
      pathId,
    );
    const lockedDomain = normalizeDomainState({
      ...secondInsert.domain,
      lockedPointIds: [libraryPointId],
    });

    const updatedDomain = updateLibraryPointRobotHeading(
      lockedDomain,
      libraryPointId,
      180,
    );
    const updatedLibraryPoint = updatedDomain.points.find(
      (point) => point.id === libraryPointId,
    );
    const updatedPath = updatedDomain.paths[0];

    if (updatedPath === undefined) {
      throw new Error('expected updated path');
    }

    const linkedWaypointPoints = updatedPath.waypoints
      .map((waypoint) =>
        updatedDomain.points.find((point) => point.id === waypoint.pointId),
      )
      .filter(
        (point): point is NonNullable<typeof point> => point !== undefined,
      );

    expect(updatedLibraryPoint?.robotHeading).toBeNull();
    expect(
      linkedWaypointPoints.every((point) => point.robotHeading === null),
    ).toBe(true);
  });

  it('prepends when a canvas drop lands near the head of the first section', () => {
    const { domain, pathId, libraryPointId, waypointIds } =
      createLinearDomain();
    const { activePath, detail } = getResolvedDropFixture(domain, pathId);

    const afterWaypointId = resolveDropInsertionAfterWaypointId({
      activePath,
      detail,
      worldPoint: { x: 0.1, y: 0 },
    });

    expect(afterWaypointId).toBeNull();

    const result = insertLibraryWaypoint(domain, {
      pathId,
      libraryPointId,
      x: -100,
      y: -100,
      linkToLibrary: true,
      coordinateSource: 'library',
      afterWaypointId,
    });

    const path = result.domain.paths.find(
      (candidate) => candidate.id === pathId,
    );

    expect(path?.waypoints.map((waypoint) => waypoint.id)).toEqual([
      result.waypointId,
      ...waypointIds,
    ]);
  });

  it('inserts after the projected section start waypoint for a middle canvas drop', () => {
    const { domain, pathId, libraryPointId, waypointIds } =
      createLinearDomain();
    const { activePath, detail } = getResolvedDropFixture(domain, pathId);

    const afterWaypointId = resolveDropInsertionAfterWaypointId({
      activePath,
      detail,
      worldPoint: { x: 12, y: 0 },
    });

    expect(afterWaypointId).toBe(waypointIds[1]);

    const result = insertLibraryWaypoint(domain, {
      pathId,
      libraryPointId,
      x: -100,
      y: -100,
      linkToLibrary: true,
      coordinateSource: 'library',
      afterWaypointId,
    });

    const path = result.domain.paths.find(
      (candidate) => candidate.id === pathId,
    );

    expect(path?.waypoints.map((waypoint) => waypoint.id)).toEqual([
      waypointIds[0],
      waypointIds[1],
      result.waypointId,
      waypointIds[2],
    ]);
  });

  it('appends when a canvas drop lands near the tail of the last section', () => {
    const { domain, pathId, libraryPointId, waypointIds } =
      createLinearDomain();
    const { activePath, detail } = getResolvedDropFixture(domain, pathId);

    const afterWaypointId = resolveDropInsertionAfterWaypointId({
      activePath,
      detail,
      worldPoint: { x: 19.9, y: 0 },
    });

    expect(afterWaypointId).toBe(waypointIds[2]);

    const result = insertLibraryWaypoint(domain, {
      pathId,
      libraryPointId,
      x: -100,
      y: -100,
      linkToLibrary: true,
      coordinateSource: 'library',
      afterWaypointId,
    });

    const path = result.domain.paths.find(
      (candidate) => candidate.id === pathId,
    );

    expect(path?.waypoints.map((waypoint) => waypoint.id)).toEqual([
      ...waypointIds,
      result.waypointId,
    ]);
  });
});
