import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore } from '../../../store/workspaceStore';
import { selectCanvasInteractionSnapshot } from '../../../store/workspaceSelectors';
import type { CanvasInteractionSnapshot } from '../../../store/types';
import { applyCanvasDragPreview } from '../canvasDragPreview';
import { buildPointerSnapshot } from './pointerMachine/buildPointerSnapshot';
import { reducePointerMachine } from './pointerMachine/reducer/index';
import { useCanvasEventBridge } from './pointerMachine/useCanvasEventBridge';
import { useCanvasEditActions } from './useCanvasEditActions';
import type { CanvasDragPreview } from '../canvasDragPreview';
import type {
  AddPointPreviewState,
  CanvasPointerHandlers,
  MachineState,
  MachineStateMetadata,
  PointerMachineEvent,
  PointerMachineEventHandlers,
  PointerSnapshot,
  UseCanvasPointerMachineParams,
} from './pointerMachine/types';
import { getMachineStateMetadata } from './pointerMachine/types';
import { usePointerEffectExecutor } from './pointerMachine/usePointerEffectExecutor';

export type { AddPointPreviewState } from './pointerMachine/types';

type MachineRenderState = {
  cursorClass: string;
  draggingWaypointId: string | null;
  draggingPathId: string | null;
  isRobotAnimationSuppressed: boolean;
};

const resolveDraggingWaypointId = (state: MachineState): string | null => {
  if (
    (state.kind === 'dragging-waypoint' ||
      state.kind === 'dragging-path-heading') &&
    state.hasMoved
  ) {
    return state.waypointId;
  }

  return null;
};

const resolveDraggingPathId = (state: MachineState): string | null => {
  if (
    (state.kind === 'dragging-waypoint' ||
      state.kind === 'dragging-path-heading') &&
    state.hasMoved
  ) {
    return state.pathId;
  }

  return null;
};

const resolveCursorClass = (params: {
  state: MachineState;
  workspace: CanvasInteractionSnapshot;
  addPointPreview: AddPointPreviewState | null;
  metadata?: MachineStateMetadata;
}): string => {
  const { state, workspace, addPointPreview } = params;
  const metadata = params.metadata ?? getMachineStateMetadata(state);

  if (state.kind === 'idle' || state.kind === 'pending-pan') {
    if (workspace.tool === 'add-point') {
      if (workspace.mode === 'heading') {
        return addPointPreview === null ? 'not-allowed' : 'crosshair';
      }

      return 'crosshair';
    }

    return '';
  }

  return metadata.cursorClass;
};

const getMachineRenderState = (params: {
  state: MachineState;
  workspace: CanvasInteractionSnapshot;
  addPointPreview: AddPointPreviewState | null;
  metadata?: MachineStateMetadata;
}): MachineRenderState => {
  const { state, workspace, addPointPreview } = params;
  const metadata = params.metadata ?? getMachineStateMetadata(state);

  return {
    cursorClass: resolveCursorClass({
      state,
      workspace,
      addPointPreview,
      metadata,
    }),
    draggingWaypointId: resolveDraggingWaypointId(state),
    draggingPathId: resolveDraggingPathId(state),
    isRobotAnimationSuppressed: metadata.suppressesRobotAnimation,
  };
};

