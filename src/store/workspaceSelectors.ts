import type {
  BackgroundImage,
  CanvasTool,
  EditorMode,
  PathModel,
  Point,
  RobotMotionSettings,
  SelectionState,
} from '../domain/models';
import type { CanvasTransform } from '../domain/canvasTransform';
import type { SnapSettings } from '../domain/snapSettings';
import type {
  WorkspaceAutosaveSource,
  WorkspaceDocumentSource,
} from './adapters/workspacePersistence';
import type { CanvasInteractionSnapshot } from './types';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore, type WorkspaceStoreState } from './workspaceStore';

export type PointLibraryView = {
  items: Point[];
  lockedPointIds: string[];
  selectedLibraryPointId: string | null;
};

export const selectEditorMode = (state: WorkspaceStoreState): EditorMode => {
  return state.ui.mode;
};

export const selectEditorTool = (state: WorkspaceStoreState): CanvasTool => {
  return state.ui.tool;
};

export const selectSelection = (state: WorkspaceStoreState): SelectionState => {
  return state.ui.selection;
};

export const selectPaths = (state: WorkspaceStoreState): PathModel[] => {
  return state.domain.paths;
};

export const selectActivePathId = (state: WorkspaceStoreState): string => {
  return state.domain.activePathId;
};

export const selectDomainState = (
  state: WorkspaceStoreState,
): WorkspaceStoreState['domain'] => {
  return state.domain;
};

export const selectWorkspaceDocumentSource = (
  state: WorkspaceStoreState,
): WorkspaceDocumentSource => {
  return {
    domain: state.domain,
    backgroundImage: state.ui.backgroundImage,
    robotSettings: state.ui.robotSettings,
  };
};

export const selectWorkspaceAutosaveSource = (
  state: WorkspaceStoreState,
): WorkspaceAutosaveSource => {
  return {
    domain: state.domain,
    mode: state.ui.mode,
    tool: state.ui.tool,
    selection: state.ui.selection,
    canvasTransform: state.ui.canvasTransform,
    backgroundImage: state.ui.backgroundImage,
    robotPreviewEnabled: state.ui.robotPreviewEnabled,
    robotSettings: state.ui.robotSettings,
  };
};

export const selectPointLibrary = (
  state: WorkspaceStoreState,
): PointLibraryView => {
  return {
    items: selectPoints(state),
    lockedPointIds: selectLockedPointIds(state),
    selectedLibraryPointId: selectSelectedLibraryPointId(state),
  };
};

export const selectCanvasInteractionSnapshot = (
  state: WorkspaceStoreState,
): CanvasInteractionSnapshot => {
  return {
    mode: state.ui.mode,
    tool: state.ui.tool,
    paths: state.domain.paths,
    points: state.domain.points,
    lockedPointIds: state.domain.lockedPointIds,
    activePathId: state.domain.activePathId,
    canvasTransform: state.ui.canvasTransform,
    selection: state.ui.selection,
    backgroundImage: state.ui.backgroundImage,
  };
};

export const selectSelectedLibraryPointId = (
  state: WorkspaceStoreState,
): string | null => {
  return state.ui.selectedLibraryPointId;
};

export const selectPoints = (state: WorkspaceStoreState): Point[] => {
  return state.domain.points;
};

export const selectLockedPointIds = (state: WorkspaceStoreState): string[] => {
  return state.domain.lockedPointIds;
};

export const selectCanvasTransform = (
  state: WorkspaceStoreState,
): CanvasTransform => {
  return state.ui.canvasTransform;
};

export const selectSnapSettings = (
  state: WorkspaceStoreState,
): SnapSettings => {
  return state.ui.snapSettings;
};

export const selectSnapPanelOpen = (state: WorkspaceStoreState): boolean => {
  return state.ui.snapPanelOpen;
};

export const selectBackgroundImage = (
  state: WorkspaceStoreState,
): BackgroundImage | null => {
  return state.ui.backgroundImage;
};

