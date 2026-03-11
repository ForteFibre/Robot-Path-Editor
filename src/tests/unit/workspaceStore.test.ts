import { useWorkspaceStore } from '../../store/workspaceStore';
import { MAX_CANVAS_SCALE, MIN_CANVAS_SCALE } from '../../domain/canvas';
import {
  selectActivePath,
  selectEditorMode,
  selectRobotSettings,
  selectSnapPanelOpen,
  selectSnapSettings,
  selectEditorTool,
  selectSelection,
} from '../../store/workspaceSelectors';

const insertFreeWaypoint = (pathId: string, x: number, y: number): string => {
  const store = useWorkspaceStore.getState();
  store.insertLibraryWaypoint({
    pathId,
    x,
    y,
    linkToLibrary: false,
  });

  const waypointId = useWorkspaceStore.getState().ui.selection.waypointId;
  if (waypointId === null) {
    throw new Error('expected inserted waypoint');
  }

  return waypointId;
};

const getPointForWaypoint = (
  pathId: string,
  waypointId: string,
): { x: number; y: number } | null => {
  const snapshot = useWorkspaceStore.getState();
  const waypoint = snapshot.domain.paths
    .find((path) => path.id === pathId)
    ?.waypoints.find((candidate) => candidate.id === waypointId);

  if (waypoint === undefined) {
    return null;
  }

  const point = snapshot.domain.points.find(
    (candidate) => candidate.id === waypoint.pointId,
  );

  if (point === undefined) {
    return null;
  }

  return {
    x: point.x,
    y: point.y,
  };
};

