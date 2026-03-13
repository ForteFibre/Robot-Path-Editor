import type { MachineState, PointerSnapshot, TransitionResult } from '../types';
import {
  reduceHeadingKeyframeHeadingPointerDown,
  reduceHeadingKeyframePointerDown,
  reduceRobotHeadingPointerDown,
  reduceSectionPointerDown,
} from './headingMode';
import {
  reduceCanvasPathPointerDown,
  reducePathHeadingPointerDown,
  reduceWaypointPointerDown,
} from './pathMode';
import { reduceBackgroundImagePointerDown } from './panMode';
import { reduceRMinPointerDown } from './rMinMode';
import {
  capturePointerEffect,
  createPendingPanState,
  idleState,
  result,
} from './shared';

const reduceCanvasPointerDown = (
  snapshot: PointerSnapshot,
): TransitionResult => {
  const { workspace } = snapshot;

  if (workspace.tool === 'edit-image' && workspace.backgroundImage !== null) {
    return result(createPendingPanState(snapshot), [
      capturePointerEffect(snapshot),
    ]);
  }

  if (workspace.mode === 'path') {
    return reduceCanvasPathPointerDown(snapshot);
  }

  if (workspace.tool === 'add-point') {
    return result(idleState(), [
      { kind: 'heading.clear-selection' },
      { kind: 'local.set-add-point-preview', preview: null },
    ]);
  }

  return result(createPendingPanState(snapshot), [
    { kind: 'command.execute-pan-selection-clear' },
    capturePointerEffect(snapshot),
  ]);
};

export const reducePointerDown = (
  state: MachineState,
  snapshot: PointerSnapshot,
): TransitionResult => {
  if (state.kind !== 'idle') {
    return result(state);
  }

  const { hit } = snapshot;

  switch (hit.kind) {
    case 'waypoint':
      return reduceWaypointPointerDown(snapshot, hit);
    case 'path-heading':
      return reducePathHeadingPointerDown(snapshot, hit);
    case 'robot-heading':
      return reduceRobotHeadingPointerDown(snapshot, hit);
    case 'heading-keyframe':
      return reduceHeadingKeyframePointerDown(snapshot, hit);
    case 'heading-keyframe-heading':
      return reduceHeadingKeyframeHeadingPointerDown(snapshot, hit);
    case 'section':
      return reduceSectionPointerDown(snapshot, hit);
    case 'rmin-handle':
      return reduceRMinPointerDown(snapshot, hit);
    case 'background-image':
      return reduceBackgroundImagePointerDown(snapshot);
    case 'canvas':
      return reduceCanvasPointerDown(snapshot);
  }
};
