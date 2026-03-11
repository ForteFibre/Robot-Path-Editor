import type Konva from 'konva';
import { useCallback } from 'react';
import {
  distance,
  EMPTY_SNAP_GUIDE,
  type SnapGuide,
} from '../../../../domain/geometry';
import { type Workspace } from '../../../../domain/models';
import { useWorkspaceActions } from '../../../../store/workspaceStore';
import { getPointerWorldFromStage, type HitTarget } from '../canvasHitTesting';
import {
  HANDLE_MATCH_EPSILON,
  resolveContinuousDragStateOnMove,
} from './helpers';
import type {
  CanvasPointerEvent,
  CaptureStagePointer,
  DraggingRMinState,
  PointerMachineRefs,
  SetMachineState,
} from './types';

type UseRMinInteractionParams = {
  refs: PointerMachineRefs;
  setMachineState: SetMachineState;
  setSnapGuide: (guide: SnapGuide) => void;
  captureStagePointer: CaptureStagePointer;
};

export const useRMinInteraction = ({
  refs,
  setMachineState,
  setSnapGuide,
  captureStagePointer,
}: UseRMinInteractionParams) => {
  const { setSectionRMin, setSelection } = useWorkspaceActions();

  const resetRMinToAuto = useCallback(
    (hit: Extract<HitTarget, { kind: 'rmin-handle' }>): boolean => {
      const target = refs.rMinTargetsRef.current.find(
        (candidate) =>
          candidate.pathId === hit.pathId &&
          candidate.sectionIndex === hit.sectionIndex &&
          Math.abs(candidate.center.x - hit.center.x) < HANDLE_MATCH_EPSILON &&
          Math.abs(candidate.center.y - hit.center.y) < HANDLE_MATCH_EPSILON,
      );
      if (target === undefined) {
        return false;
      }

      setSectionRMin(hit.pathId, hit.sectionIndex, null);
      setSelection({
        pathId: hit.pathId,
        waypointId: null,
        headingKeyframeId: null,
        sectionIndex: hit.sectionIndex,
      });
      return true;
    },
    [refs.rMinTargetsRef, setSectionRMin, setSelection],
  );

  const beginRMinInteraction = useCallback(
    (
      event: CanvasPointerEvent,
      stage: Konva.Stage,
      workspace: Workspace,
      hit: Extract<HitTarget, { kind: 'rmin-handle' }>,
    ): boolean => {
      if (workspace.mode !== 'path') {
        return false;
      }

      const target = refs.rMinTargetsRef.current.find(
        (candidate) =>
          candidate.pathId === hit.pathId &&
          candidate.sectionIndex === hit.sectionIndex &&
          Math.abs(candidate.center.x - hit.center.x) < HANDLE_MATCH_EPSILON &&
          Math.abs(candidate.center.y - hit.center.y) < HANDLE_MATCH_EPSILON,
      );
      if (target === undefined) {
        return true;
      }

      const pointerWorld = getPointerWorldFromStage(
        stage,
        workspace.canvasTransform,
      );
      if (pointerWorld === null) {
        return true;
      }

      setMachineState({
        kind: 'dragging-rmin',
        target,
        startScreenX: event.evt.clientX,
        startScreenY: event.evt.clientY,
        startDistance: distance(target.waypointPoint, pointerWorld),
        initialRMin: target.rMin,
        hasMoved: false,
      });
      captureStagePointer(stage, event);
      return true;
    },
    [captureStagePointer, refs.rMinTargetsRef, setMachineState],
  );

  const resolveRMinMoveState = useCallback(
    (
      state: DraggingRMinState,
      event: CanvasPointerEvent,
    ): DraggingRMinState | null => {
      return resolveContinuousDragStateOnMove({
        state,
        event,
        setMachineState,
      });
    },
    [setMachineState],
  );

  const handlePointerMove = useCallback(
    (
      state: DraggingRMinState,
      stage: Konva.Stage,
      workspace: Workspace,
    ): void => {
      const world = getPointerWorldFromStage(stage, workspace.canvasTransform);
      if (world === null) {
        return;
      }

      const currentDistance = distance(state.target.waypointPoint, world);
      const distanceOffset = currentDistance - state.startDistance;
      const nextRMin = Math.max(0, state.initialRMin + distanceOffset);
      setSectionRMin(state.target.pathId, state.target.sectionIndex, nextRMin);
    },
    [setSectionRMin],
  );

  const finalizeMovedInteraction = useCallback(
    (
      state: DraggingRMinState,
      stage: Konva.Stage,
      workspace: Workspace,
    ): void => {
      const world = getPointerWorldFromStage(stage, workspace.canvasTransform);
      if (world === null) {
        setSnapGuide(EMPTY_SNAP_GUIDE);
        return;
      }

      const currentDistance = distance(state.target.waypointPoint, world);
      const distanceOffset = currentDistance - state.startDistance;
      setSectionRMin(
        state.target.pathId,
        state.target.sectionIndex,
        Math.max(0, state.initialRMin + distanceOffset),
      );
      setSnapGuide(EMPTY_SNAP_GUIDE);
    },
    [setSectionRMin, setSnapGuide],
  );

  const finishStationaryInteraction = useCallback(
    (state: DraggingRMinState): void => {
      setSelection({
        pathId: state.target.pathId,
        waypointId: null,
        headingKeyframeId: null,
        sectionIndex: state.target.sectionIndex,
      });
    },
    [setSelection],
  );

  return {
    beginRMinInteraction,
    resetRMinToAuto,
    resolveRMinMoveState,
    handlePointerMove,
    finalizeMovedInteraction,
    finishStationaryInteraction,
  };
};
