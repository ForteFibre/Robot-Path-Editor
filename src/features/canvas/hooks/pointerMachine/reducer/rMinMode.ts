import { distance } from '../../../../../domain/geometry';
import { resolveContinuousDragStateOnMove } from '../transitionUtils';
import type {
  DraggingRMinState,
  PointerSnapshot,
  TransitionResult,
} from '../types';
import {
  capturePointerEffect,
  findMatchingRMinTarget,
  idleState,
  result,
} from './shared';

export const reduceRMinPointerDown = (
  snapshot: PointerSnapshot,
  hit: Extract<PointerSnapshot['hit'], { kind: 'rmin-handle' }>,
): TransitionResult => {
  if (snapshot.workspace.mode !== 'path' || snapshot.world === null) {
    return result(idleState());
  }

  const target = findMatchingRMinTarget(
    snapshot.rMinDragTargets,
    hit.pathId,
    hit.sectionIndex,
    hit.center,
  );
  if (target === null) {
    return result(idleState());
  }

  return result(
    {
      kind: 'dragging-rmin',
      target,
      startScreenX: snapshot.clientX,
      startScreenY: snapshot.clientY,
      startDistance: distance(target.waypointPoint, snapshot.world),
      initialRMin: target.rMin,
      hasMoved: false,
    },
    [capturePointerEffect(snapshot)],
  );
};

export const reduceRMinMove = (
  state: DraggingRMinState,
  snapshot: PointerSnapshot,
): TransitionResult => {
  const movedState = resolveContinuousDragStateOnMove({ state, snapshot });
  if (movedState === null || snapshot.world === null) {
    return result(state);
  }

  const currentDistance = distance(state.target.waypointPoint, snapshot.world);
  const distanceOffset = currentDistance - state.startDistance;

  return result(movedState, [
    { kind: 'local.set-add-point-preview', preview: null },
    {
      kind: 'rmin.update-section-rmin',
      pathId: state.target.pathId,
      sectionIndex: state.target.sectionIndex,
      rMin: Math.max(0, state.initialRMin + distanceOffset),
    },
  ]);
};
