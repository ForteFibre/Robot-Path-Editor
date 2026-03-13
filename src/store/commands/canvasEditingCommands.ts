import {
  type CanvasTool,
  type HeadingKeyframe,
  type PathModel,
  type SelectionState,
} from '../../domain/models';
import { createHeadingKeyframe } from '../../domain/factories';
import { getDefaultHeadingKeyframeName } from '../../domain/naming';
import type { CanvasInteractionSnapshot } from '../types';
import { resolveWaypointInsertionIndex } from './canvasEditingPolicy';

export type ExecuteAddWaypointParams = {
  pathId: string;
  pointId: string;
  waypointId: string;
  x: number;
  y: number;
};

export type ExecuteAddHeadingKeyframeParams = {
  pathId: string;
  headingKeyframeId: string;
  sectionIndex: number;
  sectionRatio: number;
  robotHeading: number;
};

export type SectionSelectionTarget = {
  pathId: string;
  sectionIndex: number;
};

export type CanvasEditingCommandDeps = {
  getWorkspace: () => CanvasInteractionSnapshot;
  insertLibraryWaypoint: (input: {
    pathId: string;
    x: number;
    y: number;
    pointId?: string;
    waypointId?: string;
    linkToLibrary?: boolean;
    afterWaypointId?: string | null;
  }) => string | null;
  addHeadingKeyframe: (pathId: string, keyframe: HeadingKeyframe) => void;
  setSelection: (selection: SelectionState) => void;
  setTool: (tool: CanvasTool) => void;
  updateWaypoint: (
    pathId: string,
    waypointId: string,
    patch: { robotHeading: number | null },
  ) => void;
  setSectionRMin: (
    pathId: string,
    sectionIndex: number,
    rMin: number | null,
  ) => void;
  clearSelection: () => void;
};

const selectWaypoint = (
  setSelection: CanvasEditingCommandDeps['setSelection'],
  pathId: string,
  waypointId: string,
): void => {
  setSelection({
    pathId,
    waypointId,
    headingKeyframeId: null,
    sectionIndex: null,
  });
};

const selectHeadingKeyframe = (
  setSelection: CanvasEditingCommandDeps['setSelection'],
  pathId: string,
  headingKeyframeId: string,
): void => {
  setSelection({
    pathId,
    waypointId: null,
    headingKeyframeId,
    sectionIndex: null,
  });
};

const selectSection = (
  setSelection: CanvasEditingCommandDeps['setSelection'],
  target: SectionSelectionTarget,
): void => {
  setSelection({
    pathId: target.pathId,
    waypointId: null,
    headingKeyframeId: null,
    sectionIndex: target.sectionIndex,
  });
};

const findPath = (
  workspace: CanvasInteractionSnapshot,
  pathId: string,
): PathModel | undefined => {
  return workspace.paths.find((path) => path.id === pathId);
};

const resolveWaypointInsertionAfterWaypointId = (
  path: PathModel,
  selection: SelectionState,
): string | null | undefined => {
  const insertionIndex = resolveWaypointInsertionIndex(path, selection);

  if (path.waypoints.length === 0) {
    return undefined;
  }

  if (insertionIndex <= 0) {
    return null;
  }

  return path.waypoints[insertionIndex - 1]?.id ?? path.waypoints.at(-1)?.id;
};

const findWaypointPath = (
  workspace: CanvasInteractionSnapshot,
  waypointId: string,
): PathModel | undefined => {
  return workspace.paths.find((path) =>
    path.waypoints.some((waypoint) => waypoint.id === waypointId),
  );
};

export const createCanvasEditingCommands = (deps: CanvasEditingCommandDeps) => {
  return {
    executeAddWaypoint: (params: ExecuteAddWaypointParams): string | null => {
      const workspace = deps.getWorkspace();
      const path = findPath(workspace, params.pathId);
      if (path === undefined) {
        return null;
      }

      const afterWaypointId = resolveWaypointInsertionAfterWaypointId(
        path,
        workspace.selection,
      );

      return deps.insertLibraryWaypoint({
        pathId: params.pathId,
        pointId: params.pointId,
        waypointId: params.waypointId,
        x: params.x,
        y: params.y,
        linkToLibrary: false,
        ...(afterWaypointId === undefined ? {} : { afterWaypointId }),
      });
    },

    completeAddWaypointMode: (): void => {
      deps.setTool('select');
    },

    executeAddHeadingKeyframe: (
      params: ExecuteAddHeadingKeyframeParams,
    ): string | null => {
      const workspace = deps.getWorkspace();
      const path = findPath(workspace, params.pathId);
      if (path === undefined || path.waypoints.length < 2) {
        return null;
      }

      const keyframe = createHeadingKeyframe({
        id: params.headingKeyframeId,
        sectionIndex: params.sectionIndex,
        sectionRatio: params.sectionRatio,
        robotHeading: params.robotHeading,
        name: getDefaultHeadingKeyframeName(path.headingKeyframes.length),
      });

      deps.addHeadingKeyframe(params.pathId, keyframe);
      selectHeadingKeyframe(
        deps.setSelection,
        params.pathId,
        params.headingKeyframeId,
      );

      return keyframe.id;
    },

    resetWaypointRobotHeading: (waypointId: string): void => {
      const workspace = deps.getWorkspace();
      const path = findWaypointPath(workspace, waypointId);
      if (path === undefined) {
        return;
      }

      deps.updateWaypoint(path.id, waypointId, { robotHeading: null });
      selectWaypoint(deps.setSelection, path.id, waypointId);
    },

    resetSectionRMin: (sectionId: SectionSelectionTarget): void => {
      deps.setSectionRMin(sectionId.pathId, sectionId.sectionIndex, null);
      selectSection(deps.setSelection, sectionId);
    },

    executePanSelectionClear: (): void => {
      deps.clearSelection();
    },
  };
};
