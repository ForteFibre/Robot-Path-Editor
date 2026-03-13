import {
  resolveHeadingKeyframePreview,
  resolvePathAddPointPreview,
} from '../geometry';
import { shouldStartPan, SNAP_THRESHOLD } from '../transitionUtils';
import type { MachineState, PointerSnapshot, TransitionResult } from '../types';
import {
  reduceHeadingKeyframeHeadingMove,
  reduceHeadingKeyframeMove,
  reduceRobotHeadingMove,
} from './headingMode';
import { reducePathHeadingMove, reduceWaypointMove } from './pathMode';
import { reduceBackgroundImageMove, reducePanningMove } from './panMode';
import { reduceRMinMove } from './rMinMode';
import { clearLocalUiEffects, EMPTY_GUIDE, idleState, result } from './shared';

const reduceIdlePointerMove = (snapshot: PointerSnapshot): TransitionResult => {
  const { workspace } = snapshot;

  if (
    workspace.tool === 'add-point' &&
    workspace.mode === 'path' &&
    snapshot.world !== null
  ) {
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

    return result(idleState(), [
      { kind: 'local.set-add-point-preview', preview: preview.preview },
      { kind: 'local.set-snap-guide', guide: preview.guide },
    ]);
  }

  if (workspace.tool === 'add-point' && workspace.mode === 'heading') {
    if (snapshot.hit.kind !== 'section' || snapshot.world === null) {
      return result(idleState(), clearLocalUiEffects());
    }

    return result(idleState(), [
      {
        kind: 'local.set-add-point-preview',
        preview: resolveHeadingKeyframePreview({
          workspace,
          resolvedPaths: snapshot.resolvedPaths,
          discretizedByPath: snapshot.discretizedByPath,
          source: snapshot.world,
        }),
      },
      {
        kind: 'local.set-snap-guide',
        guide: EMPTY_GUIDE,
      },
    ]);
  }

  return result(idleState(), clearLocalUiEffects());
};

export const reducePointerMove = (
  state: MachineState,
  snapshot: PointerSnapshot,
): TransitionResult => {
  switch (state.kind) {
    case 'idle':
      return reduceIdlePointerMove(snapshot);
    case 'pending-pan': {
      if (!shouldStartPan({ state, snapshot })) {
        return result(state);
      }

      return result({
        kind: 'panning',
        startScreenX: state.startScreenX,
        startScreenY: state.startScreenY,
        startTx: state.startTx,
        startTy: state.startTy,
      });
    }
    case 'panning':
      return reducePanningMove(state, snapshot);
    case 'dragging-background-image':
      return reduceBackgroundImageMove(state, snapshot);
    case 'dragging-waypoint':
      return reduceWaypointMove(state, snapshot);
    case 'dragging-path-heading':
      return reducePathHeadingMove(state, snapshot);
    case 'dragging-robot-heading':
      return reduceRobotHeadingMove(state, snapshot);
    case 'dragging-heading-keyframe':
      return reduceHeadingKeyframeMove(state, snapshot);
    case 'dragging-heading-keyframe-heading':
      return reduceHeadingKeyframeHeadingMove(state, snapshot);
    case 'dragging-rmin':
      return reduceRMinMove(state, snapshot);
  }
};
