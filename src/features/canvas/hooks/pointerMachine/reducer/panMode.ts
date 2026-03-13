import { moveBackgroundImageAnchorByScreenDelta } from '../../../../../domain/backgroundImage';
import { resolveContinuousDragStateOnMove } from '../transitionUtils';
import type {
  DraggingBackgroundImageState,
  PanningState,
  PointerSnapshot,
  TransitionResult,
} from '../types';
import { capturePointerEffect, idleState, result } from './shared';

export const reduceBackgroundImagePointerDown = (
  snapshot: PointerSnapshot,
): TransitionResult => {
  if (snapshot.workspace.backgroundImage === null) {
    return result(idleState());
  }

  return result(
    {
      kind: 'dragging-background-image',
      startScreenX: snapshot.clientX,
      startScreenY: snapshot.clientY,
      startImgX: snapshot.workspace.backgroundImage.x,
      startImgY: snapshot.workspace.backgroundImage.y,
      hasMoved: false,
    },
    [capturePointerEffect(snapshot)],
  );
};

export const reducePanningMove = (
  state: PanningState,
  snapshot: PointerSnapshot,
): TransitionResult => {
  return result(state, [
    { kind: 'local.set-add-point-preview', preview: null },
    {
      kind: 'pan.set-canvas-transform',
      transform: {
        x: state.startTx + (snapshot.clientX - state.startScreenX),
        y: state.startTy + (snapshot.clientY - state.startScreenY),
        k: snapshot.workspace.canvasTransform.k,
      },
    },
  ]);
};

export const reduceBackgroundImageMove = (
  state: DraggingBackgroundImageState,
  snapshot: PointerSnapshot,
): TransitionResult => {
  const movedState = resolveContinuousDragStateOnMove({ state, snapshot });
  if (movedState === null || snapshot.workspace.backgroundImage === null) {
    return result(state);
  }

  return result(movedState, [
    { kind: 'local.set-add-point-preview', preview: null },
    {
      kind: 'pan.update-background-image',
      updates: moveBackgroundImageAnchorByScreenDelta(
        {
          x: state.startImgX,
          y: state.startImgY,
        },
        {
          x: snapshot.clientX - state.startScreenX,
          y: snapshot.clientY - state.startScreenY,
        },
        snapshot.workspace.canvasTransform.k,
      ),
    },
  ]);
};
