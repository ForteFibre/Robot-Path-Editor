import type { AppNotification } from '../../../../../errors';
import {
  findResolvedWaypointContext,
  findWaypointWithPoint,
  resolveHeadingWithModifiers,
  resolvePathAddPointPreview,
  resolvePointWithModifiers,
} from '../geometry';
import { makeId } from '../../../../../domain/factories';
import { isWaypointLocked } from '../../../../../store/commands/canvasEditingPolicy';
import {
  hasCrossedDragThreshold,
  resolveContinuousDragStateOnMove,
  SNAP_THRESHOLD,
} from '../transitionUtils';
import type {
  DraggingPathHeadingState,
  DraggingWaypointState,
  PointerSnapshot,
  TransitionResult,
} from '../types';
import {
  capturePointerEffect,
  clearLocalUiEffects,
  createPendingPanState,
  idleState,
  result,
  releasePointerEffect,
} from './shared';

const LOCKED_WAYPOINT_NOTIFICATION: AppNotification = {
  kind: 'info',
  message:
    'このポイントはロックされています。移動させるにはロックを解除してください。',
};

export const reduceCanvasPathPointerDown = (
  snapshot: PointerSnapshot,
): TransitionResult => {
  const { workspace } = snapshot;

  if (workspace.tool !== 'add-point') {
    return result(createPendingPanState(snapshot), [
      { kind: 'path.clear-selection' },
      capturePointerEffect(snapshot),
    ]);
  }

  if (snapshot.world === null) {
    return result(idleState(), clearLocalUiEffects());
  }

  const activePath = workspace.paths.find(
    (path) => path.id === workspace.activePathId,
  );
  if (activePath === undefined) {
    return result(createPendingPanState(snapshot), [
      { kind: 'path.clear-selection' },
      capturePointerEffect(snapshot),
    ]);
  }

  const preview = resolvePathAddPointPreview({
    workspace,
    resolvedPaths: snapshot.resolvedPaths,
    candidates: snapshot.waypointPoints.map((candidate) => ({
      x: candidate.x,
      y: candidate.y,
    })),
    source: snapshot.world,
    settings: snapshot.snapSettings,
    threshold: SNAP_THRESHOLD / workspace.canvasTransform.k,
    shiftKey: snapshot.shiftKey,
    altKey: snapshot.altKey,
  });

  if (preview.preview?.kind !== 'path-waypoint') {
    return result(idleState(), clearLocalUiEffects());
  }

  const waypointId = makeId();
  const pointId = makeId();

  return result(
    {
      kind: 'dragging-path-heading',
      pathId: activePath.id,
      waypointId,
      startScreenX: snapshot.clientX,
      startScreenY: snapshot.clientY,
      hasMoved: false,
      origin: 'add-point',
    },
    [
      { kind: 'local.set-snap-guide', guide: preview.guide },
      { kind: 'local.set-add-point-preview', preview: null },
      {
        kind: 'command.execute-add-waypoint',
        params: {
          pathId: activePath.id,
          pointId,
          waypointId,
          x: preview.preview.point.x,
          y: preview.preview.point.y,
        },
      },
      capturePointerEffect(snapshot),
    ],
  );
};

export const reduceWaypointPointerDown = (
  snapshot: PointerSnapshot,
  hit: Extract<PointerSnapshot['hit'], { kind: 'waypoint' }>,
): TransitionResult => {
  if (snapshot.workspace.mode === 'path') {
    return result(
      {
        kind: 'dragging-waypoint',
        pathId: hit.pathId,
        waypointId: hit.waypointId,
        startScreenX: snapshot.clientX,
        startScreenY: snapshot.clientY,
        hasMoved: false,
      },
      [capturePointerEffect(snapshot)],
    );
  }

  return result(idleState(), [
    {
      kind: 'heading.select-waypoint',
      pathId: hit.pathId,
      waypointId: hit.waypointId,
    },
  ]);
};

