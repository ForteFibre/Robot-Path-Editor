import { useMemo, type RefObject } from 'react';
import type { SnapGuide } from '../../../../domain/geometry';
import type { AppNotification } from '../../../../errors';
import { createCanvasEditingCommands } from '../../../../store/commands/canvasEditingCommands';
import type { CanvasInteractionSnapshot } from '../../../../store/types';
import { useCanvasEditActions } from '../useCanvasEditActions';
import type {
  AddPointPreviewState,
  CanvasCommandTransitionEffect,
  LocalTransitionEffect,
  TransitionEffect,
  WorkspaceTransitionEffect,
} from './types';

type CanvasEditingCommandExecutor = ReturnType<
  typeof createCanvasEditingCommands
>;
type WorkspaceEffectActions = Pick<
  ReturnType<typeof useCanvasEditActions>,
  | 'clearSelection'
  | 'setCanvasTransform'
  | 'setSectionRMin'
  | 'setSelection'
  | 'updateBackgroundImage'
  | 'updateHeadingKeyframe'
  | 'updateWaypoint'
>;

export type PointerEffectExecutorDeps = {
  interactionSurfaceRef: RefObject<HTMLElement | null>;
  setSnapGuide: (guide: SnapGuide) => void;
  setAddPointPreview: (preview: AddPointPreviewState | null) => void;
  notify: (notification: AppNotification) => void;
  canvasEditingCommands: CanvasEditingCommandExecutor;
  workspaceActions: WorkspaceEffectActions;
};

type UsePointerEffectExecutorParams = Pick<
  PointerEffectExecutorDeps,
  'interactionSurfaceRef' | 'setSnapGuide' | 'setAddPointPreview' | 'notify'
> & {
  getWorkspace: () => CanvasInteractionSnapshot;
};

const isLocalEffect = (
  effect: TransitionEffect,
): effect is LocalTransitionEffect => {
  return effect.kind.startsWith('local.');
};

const isCommandEffect = (
  effect: TransitionEffect,
): effect is CanvasCommandTransitionEffect => {
  return effect.kind.startsWith('command.');
};

const releaseStagePointer = (
  interactionSurfaceRef: RefObject<HTMLElement | null>,
  pointerId: number,
): void => {
  try {
    interactionSurfaceRef.current?.releasePointerCapture(pointerId);
  } catch {
    // Pointer capture may not exist.
  }
};

const captureStagePointer = (
  interactionSurfaceRef: RefObject<HTMLElement | null>,
  pointerId: number,
): void => {
  interactionSurfaceRef.current?.setPointerCapture(pointerId);
};

const executeLocalEffect = (
  deps: PointerEffectExecutorDeps,
  effect: LocalTransitionEffect,
): void => {
  switch (effect.kind) {
    case 'local.set-snap-guide':
      deps.setSnapGuide(effect.guide);
      return;
    case 'local.set-add-point-preview':
      deps.setAddPointPreview(effect.preview);
      return;
    case 'local.capture-pointer':
      captureStagePointer(deps.interactionSurfaceRef, effect.pointerId);
      return;
    case 'local.release-pointer':
      releaseStagePointer(deps.interactionSurfaceRef, effect.pointerId);
      return;
    case 'local.notify':
      deps.notify(effect.notification);
  }
};

const executeWorkspaceEffect = (
  workspaceActions: WorkspaceEffectActions,
  effect: WorkspaceTransitionEffect,
): void => {
  switch (effect.kind) {
    case 'path.update-waypoint-position':
      workspaceActions.updateWaypoint(effect.pathId, effect.waypointId, {
        x: effect.point.x,
        y: effect.point.y,
      });
      return;
    case 'path.update-waypoint-path-heading':
      workspaceActions.updateWaypoint(effect.pathId, effect.waypointId, {
        pathHeading: effect.pathHeading,
      });
      return;
    case 'path.select-waypoint':
    case 'heading.select-waypoint':
      workspaceActions.setSelection({
        pathId: effect.pathId,
        waypointId: effect.waypointId,
        headingKeyframeId: null,
        sectionIndex: null,
      });
      return;
    case 'path.select-section':
    case 'rmin.select-section':
      workspaceActions.setSelection({
        pathId: effect.pathId,
        waypointId: null,
        headingKeyframeId: null,
        sectionIndex: effect.sectionIndex,
      });
      return;
    case 'path.clear-selection':
    case 'heading.clear-selection':
      workspaceActions.clearSelection();
      return;
    case 'heading.update-waypoint-robot-heading':
      workspaceActions.updateWaypoint(effect.pathId, effect.waypointId, {
        robotHeading: effect.robotHeading,
      });
      return;
    case 'heading.update-heading-keyframe-position':
      workspaceActions.updateHeadingKeyframe(
        effect.pathId,
        effect.headingKeyframeId,
        {
          sectionIndex: effect.sectionIndex,
          sectionRatio: effect.sectionRatio,
        },
      );
      return;
    case 'heading.update-heading-keyframe-heading':
      workspaceActions.updateHeadingKeyframe(
        effect.pathId,
        effect.headingKeyframeId,
        {
          robotHeading: effect.robotHeading,
        },
      );
      return;
    case 'heading.select-heading-keyframe':
      workspaceActions.setSelection({
        pathId: effect.pathId,
        waypointId: null,
        headingKeyframeId: effect.headingKeyframeId,
        sectionIndex: null,
      });
      return;
    case 'rmin.update-section-rmin':
      workspaceActions.setSectionRMin(
        effect.pathId,
        effect.sectionIndex,
        effect.rMin,
      );
      return;
    case 'pan.set-canvas-transform':
      workspaceActions.setCanvasTransform(effect.transform);
      return;
    case 'pan.update-background-image':
      workspaceActions.updateBackgroundImage(effect.updates);
  }
};

