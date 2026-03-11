import type Konva from 'konva';
import { useCallback } from 'react';
import { moveBackgroundImageAnchorByScreenDelta } from '../../../../domain/backgroundImage';
import { type Workspace } from '../../../../domain/models';
import {
  getWorkspaceSnapshot,
  useWorkspaceActions,
} from '../../../../store/workspaceStore';
import { resolveContinuousDragStateOnMove, shouldStartPan } from './helpers';
import type {
  CanvasPointerEvent,
  CaptureStagePointer,
  DraggingBackgroundImageState,
  PendingPanState,
  PanningState,
  SetMachineState,
} from './types';

type UsePanInteractionParams = {
  setMachineState: SetMachineState;
  captureStagePointer: CaptureStagePointer;
};

export const usePanInteraction = ({
  setMachineState,
  captureStagePointer,
}: UsePanInteractionParams) => {
  const { clearSelection, setCanvasTransform, updateBackgroundImage } =
    useWorkspaceActions();

  const startPan = useCallback(
    (event: CanvasPointerEvent, stage: Konva.Stage) => {
      const workspace = getWorkspaceSnapshot();
      setMachineState({
        kind: 'pending-pan',
        startScreenX: event.evt.clientX,
        startScreenY: event.evt.clientY,
        startTx: workspace.canvasTransform.x,
        startTy: workspace.canvasTransform.y,
      });
      captureStagePointer(stage, event);
    },
    [captureStagePointer, setMachineState],
  );

  const beginBackgroundImageInteraction = useCallback(
    (
      event: CanvasPointerEvent,
      stage: Konva.Stage,
      workspace: Workspace,
    ): void => {
      if (workspace.backgroundImage === null) {
        return;
      }

      setMachineState({
        kind: 'dragging-background-image',
        startScreenX: event.evt.clientX,
        startScreenY: event.evt.clientY,
        startImgX: workspace.backgroundImage.x,
        startImgY: workspace.backgroundImage.y,
        hasMoved: false,
      });
      captureStagePointer(stage, event);
    },
    [captureStagePointer, setMachineState],
  );

  const resolvePendingPanMoveState = useCallback(
    (
      state: PendingPanState,
      event: CanvasPointerEvent,
    ): PanningState | PendingPanState | null => {
      if (!shouldStartPan({ state, event })) {
        return null;
      }

      const panningState: PanningState = {
        kind: 'panning',
        startScreenX: state.startScreenX,
        startScreenY: state.startScreenY,
        startTx: state.startTx,
        startTy: state.startTy,
      };
      setMachineState(panningState);
      return panningState;
    },
    [setMachineState],
  );

  const resolveBackgroundImageMoveState = useCallback(
    (
      state: DraggingBackgroundImageState,
      event: CanvasPointerEvent,
    ): DraggingBackgroundImageState | null => {
      return resolveContinuousDragStateOnMove({
        state,
        event,
        setMachineState,
      });
    },
    [setMachineState],
  );

  const handlePointerMove = useCallback(
    (params: {
      state: PanningState | DraggingBackgroundImageState;
      event: CanvasPointerEvent;
      workspace: Workspace;
    }) => {
      const { state, event, workspace } = params;

      if (state.kind === 'panning') {
        setCanvasTransform({
          x: state.startTx + (event.evt.clientX - state.startScreenX),
          y: state.startTy + (event.evt.clientY - state.startScreenY),
          k: workspace.canvasTransform.k,
        });
        return;
      }

      updateBackgroundImage(
        moveBackgroundImageAnchorByScreenDelta(
          { x: state.startImgX, y: state.startImgY },
          {
            x: event.evt.clientX - state.startScreenX,
            y: event.evt.clientY - state.startScreenY,
          },
          workspace.canvasTransform.k,
        ),
      );
    },
    [setCanvasTransform, updateBackgroundImage],
  );

  const finishStationaryBackgroundImageInteraction = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  return {
    startPan,
    beginBackgroundImageInteraction,
    resolvePendingPanMoveState,
    resolveBackgroundImageMoveState,
    handlePointerMove,
    finishStationaryBackgroundImageInteraction,
  } satisfies {
    startPan: (event: CanvasPointerEvent, stage: Konva.Stage) => void;
    beginBackgroundImageInteraction: (
      event: CanvasPointerEvent,
      stage: Konva.Stage,
      workspace: Workspace,
    ) => void;
    resolvePendingPanMoveState: (
      state: PendingPanState,
      event: CanvasPointerEvent,
    ) => PanningState | PendingPanState | null;
    resolveBackgroundImageMoveState: (
      state: DraggingBackgroundImageState,
      event: CanvasPointerEvent,
    ) => DraggingBackgroundImageState | null;
    handlePointerMove: (params: {
      state: PanningState | DraggingBackgroundImageState;
      event: CanvasPointerEvent;
      workspace: Workspace;
    }) => void;
    finishStationaryBackgroundImageInteraction: () => void;
  };
};