export const reducePathHeadingPointerDown = (
  snapshot: PointerSnapshot,
  hit: Extract<PointerSnapshot['hit'], { kind: 'path-heading' }>,
): TransitionResult => {
  if (snapshot.workspace.mode !== 'path') {
    return result(idleState());
  }

  return result(
    {
      kind: 'dragging-path-heading',
      pathId: hit.pathId,
      waypointId: hit.waypointId,
      startScreenX: snapshot.clientX,
      startScreenY: snapshot.clientY,
      hasMoved: false,
      origin: 'existing',
    },
    [capturePointerEffect(snapshot)],
  );
};

export const reduceWaypointMove = (
  state: DraggingWaypointState,
  snapshot: PointerSnapshot,
): TransitionResult => {
  if (
    isWaypointLocked(
      state.waypointId,
      snapshot.workspace.paths,
      snapshot.workspace.lockedPointIds,
    ) &&
    hasCrossedDragThreshold({
      startScreenX: state.startScreenX,
      startScreenY: state.startScreenY,
      snapshot,
    })
  ) {
    return result(idleState(), [
      { kind: 'local.notify', notification: LOCKED_WAYPOINT_NOTIFICATION },
      releasePointerEffect(snapshot),
      ...clearLocalUiEffects(),
    ]);
  }

  const movedState = resolveContinuousDragStateOnMove({ state, snapshot });
  if (movedState === null || snapshot.world === null) {
    return result(state);
  }

  const context = findResolvedWaypointContext(
    snapshot.resolvedPaths,
    state.pathId,
    state.waypointId,
  );
  const snapped = resolvePointWithModifiers({
    source: snapshot.world,
    candidates: snapshot.waypointPoints
      .filter((point) => point.id !== state.waypointId)
      .map((point) => ({ x: point.x, y: point.y })),
    previousPoint: context.previousPoint,
    previousHeadingDeg: context.previousHeadingDeg,
    previousSegmentStart: context.previousSegmentStart,
    settings: snapshot.snapSettings,
    threshold: SNAP_THRESHOLD / snapshot.workspace.canvasTransform.k,
    shiftKey: snapshot.shiftKey,
    altKey: snapshot.altKey,
  });

  return result(movedState, [
    { kind: 'local.set-add-point-preview', preview: null },
    { kind: 'local.set-snap-guide', guide: snapped.guide },
    {
      kind: 'path.update-waypoint-position',
      pathId: state.pathId,
      waypointId: state.waypointId,
      point: snapped.point,
    },
  ]);
};

export const reducePathHeadingMove = (
  state: DraggingPathHeadingState,
  snapshot: PointerSnapshot,
): TransitionResult => {
  const movedState = resolveContinuousDragStateOnMove({ state, snapshot });
  if (movedState === null || snapshot.world === null) {
    return result(state);
  }

  const resolved = findWaypointWithPoint(
    snapshot.workspace,
    state.pathId,
    state.waypointId,
  );
  if (resolved === null) {
    return result(state);
  }

  const context = findResolvedWaypointContext(
    snapshot.resolvedPaths,
    state.pathId,
    state.waypointId,
  );
  const heading = resolveHeadingWithModifiers({
    origin: { x: resolved.point.x, y: resolved.point.y },
    target: snapshot.world,
    previousHeadingDeg: context.previousHeadingDeg,
    previousPoint: context.previousPoint,
    previousSegmentStart: context.previousSegmentStart,
    settings: snapshot.snapSettings,
    shiftKey: snapshot.shiftKey,
    altKey: snapshot.altKey,
  });

  return result(movedState, [
    { kind: 'local.set-add-point-preview', preview: null },
    { kind: 'local.set-snap-guide', guide: heading.guide },
    {
      kind: 'path.update-waypoint-path-heading',
      pathId: state.pathId,
      waypointId: state.waypointId,
      pathHeading: heading.angle,
    },
  ]);
};
