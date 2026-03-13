import type { RMinDragTarget } from '../../../types/rMinDragTarget';
import { HANDLE_MATCH_EPSILON } from '../geometry';
import type {
  MachineState,
  PointerSnapshot,
  TransitionEffect,
  TransitionResult,
} from '../types';

export const idleState = (): MachineState => ({ kind: 'idle' });

export const result = (
  nextState: MachineState,
  effects: TransitionEffect[] = [],
): TransitionResult => ({ nextState, effects });

export const EMPTY_GUIDE = {
  x: null,
  y: null,
  line: null,
  point: null,
  label: null,
} as const;

export const capturePointerEffect = (
  snapshot: PointerSnapshot,
): TransitionEffect => ({
  kind: 'local.capture-pointer',
  pointerId: snapshot.pointerId,
});

export const releasePointerEffect = (
  snapshot: PointerSnapshot,
): TransitionEffect => ({
  kind: 'local.release-pointer',
  pointerId: snapshot.pointerId,
});

export const clearLocalUiEffects = (): TransitionEffect[] => {
  return [
    { kind: 'local.set-snap-guide', guide: EMPTY_GUIDE },
    { kind: 'local.set-add-point-preview', preview: null },
  ];
};

export const createPendingPanState = (
  snapshot: PointerSnapshot,
): MachineState => {
  return {
    kind: 'pending-pan',
    startScreenX: snapshot.clientX,
    startScreenY: snapshot.clientY,
    startTx: snapshot.workspace.canvasTransform.x,
    startTy: snapshot.workspace.canvasTransform.y,
  };
};

export const findMatchingRMinTarget = (
  targets: RMinDragTarget[],
  pathId: string,
  sectionIndex: number,
  center: { x: number; y: number },
): RMinDragTarget | null => {
  return (
    targets.find(
      (candidate) =>
        candidate.pathId === pathId &&
        candidate.sectionIndex === sectionIndex &&
        Math.abs(candidate.center.x - center.x) < HANDLE_MATCH_EPSILON &&
        Math.abs(candidate.center.y - center.y) < HANDLE_MATCH_EPSILON,
    ) ?? null
  );
};
