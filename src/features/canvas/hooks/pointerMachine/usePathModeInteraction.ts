import type Konva from 'konva';
import { useCallback } from 'react';
import {
  EMPTY_SNAP_GUIDE,
  type Point,
  type SnapGuide,
} from '../../../../domain/geometry';
import { type Workspace } from '../../../../domain/models';
import { getPointerWorldFromStage, type HitTarget } from '../canvasHitTesting';
import { useWorkspaceActions } from '../../../../store/workspaceStore';
import {
  findResolvedWaypointContext,
  findWaypointWithPoint,
  hasCrossedDragThreshold,
  isWaypointCoordinateLocked,
  resolveContinuousDragStateOnMove,
  resolveHeadingWithModifiers,
  resolvePathAddPointPreview,
  resolvePointWithModifiers,
  SNAP_THRESHOLD,
} from './helpers';
import type {
  AddPointPreviewState,
  CanvasPointerEvent,
  CaptureStagePointer,
  DraggingPathHeadingState,
  DraggingWaypointState,
  PointerMachineRefs,
  SetMachineState,
} from './types';

type UsePathModeInteractionParams = {
  refs: PointerMachineRefs;
  setMachineState: SetMachineState;
  setSnapGuide: (guide: SnapGuide) => void;
  setAddPointPreview: (preview: AddPointPreviewState | null) => void;
  captureStagePointer: CaptureStagePointer;
  startPan: (event: CanvasPointerEvent, stage: Konva.Stage) => void;
};

const LOCKED_WAYPOINT_ALERT =
  'このポイントはロックされています。移動させるにはロックを解除してください。';

