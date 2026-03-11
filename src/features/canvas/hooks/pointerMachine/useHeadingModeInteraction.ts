import type Konva from 'konva';
import { useCallback } from 'react';
import { EMPTY_SNAP_GUIDE, type SnapGuide } from '../../../../domain/geometry';
import {
  getPreviousHeadingKeyframe,
  projectPointToPathSections,
  resolveDiscretizedHeadingKeyframes,
} from '../../../../domain/headingKeyframes';
import { type Workspace } from '../../../../domain/models';
import { getPointerWorldFromStage, type HitTarget } from '../canvasHitTesting';
import { useWorkspaceActions } from '../../../../store/workspaceStore';
import {
  findResolvedWaypointContext,
  findWaypointWithPoint,
  resolveContinuousDragStateOnMove,
  resolveHeadingKeyframeAnchor,
  resolveHeadingKeyframePreview,
  resolveHeadingWithModifiers,
} from './helpers';
import type {
  AddPointPreviewState,
  CanvasPointerEvent,
  CaptureStagePointer,
  DraggingHeadingKeyframeHeadingState,
  DraggingHeadingKeyframeState,
  DraggingRobotHeadingState,
  PointerMachineRefs,
  SetMachineState,
} from './types';

type UseHeadingModeInteractionParams = {
  refs: PointerMachineRefs;
  setMachineState: SetMachineState;
  setSnapGuide: (guide: SnapGuide) => void;
  setAddPointPreview: (preview: AddPointPreviewState | null) => void;
  captureStagePointer: CaptureStagePointer;
};

type HeadingInteractionDragState =
  | DraggingRobotHeadingState
  | DraggingHeadingKeyframeState
  | DraggingHeadingKeyframeHeadingState;

