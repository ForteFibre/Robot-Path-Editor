import type Konva from 'konva';
import { useCallback, useRef, useState } from 'react';
import { EMPTY_SNAP_GUIDE } from '../../../domain/geometry';
import { type Workspace } from '../../../domain/models';
import {
  getWorkspaceSnapshot,
  useWorkspaceActions,
} from '../../../store/workspaceStore';
import { resolveStageHit, type HitTarget } from './canvasHitTesting';
import {
  isContinuousDomainDragState,
  isContinuousDragState,
  isRobotAnimationSuppressingState,
} from './pointerMachine/helpers';
import { useHeadingModeInteraction } from './pointerMachine/useHeadingModeInteraction';
import { usePanInteraction } from './pointerMachine/usePanInteraction';
import { usePathModeInteraction } from './pointerMachine/usePathModeInteraction';
import { useRMinInteraction } from './pointerMachine/useRMinInteraction';
import type {
  CanvasDoubleClickEvent,
  CanvasPointerEvent,
  CanvasPointerHandlers,
  MachineState,
  PointerMachineRefs,
  UseCanvasPointerMachineParams,
} from './pointerMachine/types';

export type {
  AddPointPreviewState,
  CanvasDoubleClickEvent,
  CanvasPointerEvent,
  CanvasPointerHandlers,
} from './pointerMachine/types';

