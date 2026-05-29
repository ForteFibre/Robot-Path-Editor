import type {
  ContinuousDragState,
  MachineState,
  PointerMachineEvent,
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
        ...(state.preview === null
          ? []
          : [
              {
                kind: 'pan.update-background-image',
                updates: state.preview,
              } as const,
            ]),
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
  reason: Extract<PointerMachineEvent, { type: 'pointer-finish' }>['reason'],
): TransitionResult => {
  const baseEffects: TransitionEffect[] = [...clearLocalUiEffects()];

  switch (state.kind) {
    case 'dragging-waypoint':
      if (state.previewPoint !== null) {
        baseEffects.push({
          kind: 'path.update-waypoint-position',
          pathId: state.pathId,
          waypointId: state.waypointId,
          point: state.previewPoint,
        });
      }
      break;
    case 'dragging-path-heading':
      if (state.previewHeading !== null) {
        baseEffects.push({
          kind: 'path.update-waypoint-path-heading',
          pathId: state.pathId,
          waypointId: state.waypointId,
          pathHeading: state.previewHeading,
        });
      }
      if (state.origin === 'add-point') {
        baseEffects.push({ kind: 'command.complete-add-waypoint-mode' });
      }
      break;
    case 'dragging-robot-heading':
      if (state.previewHeading !== null) {
        baseEffects.push({
          kind: 'heading.update-waypoint-robot-heading',
          pathId: state.pathId,
          waypointId: state.waypointId,
          robotHeading: state.previewHeading,
        });
      }
      break;
    case 'dragging-heading-keyframe':
      if (state.previewPosition !== null) {
        baseEffects.push({
          kind: 'heading.update-heading-keyframe-position',
          pathId: state.pathId,
          headingKeyframeId: state.headingKeyframeId,
          sectionIndex: state.previewPosition.sectionIndex,
          sectionRatio: state.previewPosition.sectionRatio,
        });
      }
      break;
    case 'dragging-heading-keyframe-heading':
      if (state.previewHeading !== null) {
        baseEffects.push({
          kind: 'heading.update-heading-keyframe-heading',
          pathId: state.pathId,
          headingKeyframeId: state.headingKeyframeId,
          robotHeading: state.previewHeading,
        });
      }
      if (state.origin === 'add-point') {
        baseEffects.push({ kind: 'command.complete-add-waypoint-mode' });
      }
      break;
    case 'dragging-rmin':
      if (state.previewRMin !== null) {
        baseEffects.push({
          kind: 'rmin.update-section-rmin',
          pathId: state.target.pathId,
          sectionIndex: state.target.sectionIndex,
          rMin: state.previewRMin,
        });
      }
      break;
    case 'dragging-background-image':
      if (state.preview !== null && reason === 'pointer-up') {
        baseEffects.push({
          kind: 'pan.update-background-image',
          updates: state.preview,
        });
      }
      break;
  }

  baseEffects.push(releasePointerEffect(snapshot));
  return result(idleState(), baseEffects);
};

const finishContinuousDrag = (
  state: ContinuousDragState,
  snapshot: PointerSnapshot,
  reason: Extract<PointerMachineEvent, { type: 'pointer-finish' }>['reason'],
): TransitionResult => {
  return state.hasMoved
    ? finishMovedContinuousDrag(state, snapshot, reason)
    : finishStationaryContinuousDrag(state, snapshot);
};

export const reducePointerFinish = (
  state: MachineState,
  snapshot: PointerSnapshot,
  reason: Extract<PointerMachineEvent, { type: 'pointer-finish' }>['reason'],
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
    return finishContinuousDrag(state, snapshot, reason);
  }

  return result(idleState(), [
    releasePointerEffect(snapshot),
    ...clearLocalUiEffects(),
  ]);
};