export const usePathModeInteraction = ({
  refs,
  setMachineState,
  setSnapGuide,
  setAddPointPreview,
  captureStagePointer,
  startPan,
}: UsePathModeInteractionParams) => {
  const {
    clearSelection,
    insertLibraryWaypoint,
    pause,
    resume,
    setSelection,
    setTool,
    updateWaypoint,
  } = useWorkspaceActions();

  const getSnapCandidates = useCallback(
    (excludeId?: string): Point[] => {
      return refs.waypointPointsRef.current
        .filter((point) => point.id !== excludeId)
        .map((point) => ({ x: point.x, y: point.y }));
    },
    [refs.waypointPointsRef],
  );

  const beginWaypointDrag = useCallback(
    (
      event: CanvasPointerEvent,
      stage: Konva.Stage,
      hit: Extract<HitTarget, { kind: 'waypoint' }>,
    ): void => {
      setMachineState({
        kind: 'dragging-waypoint',
        pathId: hit.pathId,
        waypointId: hit.waypointId,
        startScreenX: event.evt.clientX,
        startScreenY: event.evt.clientY,
        hasMoved: false,
      });
      captureStagePointer(stage, event);
    },
    [captureStagePointer, setMachineState],
  );

  const beginPathHeadingDrag = useCallback(
    (
      event: CanvasPointerEvent,
      stage: Konva.Stage,
      hit: Extract<HitTarget, { kind: 'path-heading' }>,
    ): void => {
      setMachineState({
        kind: 'dragging-path-heading',
        pathId: hit.pathId,
        waypointId: hit.waypointId,
        startScreenX: event.evt.clientX,
        startScreenY: event.evt.clientY,
        hasMoved: false,
        origin: 'existing',
      });
      captureStagePointer(stage, event);
    },
    [captureStagePointer, setMachineState],
  );

  const handleCanvasPointerDown = useCallback(
    (
      event: CanvasPointerEvent,
      stage: Konva.Stage,
      workspace: Workspace,
    ): void => {
      if (workspace.tool !== 'add-point') {
        clearSelection();
        startPan(event, stage);
        return;
      }

      const activePath = workspace.paths.find(
        (path) => path.id === workspace.activePathId,
      );
      if (activePath === undefined) {
        clearSelection();
        startPan(event, stage);
        return;
      }

      const world = getPointerWorldFromStage(stage, workspace.canvasTransform);
      if (world === null) {
        return;
      }

      const preview = resolvePathAddPointPreview({
        workspace,
        resolvedPaths: refs.resolvedPathsRef.current,
        candidates: refs.waypointPointsRef.current.map((candidate) => ({
          x: candidate.x,
          y: candidate.y,
        })),
        source: world,
        settings: refs.snapSettingsRef.current,
        threshold: SNAP_THRESHOLD / workspace.canvasTransform.k,
        shiftKey: event.evt.shiftKey,
        altKey: event.evt.altKey,
      });

      if (preview.preview?.kind !== 'path-waypoint') {
        setSnapGuide(EMPTY_SNAP_GUIDE);
        setAddPointPreview(null);
        return;
      }

      setSnapGuide(preview.guide);
      pause();
      const insertedWaypointId = insertLibraryWaypoint({
        pathId: activePath.id,
        x: preview.preview.point.x,
        y: preview.preview.point.y,
        linkToLibrary: false,
        afterWaypointId:
          workspace.selection.pathId === activePath.id
            ? (workspace.selection.waypointId ?? undefined)
            : undefined,
      });
      if (insertedWaypointId === null) {
        resume();
        setAddPointPreview(null);
        return;
      }

      setMachineState({
        kind: 'dragging-path-heading',
        pathId: activePath.id,
        waypointId: insertedWaypointId,
        startScreenX: event.evt.clientX,
        startScreenY: event.evt.clientY,
        hasMoved: false,
        origin: 'add-point',
      });
      setAddPointPreview(null);
      captureStagePointer(stage, event);
    },
    [
      captureStagePointer,
      clearSelection,
      insertLibraryWaypoint,
      pause,
      refs.resolvedPathsRef,
      refs.snapSettingsRef,
      refs.waypointPointsRef,
      resume,
      setAddPointPreview,
      setMachineState,
      setSnapGuide,
      startPan,
    ],
  );

  const handleIdleAddPointPreview = useCallback(
    (
      event: CanvasPointerEvent,
      stage: Konva.Stage,
      workspace: Workspace,
    ): void => {
      const world = getPointerWorldFromStage(stage, workspace.canvasTransform);
      if (world === null) {
        return;
      }

      const preview = resolvePathAddPointPreview({
        workspace,
        resolvedPaths: refs.resolvedPathsRef.current,
        candidates: refs.waypointPointsRef.current.map((candidate) => ({
          x: candidate.x,
          y: candidate.y,
        })),
        source: world,
        settings: refs.snapSettingsRef.current,
        threshold: SNAP_THRESHOLD / workspace.canvasTransform.k,
        shiftKey: event.evt.shiftKey,
        altKey: event.evt.altKey,
      });

      setAddPointPreview(preview.preview);
      setSnapGuide(preview.guide);
    },
    [
      refs.resolvedPathsRef,
      refs.snapSettingsRef,
      refs.waypointPointsRef,
      setAddPointPreview,
      setSnapGuide,
    ],
  );

  const resolveWaypointMoveState = useCallback(
    (
      state: DraggingWaypointState,
      event: CanvasPointerEvent,
      stage: Konva.Stage,
      workspace: Workspace,
    ): DraggingWaypointState | null => {
      if (
        isWaypointCoordinateLocked(workspace, state.pathId, state.waypointId) &&
        hasCrossedDragThreshold({
          startScreenX: state.startScreenX,
          startScreenY: state.startScreenY,
          event,
        })
      ) {
        globalThis.alert(LOCKED_WAYPOINT_ALERT);
        setMachineState({ kind: 'idle' });
        try {
          stage.container().releasePointerCapture(event.evt.pointerId);
        } catch {
          // Pointer capture may not exist
        }
        return null;
      }

      return resolveContinuousDragStateOnMove({
        state,
        event,
        setMachineState,
      });
    },
    [setMachineState],
  );

  const resolvePathHeadingMoveState = useCallback(
    (
      state: DraggingPathHeadingState,
      event: CanvasPointerEvent,
    ): DraggingPathHeadingState | null => {
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
      state: DraggingWaypointState | DraggingPathHeadingState;
      event: CanvasPointerEvent;
      stage: Konva.Stage;
      workspace: Workspace;
    }) => {
      const { state, event, stage, workspace } = params;
      const world = getPointerWorldFromStage(stage, workspace.canvasTransform);
      if (world === null) {
        return;
      }

      if (state.kind === 'dragging-waypoint') {
        const context = findResolvedWaypointContext(
          refs.resolvedPathsRef.current,
          state.pathId,
          state.waypointId,
        );
        const snapped = resolvePointWithModifiers({
          source: world,
          candidates: getSnapCandidates(state.waypointId),
          previousPoint: context.previousPoint,
          previousHeadingDeg: context.previousHeadingDeg,
          previousSegmentStart: context.previousSegmentStart,
          settings: refs.snapSettingsRef.current,
          threshold: SNAP_THRESHOLD / workspace.canvasTransform.k,
          shiftKey: event.evt.shiftKey,
          altKey: event.evt.altKey,
        });
        setSnapGuide(snapped.guide);
        updateWaypoint(state.pathId, state.waypointId, {
          x: snapped.point.x,
          y: snapped.point.y,
        });
        return;
      }

      const resolved = findWaypointWithPoint(
        workspace,
        state.pathId,
        state.waypointId,
      );
      if (resolved === null) {
        return;
      }

      const context = findResolvedWaypointContext(
        refs.resolvedPathsRef.current,
        state.pathId,
        state.waypointId,
      );
      const heading = resolveHeadingWithModifiers({
        origin: { x: resolved.point.x, y: resolved.point.y },
        target: world,
        previousHeadingDeg: context.previousHeadingDeg,
        previousPoint: context.previousPoint,
        previousSegmentStart: context.previousSegmentStart,
        settings: refs.snapSettingsRef.current,
        shiftKey: event.evt.shiftKey,
        altKey: event.evt.altKey,
      });
      setSnapGuide(heading.guide);
      updateWaypoint(state.pathId, state.waypointId, {
        pathHeading: heading.angle,
      });
    },
    [
      getSnapCandidates,
      refs.resolvedPathsRef,
      refs.snapSettingsRef,
      setSnapGuide,
      updateWaypoint,
    ],
  );

  const finishStationaryInteraction = useCallback(
    (state: DraggingWaypointState | DraggingPathHeadingState): void => {
      setSelection({
        pathId: state.pathId,
        waypointId: state.waypointId,
        headingKeyframeId: null,
        sectionIndex: null,
      });
      if (
        state.kind === 'dragging-path-heading' &&
        state.origin === 'add-point'
      ) {
        setTool('select');
      }
    },
    [setSelection, setTool],
  );

  const finishMovedInteraction = useCallback(
    (state: DraggingWaypointState | DraggingPathHeadingState): void => {
      if (
        state.kind === 'dragging-path-heading' &&
        state.origin === 'add-point'
      ) {
        setTool('select');
      }
    },
    [setTool],
  );

  return {
    beginWaypointDrag,
    beginPathHeadingDrag,
    handleCanvasPointerDown,
    handleIdleAddPointPreview,
    resolveWaypointMoveState,
    resolvePathHeadingMoveState,
    handlePointerMove,
    finishStationaryInteraction,
    finishMovedInteraction,
  };
};
