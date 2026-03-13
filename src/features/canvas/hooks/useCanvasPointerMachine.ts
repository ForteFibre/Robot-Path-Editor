import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore } from '../../../store/workspaceStore';
import { selectCanvasInteractionSnapshot } from '../../../store/workspaceSelectors';
import { buildPointerSnapshot } from './pointerMachine/buildPointerSnapshot';
import { reducePointerMachine } from './pointerMachine/reducer/index';
import { useCanvasEventBridge } from './pointerMachine/useCanvasEventBridge';
import { useCanvasEditActions } from './useCanvasEditActions';
import type {
  CanvasPointerHandlers,
  MachineState,
  PointerMachineEvent,
  PointerMachineEventHandlers,
  PointerSnapshot,
  UseCanvasPointerMachineParams,
} from './pointerMachine/types';
import { getMachineStateMetadata } from './pointerMachine/types';
import { usePointerEffectExecutor } from './pointerMachine/usePointerEffectExecutor';

export type { AddPointPreviewState } from './pointerMachine/types';

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
  notify,
  addPointPreview,
}: UseCanvasPointerMachineParams): CanvasPointerHandlers => {
  const { pause, resume, setDragging } = useCanvasEditActions();
  const canvasInteractionSnapshot = useWorkspaceStore(
    useShallow(selectCanvasInteractionSnapshot),
  );

  const machineRef = useRef<MachineState>({ kind: 'idle' });
  const [, forceMachineRender] = useReducer((count: number) => count + 1, 0);
  const [isRobotAnimationSuppressed, setIsRobotAnimationSuppressed] =
    useState(false);
  const snapshotRef = useRef(canvasInteractionSnapshot);
  snapshotRef.current = canvasInteractionSnapshot;
  useEffect(() => {
    snapshotRef.current = canvasInteractionSnapshot;
  }, [canvasInteractionSnapshot]);
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
  const getWorkspaceSnapshot = useCallback(() => snapshotRef.current, []);
  const executeEffect = usePointerEffectExecutor({
    interactionSurfaceRef,
    setSnapGuide,
    setAddPointPreview,
    notify,
    getWorkspace: getWorkspaceSnapshot,
  });

  const createSnapshotFromEvent = useCallback(
    (event: PointerEvent | MouseEvent): PointerSnapshot => {
      return buildPointerSnapshot({
        event,
        stage: stageRef.current,
        workspace: snapshotRef.current,
        waypointPoints: waypointPointsRef.current,
        resolvedPaths: resolvedPathsRef.current,
        discretizedByPath: discretizedByPathRef.current,
        snapSettings: snapSettingsRef.current,
        rMinDragTargets: rMinTargetsRef.current,
      });
    },
    [stageRef],
  );

  const dispatchMachineEvent = useCallback(
    (event: PointerMachineEvent, snapshot: PointerSnapshot): void => {
      const previousState = machineRef.current;
      const previousMeta = getMachineStateMetadata(previousState);
      const transition = reducePointerMachine(previousState, event, snapshot);
      const nextState = transition.nextState;
      const nextMeta = getMachineStateMetadata(nextState);

      machineRef.current = nextState;
      setIsRobotAnimationSuppressed(nextMeta.suppressesRobotAnimation);
      forceMachineRender();

      if (
        previousMeta.isDraggingInteraction !== nextMeta.isDraggingInteraction
      ) {
        setDragging(nextMeta.isDraggingInteraction);
      }

      if (
        !previousMeta.isContinuousDomainDrag &&
        nextMeta.isContinuousDomainDrag
      ) {
        pause();
      }

      try {
        for (const effect of transition.effects) {
          executeEffect(effect);
        }
      } finally {
        if (
          previousMeta.isContinuousDomainDrag &&
          !nextMeta.isContinuousDomainDrag
        ) {
          resume();
        }
      }
    },
    [executeEffect, pause, resume, setDragging],
  );

  const finishInteraction = useCallback(
    (
      event: { evt: PointerEvent },
      reason:
        | 'pointer-up'
        | 'pointer-leave'
        | 'pointer-cancel'
        | 'lost-pointer-capture',
    ) => {
      dispatchMachineEvent(
        { type: 'pointer-finish', reason },
        createSnapshotFromEvent(event.evt),
      );
    },
    [createSnapshotFromEvent, dispatchMachineEvent],
  );

  const machineHandlers: PointerMachineEventHandlers = {
    onPointerDown: useCallback(
      (event) => {
        if (event.evt.button !== 0) {
          return;
        }

        if (stageRef.current === null) {
          return;
        }

        event.evt.preventDefault();
        dispatchMachineEvent(
          { type: 'pointer-down' },
          createSnapshotFromEvent(event.evt),
        );
      },
      [createSnapshotFromEvent, dispatchMachineEvent, stageRef],
    ),

    onDoubleClick: useCallback(
      (event) => {
        dispatchMachineEvent(
          { type: 'double-click' },
          createSnapshotFromEvent(event.evt),
        );
      },
      [createSnapshotFromEvent, dispatchMachineEvent],
    ),

    onPointerMove: useCallback(
      (event) => {
        dispatchMachineEvent(
          { type: 'pointer-move' },
          createSnapshotFromEvent(event.evt),
        );
      },
      [createSnapshotFromEvent, dispatchMachineEvent],
    ),

    onPointerUp: useCallback(
      (event) => {
        finishInteraction(event, 'pointer-up');
      },
      [finishInteraction],
    ),

    onPointerLeave: useCallback(
      (event) => {
        finishInteraction(event, 'pointer-leave');
      },
      [finishInteraction],
    ),

    onPointerCancel: useCallback(
      (event) => {
        finishInteraction(event, 'pointer-cancel');
      },
      [finishInteraction],
    ),

    onLostPointerCapture: useCallback(
      (event) => {
        finishInteraction(event, 'lost-pointer-capture');
      },
      [finishInteraction],
    ),
  };

  const eventBridgeHandlers = useCanvasEventBridge({
    stageRef,
    interactionSurfaceRef,
    machineHandlers,
  });

  const currentWorkspace = snapshotRef.current;
  const currentMachineState = machineRef.current;
  const cursorClass = (() => {
    const state = currentMachineState;
    if (state.kind === 'idle' || state.kind === 'pending-pan') {
      if (currentWorkspace.tool === 'add-point') {
        if (currentWorkspace.mode === 'heading') {
          return addPointPreview === null ? 'not-allowed' : 'crosshair';
        }

        return 'crosshair';
      }

      return '';
    }

    return getMachineStateMetadata(state).cursorClass;
  })();

  const draggingWaypointId = (() => {
    const state = currentMachineState;
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
    const state = currentMachineState;
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
    ...eventBridgeHandlers,
    cursorClass,
    draggingWaypointId,
    draggingPathId,
    isRobotAnimationSuppressed,
  };
};
