import { useWorkspaceStore } from '../../store/workspaceStore';

const resolveWaypointPoint = (pathId: string, waypointId: string) => {
  const snapshot = useWorkspaceStore.getState();
  const waypoint = snapshot.domain.paths
    .find((path) => path.id === pathId)
    ?.waypoints.find((item) => item.id === waypointId);

  if (waypoint === undefined) {
    return null;
  }

  const point = snapshot.domain.points.find(
    (item) => item.id === waypoint.pointId,
  );
  if (point === undefined) {
    return null;
  }

  return {
    waypoint,
    point,
  };
};

describe('workspace contract', () => {
  it('locks shape fields in heading mode and allows robotHeading update only', () => {
    const store = useWorkspaceStore.getState();
    const pathId = store.domain.activePathId;

    store.insertLibraryWaypoint({
      pathId,
      x: 0.01,
      y: 0.02,
      linkToLibrary: false,
    });
    const waypointId = useWorkspaceStore.getState().ui.selection.waypointId;
    if (waypointId === null) {
      throw new Error('waypoint insertion failed');
    }

    store.insertLibraryWaypoint({
      pathId,
      x: 1.01,
      y: 0.02,
      linkToLibrary: false,
    });

    store.setMode('heading');

    const keyframeId = store.createHeadingKeyframe({
      pathId,
      sectionIndex: 0,
      sectionRatio: 0.5,
      robotHeading: 45,
    });

    if (keyframeId === null) {
      throw new Error('heading keyframe insertion failed');
    }

    store.updateWaypoint(pathId, waypointId, {
      x: 0.999,
      y: 0.888,
      pathHeading: 270,
    });

    const resolved = resolveWaypointPoint(pathId, waypointId);
    const headingKeyframe = useWorkspaceStore
      .getState()
      .domain.paths.find((path) => path.id === pathId)
      ?.headingKeyframes.find((item) => item.id === keyframeId);

    expect(resolved?.point.x).toBe(0.01);
    expect(resolved?.point.y).toBe(0.02);
    expect(resolved?.waypoint.pathHeading).toBe(0);
    expect(headingKeyframe?.robotHeading).toBe(45);
  });

  it('keeps linked waypoint coordinates synced through the shared library point', () => {
    const store = useWorkspaceStore.getState();
    const pathId = store.domain.activePathId;
    const libraryPointId = store.addLibraryPoint({
      name: 'Test Point',
      x: 0,
      y: 0,
    });

    if (libraryPointId === null) {
      throw new Error('library point creation failed');
    }

    store.insertLibraryWaypoint({
      pathId,
      libraryPointId,
      x: 0,
      y: 0,
      linkToLibrary: true,
      coordinateSource: 'library',
    });

    const firstLinkedWaypointId = useWorkspaceStore
      .getState()
      .domain.paths.find((path) => path.id === pathId)
      ?.waypoints.at(-1)?.id;

    store.insertLibraryWaypoint({
      pathId,
      libraryPointId,
      x: 0,
      y: 0,
      linkToLibrary: true,
      coordinateSource: 'library',
    });

    const secondLinkedWaypointId = useWorkspaceStore
      .getState()
      .domain.paths.find((path) => path.id === pathId)
      ?.waypoints.at(-1)?.id;

    if (
      firstLinkedWaypointId === undefined ||
      secondLinkedWaypointId === undefined
    ) {
      throw new Error('linked waypoint missing');
    }

    store.updateWaypoint(pathId, firstLinkedWaypointId, {
      x: 0.777,
      y: 0.888,
    });

    let syncedLibraryPoint = useWorkspaceStore
      .getState()
      .domain.points.find((point) => point.id === libraryPointId);
    let firstResolved = resolveWaypointPoint(pathId, firstLinkedWaypointId);
    let secondResolved = resolveWaypointPoint(pathId, secondLinkedWaypointId);

    expect(syncedLibraryPoint?.x).toBe(0.777);
    expect(syncedLibraryPoint?.y).toBe(0.888);
    expect(firstResolved?.point.x).toBe(0.777);
    expect(firstResolved?.point.y).toBe(0.888);
    expect(secondResolved?.point.x).toBe(0.777);
    expect(secondResolved?.point.y).toBe(0.888);

    store.updateLibraryPoint(libraryPointId, { x: 0.222, y: 0.333 });

    syncedLibraryPoint = useWorkspaceStore
      .getState()
      .domain.points.find((point) => point.id === libraryPointId);
    firstResolved = resolveWaypointPoint(pathId, firstLinkedWaypointId);
    secondResolved = resolveWaypointPoint(pathId, secondLinkedWaypointId);

    expect(syncedLibraryPoint?.x).toBe(0.222);
    expect(syncedLibraryPoint?.y).toBe(0.333);
    expect(firstResolved?.point.x).toBe(0.222);
    expect(firstResolved?.point.y).toBe(0.333);
    expect(secondResolved?.point.x).toBe(0.222);
    expect(secondResolved?.point.y).toBe(0.333);
  });

  it('propagates linked waypoint name edits through the shared library point', () => {
    const store = useWorkspaceStore.getState();
    const pathId = store.domain.activePathId;
    const libraryPointId = store.addLibraryPoint({
      name: 'Shared Name',
      x: 0,
      y: 0,
    });

    if (libraryPointId === null) {
      throw new Error('library point creation failed');
    }

    store.insertLibraryWaypoint({
      pathId,
      libraryPointId,
      x: 0,
      y: 0,
      linkToLibrary: true,
      coordinateSource: 'library',
    });

    const firstLinkedWaypointId = useWorkspaceStore
      .getState()
      .domain.paths.find((path) => path.id === pathId)
      ?.waypoints.at(-1)?.id;

    store.insertLibraryWaypoint({
      pathId,
      libraryPointId,
      x: 0,
      y: 0,
      linkToLibrary: true,
      coordinateSource: 'library',
    });

    const secondLinkedWaypointId = useWorkspaceStore
      .getState()
      .domain.paths.find((path) => path.id === pathId)
      ?.waypoints.at(-1)?.id;

    if (
      firstLinkedWaypointId === undefined ||
      secondLinkedWaypointId === undefined
    ) {
      throw new Error('linked waypoint missing');
    }

    store.updateWaypoint(pathId, firstLinkedWaypointId, {
      name: 'Renamed Shared Point',
    });

    const snapshot = useWorkspaceStore.getState();
    const updatedLibraryPoint = snapshot.domain.points.find(
      (point) => point.id === libraryPointId,
    );
    const firstResolved = resolveWaypointPoint(pathId, firstLinkedWaypointId);
    const secondResolved = resolveWaypointPoint(pathId, secondLinkedWaypointId);

    expect(updatedLibraryPoint?.name).toBe('Renamed Shared Point');
    expect(firstResolved?.point.name).toBe('Renamed Shared Point');
    expect(secondResolved?.point.name).toBe('Renamed Shared Point');
  });

  it('propagates library point name edits to all linked waypoint local points', () => {
    const store = useWorkspaceStore.getState();
    const pathId = store.domain.activePathId;
    const libraryPointId = store.addLibraryPoint({
      name: 'Shared Name',
      x: 0,
      y: 0,
    });

    if (libraryPointId === null) {
      throw new Error('library point creation failed');
    }

    store.insertLibraryWaypoint({
      pathId,
      libraryPointId,
      x: 0,
      y: 0,
      linkToLibrary: true,
      coordinateSource: 'library',
    });

    const firstLinkedWaypointId = useWorkspaceStore
      .getState()
      .domain.paths.find((path) => path.id === pathId)
      ?.waypoints.at(-1)?.id;

    store.insertLibraryWaypoint({
      pathId,
      libraryPointId,
      x: 0,
      y: 0,
      linkToLibrary: true,
      coordinateSource: 'library',
    });

    const secondLinkedWaypointId = useWorkspaceStore
      .getState()
      .domain.paths.find((path) => path.id === pathId)
      ?.waypoints.at(-1)?.id;

    if (
      firstLinkedWaypointId === undefined ||
      secondLinkedWaypointId === undefined
    ) {
      throw new Error('linked waypoint missing');
    }

    store.updateLibraryPoint(libraryPointId, {
      name: 'Library Renamed',
    });

    const snapshot = useWorkspaceStore.getState();
    const updatedLibraryPoint = snapshot.domain.points.find(
      (point) => point.id === libraryPointId,
    );
    const firstResolved = resolveWaypointPoint(pathId, firstLinkedWaypointId);
    const secondResolved = resolveWaypointPoint(pathId, secondLinkedWaypointId);

    expect(updatedLibraryPoint?.name).toBe('Library Renamed');
    expect(firstResolved?.point.name).toBe('Library Renamed');
    expect(secondResolved?.point.name).toBe('Library Renamed');
  });

  it('propagates linked waypoint robot heading edits through the shared library point', () => {
    const store = useWorkspaceStore.getState();
    const pathId = store.domain.activePathId;
    const libraryPointId = store.addLibraryPoint({
      name: 'Test Point',
      x: 0,
      y: 0,
    });

    if (libraryPointId === null) {
      throw new Error('library point creation failed');
    }

    store.insertLibraryWaypoint({
      pathId,
      libraryPointId,
      x: 0,
      y: 0,
      linkToLibrary: true,
      coordinateSource: 'library',
    });
    const firstWaypointId =
      useWorkspaceStore.getState().ui.selection.waypointId;

    store.insertLibraryWaypoint({
      pathId,
      libraryPointId,
      x: 0,
      y: 0,
      linkToLibrary: true,
      coordinateSource: 'library',
    });
    const secondWaypointId =
      useWorkspaceStore.getState().ui.selection.waypointId;

    if (firstWaypointId === null || secondWaypointId === null) {
      throw new Error('linked waypoint insertion failed');
    }

    store.setMode('heading');
    store.updateWaypoint(pathId, firstWaypointId, { robotHeading: 135 });

    const snapshot = useWorkspaceStore.getState();
    const updatedLibraryPoint = snapshot.domain.points.find(
      (point) => point.id === libraryPointId,
    );
    const firstResolved = resolveWaypointPoint(pathId, firstWaypointId);
    const secondResolved = resolveWaypointPoint(pathId, secondWaypointId);

    expect(updatedLibraryPoint?.robotHeading).toBe(135);
    expect(firstResolved?.point.robotHeading).toBe(135);
    expect(secondResolved?.point.robotHeading).toBe(135);
  });

  it('prevents linked waypoint robot heading updates when the library point is locked', () => {
    const store = useWorkspaceStore.getState();
    const pathId = store.domain.activePathId;
    const libraryPointId = store.addLibraryPoint({
      name: 'Test Point',
      x: 0,
      y: 0,
    });

    if (libraryPointId === null) {
      throw new Error('library point creation failed');
    }

    store.insertLibraryWaypoint({
      pathId,
      libraryPointId,
      x: 0,
      y: 0,
      linkToLibrary: true,
      coordinateSource: 'library',
    });
    const linkedWaypointId =
      useWorkspaceStore.getState().ui.selection.waypointId;

    if (linkedWaypointId === null) {
      throw new Error('linked waypoint insertion failed');
    }

    store.toggleLibraryPointLock(libraryPointId);
    store.setMode('heading');
    store.updateWaypoint(pathId, linkedWaypointId, { robotHeading: 135 });

    const snapshot = useWorkspaceStore.getState();
    const updatedLibraryPoint = snapshot.domain.points.find(
      (point) => point.id === libraryPointId,
    );
    const resolved = resolveWaypointPoint(pathId, linkedWaypointId);

    expect(updatedLibraryPoint?.robotHeading).toBeNull();
    expect(resolved?.point.robotHeading).toBeNull();
  });

  it('prevents coordinate updates when linked library point is lockされた', () => {
    const store = useWorkspaceStore.getState();
    const pathId = store.domain.activePathId;
    const libraryPointId = store.addLibraryPoint({
      name: 'Test Point',
      x: 0,
      y: 0,
    });

    if (libraryPointId === null) {
      throw new Error('library point creation failed');
    }

    store.insertLibraryWaypoint({
      pathId,
      libraryPointId,
      x: 0,
      y: 0,
      linkToLibrary: true,
      coordinateSource: 'library',
    });

    const linkedWaypointId =
      useWorkspaceStore.getState().ui.selection.waypointId;
    if (linkedWaypointId === null) {
      throw new Error('linked waypoint missing');
    }

    store.toggleLibraryPointLock(libraryPointId);
    store.updateWaypoint(pathId, linkedWaypointId, { x: 0.999, y: 0.999 });

    const resolved = resolveWaypointPoint(pathId, linkedWaypointId);
    if (resolved === null) {
      throw new Error('resolved waypoint missing');
    }

    expect(resolved.point.x).not.toBe(0.999);
    expect(resolved.point.y).not.toBe(0.999);
  });

  it('updates active path and clears selected waypoint when selected path is deleted', () => {
    const store = useWorkspaceStore.getState();

    store.addPath();

    const addedPathId = useWorkspaceStore.getState().domain.paths.at(-1)?.id;
    if (addedPathId === undefined) {
      throw new Error('added path missing');
    }

    store.setActivePath(addedPathId);
    store.setSelection({
      pathId: addedPathId,
      waypointId: 'some-waypoint',
      headingKeyframeId: null,
      sectionIndex: 0,
    });

    store.deletePath(addedPathId);

    const snapshot = useWorkspaceStore.getState();
    expect(snapshot.domain.activePathId).not.toBe(addedPathId);
    expect(snapshot.ui.selection.pathId).toBe(snapshot.domain.activePathId);
    expect(snapshot.ui.selection.waypointId).toBeNull();
    expect(snapshot.ui.selection.sectionIndex).toBeNull();
  });
});