export const useHeadingModeInteraction = ({
  refs,
  setMachineState,
  setSnapGuide,
  setAddPointPreview,
  captureStagePointer,
}: UseHeadingModeInteractionParams) => {
  const {
    createHeadingKeyframe,
    pause,
    resume,
    setSelection,
    setTool,
    updateHeadingKeyframe,
    updateWaypoint,
  } = useWorkspaceActions();

  const resetRobotHeadingToAuto = useCallback(
    (hit: Extract<HitTarget, { kind: 'robot-heading' }>): void => {
      updateWaypoint(hit.pathId, hit.waypointId, {
        robotHeading: null,
      });
      setSelection({
        pathId: hit.pathId,
        waypointId: hit.waypointId,
        headingKeyframeId: null,
        sectionIndex: null,
      });
    },
    [setSelection, updateWaypoint],
  );

  const beginRobotHeadingDrag = useCallback(
    (
      event: CanvasPointerEvent,
      stage: Konva.Stage,
      workspace: Workspace,
      hit: Extract<HitTarget, { kind: 'robot-heading' }>,
    ): void => {
      const resolved = findWaypointWithPoint(
        workspace,
        hit.pathId,
        hit.waypointId,
      );
      if (resolved === null) {
        return;
      }

      setMachineState({
        kind: 'dragging-robot-heading',
        pathId: hit.pathId,
        waypointId: hit.waypointId,
        anchor: { x: resolved.point.x, y: resolved.point.y },
        startScreenX: event.evt.clientX,
        startScreenY: event.evt.clientY,
        hasMoved: false,
      });
      captureStagePointer(stage, event);
    },
    [captureStagePointer, setMachineState],
  );

  const beginHeadingKeyframeDrag = useCallback(
    (
      event: CanvasPointerEvent,
      stage: Konva.Stage,
      hit: Extract<HitTarget, { kind: 'heading-keyframe' }>,
    ): void => {
      setMachineState({
        kind: 'dragging-heading-keyframe',
        pathId: hit.pathId,
        headingKeyframeId: hit.headingKeyframeId,
        startScreenX: event.evt.clientX,
        startScreenY: event.evt.clientY,
        hasMoved: false,
      });
      captureStagePointer(stage, event);
    },
    [captureStagePointer, setMachineState],
  );

  const beginHeadingKeyframeHeadingDrag = useCallback(
    (
      event: CanvasPointerEvent,
      stage: Konva.Stage,
      hit: Extract<HitTarget, { kind: 'heading-keyframe-heading' }>,
    ): void => {
      const anchor = resolveHeadingKeyframeAnchor(
        refs.resolvedPathsRef.current,
        refs.discretizedByPathRef.current,
        hit.pathId,
        hit.headingKeyframeId,
      );
      if (anchor === null) {
        return;
      }

      setMachineState({
        kind: 'dragging-heading-keyframe-heading',
        pathId: hit.pathId,
        headingKeyframeId: hit.headingKeyframeId,
        anchor,
        startScreenX: event.evt.clientX,
        startScreenY: event.evt.clientY,
        hasMoved: false,
        origin: 'existing',
      });
      captureStagePointer(stage, event);
    },
    [
      captureStagePointer,
      refs.discretizedByPathRef,
      refs.resolvedPathsRef,
      setMachineState,
    ],
  );

  const handleSectionInteraction = useCallback(
    (
      event: CanvasPointerEvent,
      stage: Konva.Stage,
      workspace: Workspace,
      hit: Extract<HitTarget, { kind: 'section' }>,
    ): void => {
      if (workspace.mode === 'path') {
        setSelection({
          pathId: hit.pathId,
          waypointId: null,
          headingKeyframeId: null,
          sectionIndex: hit.sectionIndex,
        });
        return;
      }

      if (workspace.tool !== 'add-point') {
        return;
      }

      const world = getPointerWorldFromStage(stage, workspace.canvasTransform);
      if (world === null) {
        return;
      }

      const preview = resolveHeadingKeyframePreview({
        workspace,
        resolvedPaths: refs.resolvedPathsRef.current,
        discretizedByPath: refs.discretizedByPathRef.current,
        source: world,
      });
      if (preview?.kind !== 'heading-keyframe') {
        return;
      }

      pause();
      const headingKeyframeId = createHeadingKeyframe({
        pathId: workspace.activePathId,
        sectionIndex: preview.sectionIndex,
        sectionRatio: preview.sectionRatio,
        robotHeading: preview.robotHeading,
      });
      if (headingKeyframeId === null) {
        resume();
        setAddPointPreview(null);
        return;
      }

      setMachineState({
        kind: 'dragging-heading-keyframe-heading',
        pathId: workspace.activePathId,
        headingKeyframeId,
        anchor: preview.point,
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
      createHeadingKeyframe,
      pause,
      refs.discretizedByPathRef,
      refs.resolvedPathsRef,
      resume,
      setAddPointPreview,
      setMachineState,
      setSelection,
    ],
  );

  const handleIdleAddPointPreview = useCallback(
    (stage: Konva.Stage, workspace: Workspace): void => {
      const world = getPointerWorldFromStage(stage, workspace.canvasTransform);
      if (world === null) {
        return;
      }

      setAddPointPreview(
        resolveHeadingKeyframePreview({
          workspace,
          resolvedPaths: refs.resolvedPathsRef.current,
          discretizedByPath: refs.discretizedByPathRef.current,
          source: world,
        }),
      );
      setSnapGuide(EMPTY_SNAP_GUIDE);
    },
    [
      refs.discretizedByPathRef,
      refs.resolvedPathsRef,
      setAddPointPreview,
      setSnapGuide,
    ],
  );

  const resolveRobotHeadingMoveState = useCallback(
    (state: DraggingRobotHeadingState): DraggingRobotHeadingState => {
      return state;
    },
    [],
  );

  const resolveHeadingKeyframeMoveState = useCallback(
    (
      state: DraggingHeadingKeyframeState,
      event: CanvasPointerEvent,
    ): DraggingHeadingKeyframeState | null => {
      return resolveContinuousDragStateOnMove({
        state,
        event,
        setMachineState,
      });
    },
    [setMachineState],
  );

  const resolveHeadingKeyframeHeadingMoveState = useCallback(
    (
      state: DraggingHeadingKeyframeHeadingState,
      event: CanvasPointerEvent,
    ): DraggingHeadingKeyframeHeadingState | null => {
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
      state: HeadingInteractionDragState;
      event: CanvasPointerEvent;
      stage: Konva.Stage;
      workspace: Workspace;
    }) => {
      const { state, event, stage, workspace } = params;
      const world = getPointerWorldFromStage(stage, workspace.canvasTransform);
      if (world === null) {
        return;
      }

      if (state.kind === 'dragging-robot-heading') {
        const context = findResolvedWaypointContext(
          refs.resolvedPathsRef.current,
          state.pathId,
          state.waypointId,
        );
        const heading = resolveHeadingWithModifiers({
          origin: state.anchor,
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
          robotHeading: heading.angle,
        });
        return;
      }

      if (state.kind === 'dragging-heading-keyframe') {
        const path = refs.resolvedPathsRef.current.find(
          (candidate) => candidate.id === state.pathId,
        );
        const detail = refs.discretizedByPathRef.current.get(state.pathId);
        if (path === undefined || detail === undefined) {
          return;
        }

        const projected = projectPointToPathSections(detail, world);
        if (projected === null) {
          return;
        }

        updateHeadingKeyframe(state.pathId, state.headingKeyframeId, {
          sectionIndex: projected.sectionIndex,
          sectionRatio: projected.sectionRatio,
        });
        setSnapGuide(EMPTY_SNAP_GUIDE);
        return;
      }

      const path = refs.resolvedPathsRef.current.find(
        (candidate) => candidate.id === state.pathId,
      );
      const detail = refs.discretizedByPathRef.current.get(state.pathId);
      if (path === undefined || detail === undefined) {
        return;
      }

      const keyframes = resolveDiscretizedHeadingKeyframes(path, detail);
      const current = keyframes.find(
        (item) => item.id === state.headingKeyframeId,
      );
      const previous =
        current === undefined
          ? null
          : getPreviousHeadingKeyframe(
              keyframes.filter((item) => item.id !== current.id),
              current.sectionIndex,
              current.sectionRatio,
            );
      const heading = resolveHeadingWithModifiers({
        origin: state.anchor,
        target: world,
        previousHeadingDeg: previous?.robotHeading ?? null,
        previousPoint:
          previous === null ? null : { x: previous.x, y: previous.y },
        previousSegmentStart: null,
        settings: refs.snapSettingsRef.current,
        shiftKey: event.evt.shiftKey,
        altKey: event.evt.altKey,
      });
      setSnapGuide(heading.guide);
      updateHeadingKeyframe(state.pathId, state.headingKeyframeId, {
        robotHeading: heading.angle,
      });
    },
    [
      refs.discretizedByPathRef,
      refs.resolvedPathsRef,
      refs.snapSettingsRef,
      setSnapGuide,
      updateHeadingKeyframe,
      updateWaypoint,
    ],
  );

  const finishStationaryInteraction = useCallback(
    (state: HeadingInteractionDragState): void => {
      if (state.kind === 'dragging-robot-heading') {
        setSelection({
          pathId: state.pathId,
          waypointId: state.waypointId,
          headingKeyframeId: null,
          sectionIndex: null,
        });
        return;
      }

      setSelection({
        pathId: state.pathId,
        waypointId: null,
        headingKeyframeId: state.headingKeyframeId,
        sectionIndex: null,
      });
      if (
        state.kind === 'dragging-heading-keyframe-heading' &&
        state.origin === 'add-point'
      ) {
        setTool('select');
      }
    },
    [setSelection, setTool],
  );

  const finishMovedInteraction = useCallback(
    (state: HeadingInteractionDragState): void => {
      if (
        state.kind === 'dragging-heading-keyframe-heading' &&
        state.origin === 'add-point'
      ) {
        setTool('select');
      }
    },
    [setTool],
  );

  return {
    beginRobotHeadingDrag,
    beginHeadingKeyframeDrag,
    beginHeadingKeyframeHeadingDrag,
    resetRobotHeadingToAuto,
    handleSectionInteraction,
    handleIdleAddPointPreview,
    resolveRobotHeadingMoveState,
    resolveHeadingKeyframeMoveState,
    resolveHeadingKeyframeHeadingMoveState,
    handlePointerMove,
    finishStationaryInteraction,
    finishMovedInteraction,
  };
};