const executeCommandEffect = (
  canvasEditingCommands: CanvasEditingCommandExecutor,
  effect: CanvasCommandTransitionEffect,
): void => {
  switch (effect.kind) {
    case 'command.execute-add-waypoint':
      canvasEditingCommands.executeAddWaypoint(effect.params);
      return;
    case 'command.complete-add-waypoint-mode':
      canvasEditingCommands.completeAddWaypointMode();
      return;
    case 'command.execute-add-heading-keyframe':
      canvasEditingCommands.executeAddHeadingKeyframe(effect.params);
      return;
    case 'command.reset-waypoint-robot-heading':
      canvasEditingCommands.resetWaypointRobotHeading(effect.waypointId);
      return;
    case 'command.reset-section-rmin':
      canvasEditingCommands.resetSectionRMin(effect.sectionId);
      return;
    case 'command.execute-pan-selection-clear':
      canvasEditingCommands.executePanSelectionClear();
  }
};

export const createPointerEffectExecutor = (
  deps: PointerEffectExecutorDeps,
): ((effect: TransitionEffect) => void) => {
  return (effect: TransitionEffect): void => {
    if (isLocalEffect(effect)) {
      executeLocalEffect(deps, effect);
      return;
    }

    if (isCommandEffect(effect)) {
      executeCommandEffect(deps.canvasEditingCommands, effect);
      return;
    }

    executeWorkspaceEffect(deps.workspaceActions, effect);
  };
};

export const usePointerEffectExecutor = ({
  interactionSurfaceRef,
  setSnapGuide,
  setAddPointPreview,
  notify,
  getWorkspace,
}: UsePointerEffectExecutorParams): ((effect: TransitionEffect) => void) => {
  const {
    addHeadingKeyframe,
    clearSelection,
    insertLibraryWaypoint,
    setCanvasTransform,
    setSectionRMin,
    setSelection,
    setTool,
    updateBackgroundImage,
    updateHeadingKeyframe,
    updateWaypoint,
  } = useCanvasEditActions();

  const canvasEditingCommands = useMemo(
    () =>
      createCanvasEditingCommands({
        getWorkspace,
        insertLibraryWaypoint,
        addHeadingKeyframe,
        setSelection,
        setTool,
        updateWaypoint,
        setSectionRMin,
        clearSelection,
      }),
    [
      addHeadingKeyframe,
      clearSelection,
      getWorkspace,
      insertLibraryWaypoint,
      setSectionRMin,
      setSelection,
      setTool,
      updateWaypoint,
    ],
  );

  return useMemo(
    () =>
      createPointerEffectExecutor({
        interactionSurfaceRef,
        setSnapGuide,
        setAddPointPreview,
        notify,
        canvasEditingCommands,
        workspaceActions: {
          clearSelection,
          setCanvasTransform,
          setSectionRMin,
          setSelection,
          updateBackgroundImage,
          updateHeadingKeyframe,
          updateWaypoint,
        },
      }),
    [
      canvasEditingCommands,
      clearSelection,
      interactionSurfaceRef,
      notify,
      setAddPointPreview,
      setCanvasTransform,
      setSectionRMin,
      setSelection,
      setSnapGuide,
      updateBackgroundImage,
      updateHeadingKeyframe,
      updateWaypoint,
    ],
  );
};