const hasMachineRenderStateChanged = (
  previousState: MachineRenderState,
  nextState: MachineRenderState,
): boolean => {
  return (
    previousState.cursorClass !== nextState.cursorClass ||
    previousState.draggingWaypointId !== nextState.draggingWaypointId ||
    previousState.draggingPathId !== nextState.draggingPathId ||
    previousState.isRobotAnimationSuppressed !==
      nextState.isRobotAnimationSuppressed
  );
};

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
  setDragPreview,
  notify,
  addPointPreview,
  dragPreview,
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
  const previewRef = useRef<CanvasDragPreview | null>(dragPreview);
  previewRef.current = dragPreview;
  const resolvePreviewWorkspace = useCallback(
    (workspace: CanvasInteractionSnapshot): CanvasInteractionSnapshot => {
      const preview = previewRef.current;

      if (preview === null) {
        return workspace;
      }

      const previewWorkspace = applyCanvasDragPreview({
        preview,
        paths: workspace.paths,
        points: workspace.points,
        lockedPointIds: workspace.lockedPointIds,
        activePathId: workspace.activePathId,
        backgroundImage: workspace.backgroundImage,
      });

      return {
        ...workspace,
        paths: previewWorkspace.paths,
        points: previewWorkspace.points,
        backgroundImage: previewWorkspace.backgroundImage,
      };
    },
    [],
  );
  const handleSetDragPreview = useCallback(
    (preview: CanvasDragPreview | null) => {
      previewRef.current = preview;
      setDragPreview(preview);
    },
    [setDragPreview],
  );
  const getWorkspaceSnapshot = useCallback(
    () => resolvePreviewWorkspace(snapshotRef.current),
    [resolvePreviewWorkspace],
  );
  const executeEffect = usePointerEffectExecutor({
    interactionSurfaceRef,
    setSnapGuide,
    setAddPointPreview,
    setDragPreview: handleSetDragPreview,
    notify,
    getWorkspace: getWorkspaceSnapshot,
  });

  const createSnapshotFromEvent = useCallback(
    (
      event: PointerEvent | MouseEvent,
      options: {
        hitTest: boolean;
        workspace?: CanvasInteractionSnapshot;
      } = { hitTest: true },
    ): PointerSnapshot => {
      return buildPointerSnapshot({
        event,
        stage: stageRef.current,
        workspace: resolvePreviewWorkspace(
          options.workspace ?? snapshotRef.current,
        ),
        waypointPoints: waypointPointsRef.current,
        resolvedPaths: resolvedPathsRef.current,
        discretizedByPath: discretizedByPathRef.current,
        snapSettings: snapSettingsRef.current,
        rMinDragTargets: rMinTargetsRef.current,
        hitTest: options.hitTest,
      });
    },
    [resolvePreviewWorkspace, stageRef],
  );

  const dispatchMachineEvent = useCallback(
    (
      event: PointerMachineEvent,
      snapshot: PointerSnapshot,
      workspaceOverride?: CanvasInteractionSnapshot,
    ): void => {
      const previousState = machineRef.current;
      const previousWorkspace = workspaceOverride ?? snapshot.workspace;
      const previousMeta = getMachineStateMetadata(previousState);
      const previousRenderState = getMachineRenderState({
        state: previousState,
        workspace: previousWorkspace,
        addPointPreview,
        metadata: previousMeta,
      });
      const transition = reducePointerMachine(previousState, event, snapshot);
      const nextState = transition.nextState;
      const nextMeta = getMachineStateMetadata(nextState);
      const nextRenderState = getMachineRenderState({
        state: nextState,
        workspace: previousWorkspace,
        addPointPreview,
        metadata: nextMeta,
      });

      machineRef.current = nextState;

      if (hasMachineRenderStateChanged(previousRenderState, nextRenderState)) {
        setIsRobotAnimationSuppressed(
          nextRenderState.isRobotAnimationSuppressed,
        );
        forceMachineRender();
      }

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
    [addPointPreview, executeEffect, pause, resume, setDragging],
  );

  const finishInteraction = useCallback(
    (
      event: { evt: PointerEvent },
      reason:
        | 'pointer-up'
        | 'pointer-leave'
        | 'pointer-cancel'
        | 'lost-pointer-capture',
      workspace?: CanvasInteractionSnapshot,
    ) => {
      const snapshotOptions =
        workspace === undefined
          ? { hitTest: false }
          : { hitTest: false, workspace };

      dispatchMachineEvent(
        { type: 'pointer-finish', reason },
        createSnapshotFromEvent(event.evt, snapshotOptions),
        workspace,
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
        const state = machineRef.current;
        const workspace = snapshotRef.current;

        if (state.kind === 'idle' && workspace.tool !== 'add-point') {
          return;
        }

        dispatchMachineEvent(
          { type: 'pointer-move' },
          createSnapshotFromEvent(event.evt, {
            hitTest: state.kind === 'idle',
          }),
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
  const renderState = getMachineRenderState({
    state: currentMachineState,
    workspace: resolvePreviewWorkspace(currentWorkspace),
    addPointPreview,
  });

  return {
    ...eventBridgeHandlers,
    cursorClass: renderState.cursorClass,
    draggingWaypointId: renderState.draggingWaypointId,
    draggingPathId: renderState.draggingPathId,
    isRobotAnimationSuppressed,
  };
};