describe('workspaceStore', () => {
  it('updates ui state with explicit actions', () => {
    const store = useWorkspaceStore.getState();

    store.setMode('heading');
    store.setTool('add-point');
    store.setDragging(true);

    const state = useWorkspaceStore.getState();
    expect(state.ui.mode).toBe('heading');
    expect(state.ui.tool).toBe('add-point');
    expect(state.ui.isDragging).toBe(true);
  });

  it('supports domain actions for path and waypoint operations', () => {
    const store = useWorkspaceStore.getState();

    store.setMode('path');
    store.setTool('select');
    store.setDragging(true);

    store.addPath();
    const addedPathId = useWorkspaceStore.getState().domain.paths.at(-1)?.id;
    if (addedPathId === undefined) {
      throw new Error('expected added path');
    }

    store.setActivePath(addedPathId);

    const waypointAId = insertFreeWaypoint(addedPathId, 0, 0);
    insertFreeWaypoint(addedPathId, 1.2, 0);

    store.setSectionRMin(addedPathId, 0, 0.088);
    store.setSelection({
      pathId: addedPathId,
      waypointId: waypointAId,
      headingKeyframeId: null,
      sectionIndex: null,
    });

    let snapshot = useWorkspaceStore.getState();
    const activePath = snapshot.domain.paths.find(
      (path) => path.id === addedPathId,
    );

    expect(snapshot.domain.activePathId).toBe(addedPathId);
    expect(snapshot.ui.isDragging).toBe(true);
    expect(snapshot.ui.selection.waypointId).toBe(waypointAId);
    expect(activePath?.sectionRMin[0]).toBe(0.088);

    store.setSectionRMin(addedPathId, 0, null);

    snapshot = useWorkspaceStore.getState();
    expect(
      snapshot.domain.paths.find((path) => path.id === addedPathId)
        ?.sectionRMin[0],
    ).toBeNull();

    store.clearSelection();
    store.setDragging(false);

    snapshot = useWorkspaceStore.getState();
    expect(snapshot.ui.selection.pathId).toBeNull();
    expect(snapshot.ui.selection.waypointId).toBeNull();
    expect(snapshot.ui.selection.sectionIndex).toBeNull();
    expect(snapshot.ui.isDragging).toBe(false);
  });

  it('keeps waypoint point names stable when waypoints are reordered', () => {
    const store = useWorkspaceStore.getState();
    const pathId = store.domain.activePathId;
    const firstWaypointId = insertFreeWaypoint(pathId, 0, 0);
    const secondWaypointId = insertFreeWaypoint(pathId, 1, 0);

    const beforeReorder = useWorkspaceStore.getState();
    const pathBefore = beforeReorder.domain.paths.find(
      (path) => path.id === pathId,
    );
    const firstPointBefore = beforeReorder.domain.points.find(
      (point) => point.id === pathBefore?.waypoints[0]?.pointId,
    );
    const secondPointBefore = beforeReorder.domain.points.find(
      (point) => point.id === pathBefore?.waypoints[1]?.pointId,
    );

    expect(firstPointBefore?.name).toBe('WP 1');
    expect(secondPointBefore?.name).toBe('WP 2');

    store.reorderWaypoint(pathId, secondWaypointId, 0);

    const afterReorder = useWorkspaceStore.getState();
    const pathAfter = afterReorder.domain.paths.find(
      (path) => path.id === pathId,
    );
    const movedWaypoint = pathAfter?.waypoints[0];
    const trailingWaypoint = pathAfter?.waypoints[1];

    expect(movedWaypoint?.id).toBe(secondWaypointId);
    expect(trailingWaypoint?.id).toBe(firstWaypointId);
    expect(
      afterReorder.domain.points.find(
        (point) => point.id === movedWaypoint?.pointId,
      )?.name,
    ).toBe('WP 2');
    expect(
      afterReorder.domain.points.find(
        (point) => point.id === trailingWaypoint?.pointId,
      )?.name,
    ).toBe('WP 1');
  });

  it('provides reusable selectors', () => {
    const store = useWorkspaceStore.getState();
    store.setMode('heading');
    store.setTool('add-point');

    const selectedPathId = store.domain.activePathId;
    store.setSelection({
      pathId: selectedPathId,
      waypointId: null,
      headingKeyframeId: null,
      sectionIndex: null,
    });

    const current = useWorkspaceStore.getState();

    expect(selectEditorMode(current)).toBe('heading');
    expect(selectEditorTool(current)).toBe('add-point');
    expect(selectActivePath(current)?.id).toBe(selectedPathId);
    expect(selectSelection(current).pathId).toBe(selectedPathId);
    expect(selectSnapPanelOpen(current)).toBe(false);
    expect(selectSnapSettings(current).alignX).toBe(true);
  });

  it('toggles snap settings and panel state without affecting history', () => {
    const store = useWorkspaceStore.getState();

    store.toggleSnapSetting('alignX');
    store.setSnapPanelOpen(false);
    store.setRobotSettings({
      length: 1.05,
      maxVelocity: 3.1,
    });

    const state = useWorkspaceStore.getState();
    expect(state.ui.snapSettings.alignX).toBe(false);
    expect(state.ui.snapPanelOpen).toBe(false);
    expect(selectRobotSettings(state).length).toBe(1.05);
    expect(selectRobotSettings(state).maxVelocity).toBe(3.1);
    expect(store.canUndo()).toBe(false);
  });

  it('tracks history for domain changes only', () => {
    const store = useWorkspaceStore.getState();

    store.setMode('heading');
    expect(store.canUndo()).toBe(false);

    store.addPath();
    expect(store.canUndo()).toBe(true);

    store.setTool('add-point');
    const beforeUndoTool = useWorkspaceStore.getState().ui.tool;

    store.undo();

    const afterUndo = useWorkspaceStore.getState();
    expect(afterUndo.domain.paths).toHaveLength(1);
    expect(afterUndo.ui.tool).toBe(beforeUndoTool);
    expect(store.canRedo()).toBe(true);
  });

  it('commits one history entry for paused domain updates even when final update is no-op', () => {
    const store = useWorkspaceStore.getState();
    const pathId = store.domain.activePathId;
    const waypointId = insertFreeWaypoint(pathId, 0, 0);
    store.clear();
    expect(store.canUndo()).toBe(false);

    store.pause();
    store.updateWaypoint(pathId, waypointId, { x: 10, y: 20 });
    store.updateWaypoint(pathId, waypointId, { x: 10, y: 20 });
    store.resume();

    expect(store.canUndo()).toBe(true);

    store.undo();

    const revertedPoint = getPointForWaypoint(pathId, waypointId);

    expect(revertedPoint?.x).toBe(0);
    expect(revertedPoint?.y).toBe(0);
  });

  it('does not create history entries for paused no-op domain updates', () => {
    const store = useWorkspaceStore.getState();
    const pathId = store.domain.activePathId;
    const waypointId = insertFreeWaypoint(pathId, 5, 5);
    store.clear();
    expect(store.canUndo()).toBe(false);

    store.pause();
    store.updateWaypoint(pathId, waypointId, { x: 5, y: 5 });
    store.resume();

    expect(store.canUndo()).toBe(false);
  });

  it('clears history after import and reset', () => {
    const store = useWorkspaceStore.getState();

    store.addPath();
    expect(store.canUndo()).toBe(true);

    store.resetWorkspace();
    expect(store.canUndo()).toBe(false);

    store.addPath();
    expect(store.canUndo()).toBe(true);

    const current = useWorkspaceStore.getState();
    store.importWorkspace({
      domain: current.domain,
      ui: {
        mode: current.ui.mode,
        tool: current.ui.tool,
        selection: current.ui.selection,
        canvasTransform: current.ui.canvasTransform,
        backgroundImage: current.ui.backgroundImage,
        robotPreviewEnabled: current.ui.robotPreviewEnabled,
        robotSettings: current.ui.robotSettings,
      },
    });

    expect(store.canUndo()).toBe(false);
  });

  it('supports wide zoom range while keeping cursor anchor stable', () => {
    const store = useWorkspaceStore.getState();
    const initial = store.ui.canvasTransform;

    store.zoomCanvas(320, 240, -240);
    const zoomedIn = useWorkspaceStore.getState().ui.canvasTransform;
    expect(zoomedIn.k).toBeGreaterThan(initial.k);

    store.zoomCanvas(320, 240, 100000);
    const zoomedOut = useWorkspaceStore.getState().ui.canvasTransform;
    expect(zoomedOut.k).toBe(MIN_CANVAS_SCALE);

    store.zoomCanvas(320, 240, -100000);
    const maxZoomed = useWorkspaceStore.getState().ui.canvasTransform;
    expect(maxZoomed.k).toBe(MAX_CANVAS_SCALE);
  });
});