export const useCanvasPointerMachine = ({
  stageRef,
  interactionSurfaceRef,
  allVisibleWaypointPoints,
  resolvedPaths,
  discretizedByPath,
  snapSettings,
  rMinDragTargets,
  setSnapGuide,
  setAddPointPreview,
  addPointPreview,
}: UseCanvasPointerMachineParams): CanvasPointerHandlers => {
  const { clearSelection, pause, resume, setDragging, setSelection } =
    useWorkspaceActions();

  const machineRef = useRef<MachineState>({ kind: 'idle' });
  const [isRobotAnimationSuppressed, setIsRobotAnimationSuppressed] =
    useState(false);
  const waypointPointsRef = useRef(allVisibleWaypointPoints);
  waypointPointsRef.current = allVisibleWaypointPoints;
  const resolvedPathsRef = useRef(resolvedPaths);
  resolvedPathsRef.current = resolvedPaths;
  const discretizedByPathRef = useRef(discretizedByPath);
  discretizedByPathRef.current = discretizedByPath;
  const snapSettingsRef = useRef(snapSettings);
  snapSettingsRef.current = snapSettings;
  const rMinTargetsRef = useRef(rMinDragTargets);
  rMinTargetsRef.current = rMinDragTargets;

  const refs: PointerMachineRefs = {
    waypointPointsRef,
    resolvedPathsRef,
    discretizedByPathRef,
    snapSettingsRef,
    rMinTargetsRef,
  };

  const setMachineState = useCallback(
    (newState: MachineState) => {
      const wasDragging = machineRef.current.kind !== 'idle';
      const isNowDragging = newState.kind !== 'idle';

      const wasDomainContinuousDrag = isContinuousDomainDragState(
        machineRef.current,
      );
      const isDomainContinuousDrag = isContinuousDomainDragState(newState);

      machineRef.current = newState;
      setIsRobotAnimationSuppressed(isRobotAnimationSuppressingState(newState));

      if (wasDragging !== isNowDragging) {
        setDragging(isNowDragging);
      }

      if (!wasDomainContinuousDrag && isDomainContinuousDrag) {
        pause();
      }

      if (wasDomainContinuousDrag && !isDomainContinuousDrag) {
        resume();
      }
    },
    [pause, resume, setDragging],
  );

  const captureStagePointer = (
    stage: Konva.Stage,
    event: CanvasPointerEvent,
  ): void => {
    interactionSurfaceRef.current?.setPointerCapture(event.evt.pointerId);
    stage.setPointersPositions(event.evt);
    event.evt.preventDefault();
  };

  const panInteraction = usePanInteraction({
    setMachineState,
    captureStagePointer,
  });

  const pathModeInteraction = usePathModeInteraction({
    refs,
    setMachineState,
    setSnapGuide,
    setAddPointPreview,
    captureStagePointer,
    startPan: panInteraction.startPan,
  });

  const headingModeInteraction = useHeadingModeInteraction({
    refs,
    setMachineState,
    setSnapGuide,
    setAddPointPreview,
    captureStagePointer,
  });

  const rMinInteraction = useRMinInteraction({
    refs,
    setMachineState,
    setSnapGuide,
    captureStagePointer,
  });

  const releaseStagePointer = useCallback(
    (pointerId: number): void => {
      try {
        interactionSurfaceRef.current?.releasePointerCapture(pointerId);
      } catch {
        // Pointer capture may not exist
      }
    },
    [interactionSurfaceRef],
  );

  const handleInteractiveHit = useCallback(
    (
      event: CanvasPointerEvent,
      stage: Konva.Stage,
      workspace: Workspace,
      hit: HitTarget,
    ): boolean => {
      switch (hit.kind) {
        case 'waypoint':
          if (workspace.mode === 'path') {
            pathModeInteraction.beginWaypointDrag(event, stage, hit);
          } else {
            setSelection({
              pathId: hit.pathId,
              waypointId: hit.waypointId,
              headingKeyframeId: null,
              sectionIndex: null,
            });
          }
          return true;
        case 'path-heading':
          if (workspace.mode !== 'path') {
            return false;
          }
          pathModeInteraction.beginPathHeadingDrag(event, stage, hit);
          return true;
        case 'robot-heading':
          if (workspace.mode !== 'heading') {
            return false;
          }
          headingModeInteraction.beginRobotHeadingDrag(
            event,
            stage,
            workspace,
            hit,
          );
          return true;
        case 'heading-keyframe':
          if (workspace.mode !== 'heading') {
            return false;
          }
          headingModeInteraction.beginHeadingKeyframeDrag(event, stage, hit);
          return true;
        case 'heading-keyframe-heading':
          if (workspace.mode !== 'heading') {
            return false;
          }
          headingModeInteraction.beginHeadingKeyframeHeadingDrag(
            event,
            stage,
            hit,
          );
          return true;
        case 'section':
          headingModeInteraction.handleSectionInteraction(
            event,
            stage,
            workspace,
            hit,
          );
          return true;
        case 'rmin-handle':
          return rMinInteraction.beginRMinInteraction(
            event,
            stage,
            workspace,
            hit,
          );
        case 'background-image':
          panInteraction.beginBackgroundImageInteraction(
            event,
            stage,
            workspace,
          );
          return true;
        case 'canvas':
          return false;
      }
    },
    [
      headingModeInteraction,
      panInteraction,
      pathModeInteraction,
      rMinInteraction,
      setSelection,
    ],
  );

  const handleDoubleClickHit = useCallback(
    (workspace: Workspace, hit: HitTarget): boolean => {
      switch (hit.kind) {
        case 'robot-heading':
          if (workspace.mode !== 'heading') {
            return false;
          }
          headingModeInteraction.resetRobotHeadingToAuto(hit);
          return true;
        case 'rmin-handle':
          if (workspace.mode !== 'path') {
            return false;
          }
          return rMinInteraction.resetRMinToAuto(hit);
        case 'waypoint':
        case 'path-heading':
        case 'heading-keyframe':
        case 'heading-keyframe-heading':
        case 'section':
        case 'background-image':
        case 'canvas':
          return false;
      }
    },
    [headingModeInteraction, rMinInteraction],
  );

  const handleCanvasBackgroundHit = useCallback(
    (event: CanvasPointerEvent, stage: Konva.Stage, workspace: Workspace) => {
      if (
        workspace.tool === 'edit-image' &&
        workspace.backgroundImage !== null
      ) {
        panInteraction.startPan(event, stage);
        return;
      }

      if (workspace.mode === 'path') {
        pathModeInteraction.handleCanvasPointerDown(event, stage, workspace);
        return;
      }

      if (workspace.tool === 'add-point') {
        clearSelection();
        setAddPointPreview(null);
        return;
      }

      clearSelection();
      panInteraction.startPan(event, stage);
    },
    [clearSelection, setAddPointPreview, panInteraction, pathModeInteraction],
  );

  const onPointerDown = useCallback(
    (event: CanvasPointerEvent) => {
      if (event.evt.button !== 0) {
        return;
      }

      const stage = stageRef.current;
      if (stage === null) {
        return;
      }

      stage.setPointersPositions(event.evt);

      const workspace = getWorkspaceSnapshot();
      const hit = resolveStageHit({
        workspace,
        stage,
        resolvedPaths: resolvedPathsRef.current,
        discretizedByPath: discretizedByPathRef.current,
        rMinDragTargets: rMinTargetsRef.current,
      });

      if (handleInteractiveHit(event, stage, workspace, hit)) {
        return;
      }

      if (hit.kind === 'canvas') {
        handleCanvasBackgroundHit(event, stage, workspace);
      }
    },
    [
      handleCanvasBackgroundHit,
      handleDoubleClickHit,
      handleInteractiveHit,
      stageRef,
    ],
  );

  const onDoubleClick = useCallback(
    (event: CanvasDoubleClickEvent) => {
      const stage = stageRef.current;
      if (stage === null) {
        return;
      }

      stage.setPointersPositions(event.evt);

      const workspace = getWorkspaceSnapshot();
      const hit = resolveStageHit({
        workspace,
        stage,
        resolvedPaths: resolvedPathsRef.current,
        discretizedByPath: discretizedByPathRef.current,
        rMinDragTargets: rMinTargetsRef.current,
      });

      handleDoubleClickHit(workspace, hit);
    },
    [handleDoubleClickHit, stageRef],
  );

  const handleIdlePointerMove = useCallback(
    (event: CanvasPointerEvent, stage: Konva.Stage, workspace: Workspace) => {
      if (workspace.tool === 'add-point' && workspace.mode === 'path') {
        pathModeInteraction.handleIdleAddPointPreview(event, stage, workspace);
        return;
      }

      if (workspace.tool === 'add-point' && workspace.mode === 'heading') {
        const hit = resolveStageHit({
          workspace,
          stage,
          resolvedPaths: resolvedPathsRef.current,
          discretizedByPath: discretizedByPathRef.current,
          rMinDragTargets: rMinTargetsRef.current,
        });
        if (hit.kind !== 'section') {
          setAddPointPreview(null);
          setSnapGuide(EMPTY_SNAP_GUIDE);
          return;
        }

        headingModeInteraction.handleIdleAddPointPreview(stage, workspace);
        return;
      }

      setAddPointPreview(null);
      setSnapGuide(EMPTY_SNAP_GUIDE);
    },
    [
      headingModeInteraction,
      pathModeInteraction,
      rMinTargetsRef,
      resolvedPathsRef,
      discretizedByPathRef,
      setAddPointPreview,
      setSnapGuide,
    ],
  );

  const resolveMoveMachineState = useCallback(
    (
      event: CanvasPointerEvent,
      stage: Konva.Stage,
      workspace: Workspace,
    ): MachineState | null => {
      const state = machineRef.current;

      switch (state.kind) {
        case 'idle':
        case 'panning':
          return state;
        case 'pending-pan':
          return panInteraction.resolvePendingPanMoveState(state, event);
        case 'dragging-background-image':
          return panInteraction.resolveBackgroundImageMoveState(state, event);
        case 'dragging-waypoint':
          return pathModeInteraction.resolveWaypointMoveState(
            state,
            event,
            stage,
            workspace,
          );
        case 'dragging-path-heading':
          return pathModeInteraction.resolvePathHeadingMoveState(state, event);
        case 'dragging-robot-heading':
          return headingModeInteraction.resolveRobotHeadingMoveState(state);
        case 'dragging-heading-keyframe':
          return headingModeInteraction.resolveHeadingKeyframeMoveState(
            state,
            event,
          );
        case 'dragging-heading-keyframe-heading':
          return headingModeInteraction.resolveHeadingKeyframeHeadingMoveState(
            state,
            event,
          );
        case 'dragging-rmin':
          return rMinInteraction.resolveRMinMoveState(state, event);
      }
    },
    [
      headingModeInteraction,
      panInteraction,
      pathModeInteraction,
      rMinInteraction,
    ],
  );

  const handlePointerMoveState = useCallback(
    (params: {
      state: MachineState;
      event: CanvasPointerEvent;
      stage: Konva.Stage;
      workspace: Workspace;
    }) => {
      const { state, event, stage, workspace } = params;

      switch (state.kind) {
        case 'idle':
          handleIdlePointerMove(event, stage, workspace);
          return;
        case 'pending-pan':
          return;
        case 'panning':
        case 'dragging-background-image':
          panInteraction.handlePointerMove({
            state,
            event,
            workspace,
          });
          return;
        case 'dragging-waypoint':
        case 'dragging-path-heading':
          pathModeInteraction.handlePointerMove({
            state,
            event,
            stage,
            workspace,
          });
          return;
        case 'dragging-robot-heading':
        case 'dragging-heading-keyframe':
        case 'dragging-heading-keyframe-heading':
          headingModeInteraction.handlePointerMove({
            state,
            event,
            stage,
            workspace,
          });
          return;
        case 'dragging-rmin':
          rMinInteraction.handlePointerMove(state, stage, workspace);
      }
    },
    [
      handleIdlePointerMove,
      headingModeInteraction,
      panInteraction,
      pathModeInteraction,
      rMinInteraction,
    ],
  );

  const onPointerMove = useCallback(
    (event: CanvasPointerEvent) => {
      const stage = stageRef.current;
      if (stage === null) {
        return;
      }

      stage.setPointersPositions(event.evt);

      const workspace = getWorkspaceSnapshot();
      const currentState = resolveMoveMachineState(event, stage, workspace);
      if (currentState === null) {
        return;
      }

      if (currentState.kind !== 'idle') {
        setAddPointPreview(null);
      }

      handlePointerMoveState({
        state: currentState,
        event,
        stage,
        workspace,
      });
    },
    [
      handlePointerMoveState,
      resolveMoveMachineState,
      setAddPointPreview,
      stageRef,
    ],
  );

  const resetInteractionState = useCallback(() => {
    setMachineState({ kind: 'idle' });
    setSnapGuide(EMPTY_SNAP_GUIDE);
    setAddPointPreview(null);
  }, [setAddPointPreview, setMachineState, setSnapGuide]);

  const finishStationaryContinuousDrag = useCallback(
    (state: Extract<MachineState, { hasMoved: boolean }>) => {
      switch (state.kind) {
        case 'dragging-waypoint':
        case 'dragging-path-heading':
          pathModeInteraction.finishStationaryInteraction(state);
          break;
        case 'dragging-robot-heading':
        case 'dragging-heading-keyframe':
        case 'dragging-heading-keyframe-heading':
          headingModeInteraction.finishStationaryInteraction(state);
          break;
        case 'dragging-background-image':
          panInteraction.finishStationaryBackgroundImageInteraction();
          break;
        case 'dragging-rmin':
          rMinInteraction.finishStationaryInteraction(state);
          break;
      }

      resetInteractionState();
    },
    [
      headingModeInteraction,
      panInteraction,
      pathModeInteraction,
      resetInteractionState,
      rMinInteraction,
    ],
  );

  const finishMovedContinuousDrag = useCallback(
    (
      state: Extract<MachineState, { hasMoved: boolean }>,
      stage: Konva.Stage,
      workspace: Workspace,
    ) => {
      switch (state.kind) {
        case 'dragging-waypoint':
        case 'dragging-path-heading':
          pathModeInteraction.finishMovedInteraction(state);
          break;
        case 'dragging-robot-heading':
        case 'dragging-heading-keyframe':
        case 'dragging-heading-keyframe-heading':
          headingModeInteraction.finishMovedInteraction(state);
          break;
        case 'dragging-rmin':
          rMinInteraction.finalizeMovedInteraction(state, stage, workspace);
          break;
        case 'dragging-background-image':
          break;
      }

      if (isContinuousDomainDragState(state)) {
        setSnapGuide(EMPTY_SNAP_GUIDE);
      }

      setMachineState({ kind: 'idle' });
      setAddPointPreview(null);
    },
    [
      setAddPointPreview,
      setMachineState,
      setSnapGuide,
      headingModeInteraction,
      pathModeInteraction,
      rMinInteraction,
    ],
  );

  const finishInteractionByPointerId = useCallback(
    (pointerId: number) => {
      releaseStagePointer(pointerId);

      const state = machineRef.current;
      const workspace = getWorkspaceSnapshot();
      const stage = stageRef.current;

      if (state.kind === 'pending-pan') {
        resetInteractionState();
        return;
      }

      if (isContinuousDragState(state) && stage !== null) {
        if (!state.hasMoved) {
          finishStationaryContinuousDrag(state);
          return;
        }

        finishMovedContinuousDrag(state, stage, workspace);
        return;
      }

      resetInteractionState();
    },
    [
      finishMovedContinuousDrag,
      finishStationaryContinuousDrag,
      releaseStagePointer,
      resetInteractionState,
      stageRef,
    ],
  );

  const finishInteraction = useCallback(
    (event: CanvasPointerEvent) => {
      finishInteractionByPointerId(event.evt.pointerId);
    },
    [finishInteractionByPointerId],
  );

  const onPointerLeave = finishInteraction;

  const onLostPointerCapture = useCallback(
    (event: CanvasPointerEvent) => {
      finishInteractionByPointerId(event.evt.pointerId);
    },
    [finishInteractionByPointerId],
  );

  const cursorClass = (() => {
    const state = machineRef.current;
    switch (state.kind) {
      case 'idle':
      case 'pending-pan': {
        const workspace = getWorkspaceSnapshot();
        if (workspace.tool === 'add-point') {
          if (workspace.mode === 'heading') {
            return addPointPreview === null ? 'not-allowed' : 'crosshair';
          }
          return 'crosshair'; // For path mode
        }
        return '';
      }
      case 'panning':
      case 'dragging-background-image':
      case 'dragging-waypoint':
      case 'dragging-path-heading':
      case 'dragging-robot-heading':
      case 'dragging-heading-keyframe':
      case 'dragging-heading-keyframe-heading':
      case 'dragging-rmin':
        return 'grabbing';
      default:
        return '';
    }
  })();

  const draggingWaypointId = (() => {
    const state = machineRef.current;
    if (
      (state.kind === 'dragging-waypoint' ||
        state.kind === 'dragging-path-heading') &&
      state.hasMoved
    ) {
      return state.waypointId;
    }

    return null;
  })();

  const draggingPathId = (() => {
    const state = machineRef.current;
    if (
      (state.kind === 'dragging-waypoint' ||
        state.kind === 'dragging-path-heading') &&
      state.hasMoved
    ) {
      return state.pathId;
    }

    return null;
  })();

  return {
    onDoubleClick,
    onPointerDown,
    onPointerMove,
    onPointerUp: finishInteraction,
    onPointerLeave,
    onPointerCancel: finishInteraction,
    onLostPointerCapture,
    cursorClass,
    draggingWaypointId,
    draggingPathId,
    isRobotAnimationSuppressed,
  };
};
