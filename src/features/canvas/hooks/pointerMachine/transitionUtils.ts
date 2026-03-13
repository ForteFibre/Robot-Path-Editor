import type {
  ContinuousDragState,
  MachineState,
  PendingPanState,
  PointerSnapshot,
} from './types';

export const SNAP_THRESHOLD = 10;
export const CLICK_THRESHOLD = 3;

export const hasCrossedDragThreshold = (params: {
  startScreenX: number;
  startScreenY: number;
  snapshot: PointerSnapshot;
}): boolean => {
  return (
    Math.hypot(
      params.snapshot.clientX - params.startScreenX,
      params.snapshot.clientY - params.startScreenY,
    ) > CLICK_THRESHOLD
  );
};

export const resolveContinuousDragStateOnMove = <
  State extends ContinuousDragState,
>(params: {
  state: State;
  snapshot: PointerSnapshot;
}): State | null => {
  const { state, snapshot } = params;
  if (state.hasMoved) {
    return state;
  }

  if (
    !hasCrossedDragThreshold({
      startScreenX: state.startScreenX,
      startScreenY: state.startScreenY,
      snapshot,
    })
  ) {
    return null;
  }

  return { ...state, hasMoved: true } as State;
};

export const shouldStartPan = (params: {
  state: PendingPanState;
  snapshot: PointerSnapshot;
}): boolean => {
  return hasCrossedDragThreshold({
    startScreenX: params.state.startScreenX,
    startScreenY: params.state.startScreenY,
    snapshot: params.snapshot,
  });
};

export const isContinuousDragState = (
  state: MachineState,
): state is ContinuousDragState => {
  return (
    state.kind === 'dragging-background-image' ||
    state.kind === 'dragging-waypoint' ||
    state.kind === 'dragging-path-heading' ||
    state.kind === 'dragging-robot-heading' ||
    state.kind === 'dragging-heading-keyframe' ||
    state.kind === 'dragging-heading-keyframe-heading' ||
    state.kind === 'dragging-rmin'
  );
};