export const selectRobotSettings = (
  state: WorkspaceStoreState,
): RobotMotionSettings => {
  return state.ui.robotSettings;
};

export const selectRobotPreviewEnabled = (
  state: WorkspaceStoreState,
): boolean => {
  return state.ui.robotPreviewEnabled;
};

export const selectActivePath = (
  state: WorkspaceStoreState,
): PathModel | null => {
  const paths = selectPaths(state);
  const activePathId = selectActivePathId(state);
  return paths.find((path) => path.id === activePathId) ?? null;
};

export const selectSelectedPath = (
  state: WorkspaceStoreState,
): PathModel | null => {
  const paths = selectPaths(state);
  const selection = selectSelection(state);
  if (selection.pathId === null) {
    return null;
  }

  return paths.find((path) => path.id === selection.pathId) ?? null;
};

export const selectSelectedWaypoint = (
  state: WorkspaceStoreState,
): PathModel['waypoints'][number] | null => {
  const selectedPath = selectSelectedPath(state);
  const waypointId = state.ui.selection.waypointId;

  if (selectedPath === null || waypointId === null) {
    return null;
  }

  return (
    selectedPath.waypoints.find((waypoint) => waypoint.id === waypointId) ??
    null
  );
};

export const selectSelectedHeadingKeyframe = (
  state: WorkspaceStoreState,
): PathModel['headingKeyframes'][number] | null => {
  const selectedPath = selectSelectedPath(state);
  const headingKeyframeId = state.ui.selection.headingKeyframeId;

  if (selectedPath === null || headingKeyframeId === null) {
    return null;
  }

  return (
    selectedPath.headingKeyframes.find(
      (keyframe) => keyframe.id === headingKeyframeId,
    ) ?? null
  );
};

export const useEditorMode = (): EditorMode => {
  return useWorkspaceStore(selectEditorMode);
};

export const useEditorTool = (): CanvasTool => {
  return useWorkspaceStore(selectEditorTool);
};

export const useSelection = (): SelectionState => {
  return useWorkspaceStore(selectSelection);
};

export const useActivePath = (): PathModel | null => {
  return useWorkspaceStore(selectActivePath);
};

export const usePaths = (): PathModel[] => {
  return useWorkspaceStore(selectPaths);
};

export const useActivePathId = (): string => {
  return useWorkspaceStore(selectActivePathId);
};

export const useSelectedWaypoint = ():
  | PathModel['waypoints'][number]
  | null => {
  return useWorkspaceStore(selectSelectedWaypoint);
};

export const useSelectedHeadingKeyframe = ():
  | PathModel['headingKeyframes'][number]
  | null => {
  return useWorkspaceStore(selectSelectedHeadingKeyframe);
};

export const usePoints = (): Point[] => {
  return useWorkspaceStore(selectPoints);
};

export const useLockedPointIds = (): string[] => {
  return useWorkspaceStore(selectLockedPointIds);
};

export const usePointLibrary = (): PointLibraryView => {
  return useWorkspaceStore(useShallow(selectPointLibrary));
};

export const useCanvasTransform = (): CanvasTransform => {
  return useWorkspaceStore(selectCanvasTransform);
};

export const useSelectedLibraryPointId = (): string | null => {
  return useWorkspaceStore(selectSelectedLibraryPointId);
};

export const useSnapSettings = (): SnapSettings => {
  return useWorkspaceStore(selectSnapSettings);
};

export const useSnapPanelOpen = (): boolean => {
  return useWorkspaceStore(selectSnapPanelOpen);
};

export const useBackgroundImage = (): BackgroundImage | null => {
  return useWorkspaceStore(selectBackgroundImage);
};

export const useRobotSettings = (): RobotMotionSettings => {
  return useWorkspaceStore(selectRobotSettings);
};

export const useRobotPreviewEnabled = (): boolean => {
  return useWorkspaceStore(selectRobotPreviewEnabled);
};
