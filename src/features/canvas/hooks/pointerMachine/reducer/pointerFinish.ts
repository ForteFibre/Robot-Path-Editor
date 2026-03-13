import { distance } from '../../../../../domain/geometry';
import type {
  ContinuousDragState,
  MachineState,
  PointerSnapshot,
  TransitionEffect,
  TransitionResult,
} from '../types';
import {
  clearLocalUiEffects,
  idleState,
  releasePointerEffect,
  result,
} from './shared';

const finishStationaryContinuousDrag = (
  state: ContinuousDragState,
  snapshot: PointerSnapshot,
): TransitionResult => {
  switch (state.kind) {
    case 'dragging-waypoint':
    case 'dragging-path-heading':
      return result(idleState(), [
        ...clearLocalUiEffects(),
        {
          kind: 'path.select-waypoint',
          pathId: state.pathId,
          waypointId: state.waypointId,
        },
        ...(state.kind === 'dragging-path-heading' &&
        state.origin === 'add-point'
          ? [{ kind: 'command.complete-add-waypoint-mode' } as const]
          : []),
        releasePointerEffect(snapshot),
      ]);
    case 'dragging-robot-heading':
      return result(idleState(), [
        ...clearLocalUiEffects(),
        {
          kind: 'heading.select-waypoint',
          pathId: state.pathId,
          waypointId: state.waypointId,
        },
        releasePointerEffect(snapshot),
      ]);
    case 'dragging-heading-keyframe':
    case 'dragging-heading-keyframe-heading':
      return result(idleState(), [
        ...clearLocalUiEffects(),
        {
          kind: 'heading.select-heading-keyframe',
          pathId: state.pathId,
          headingKeyframeId: state.headingKeyframeId,
        },
        ...(state.kind === 'dragging-heading-keyframe-heading' &&
        state.origin === 'add-point'
          ? [{ kind: 'command.complete-add-waypoint-mode' } as const]
          : []),
        releasePointerEffect(snapshot),
      ]);
    case 'dragging-background-image':
      return result(idleState(), [
        ...clearLocalUiEffects(),
        { kind: 'command.execute-pan-selection-clear' },
        releasePointerEffect(snapshot),
      ]);
    case 'dragging-rmin':
      return result(idleState(), [
        ...clearLocalUiEffects(),
        {
          kind: 'rmin.select-section',
          pathId: state.target.pathId,
          sectionIndex: state.target.sectionIndex,
        },
        releasePointerEffect(snapshot),
      ]);
  }
};

const finishMovedContinuousDrag = (
  state: ContinuousDragState,
  snapshot: PointerSnapshot,
): TransitionResult => {
  const baseEffects: TransitionEffect[] = [...clearLocalUiEffects()];

  switch (state.kind) {
    case 'dragging-path-heading':
    case 'dragging-heading-keyframe-heading':
      if (state.origin === 'add-point') {
        baseEffects.push({ kind: 'command.complete-add-waypoint-mode' });
      }
      break;
    case 'dragging-rmin':
      if (snapshot.world !== null) {
        const currentDistance = distance(
          state.target.waypointPoint,
          snapshot.world,
        );
        const distanceOffset = currentDistance - state.startDistance;
        baseEffects.push({
          kind: 'rmin.update-section-rmin',
          pathId: state.target.pathId,
          sectionIndex: state.target.sectionIndex,
          rMin: Math.max(0, state.initialRMin + distanceOffset),
        });
      }
      break;
    case 'dragging-waypoint':
    case 'dragging-robot-heading':
    case 'dragging-heading-keyframe':
    case 'dragging-background-image':
      break;
  }

  baseEffects.push(releasePointerEffect(snapshot));
  return result(idleState(), baseEffects);
};

const finishContinuousDrag = (
  state: ContinuousDragState,
  snapshot: PointerSnapshot,
): TransitionResult => {
  return state.hasMoved
    ? finishMovedContinuousDrag(state, snapshot)
    : finishStationaryContinuousDrag(state, snapshot);
};

export const reducePointerFinish = (
  state: MachineState,
  snapshot: PointerSnapshot,
): TransitionResult => {
  if (state.kind === 'pending-pan') {
    return result(idleState(), [
      releasePointerEffect(snapshot),
      ...clearLocalUiEffects(),
    ]);
  }

  if (
    state.kind === 'dragging-background-image' ||
    state.kind === 'dragging-waypoint' ||
    state.kind === 'dragging-path-heading' ||
    state.kind === 'dragging-robot-heading' ||
    state.kind === 'dragging-heading-keyframe' ||
    state.kind === 'dragging-heading-keyframe-heading' ||
    state.kind === 'dragging-rmin'
  ) {
    return finishContinuousDrag(state, snapshot);
  }

  return result(idleState(), [
    releasePointerEffect(snapshot),
    ...clearLocalUiEffects(),
  ]);
};
