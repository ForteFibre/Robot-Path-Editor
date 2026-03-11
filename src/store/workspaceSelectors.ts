import type {
  PathModel,
  Point,
  RobotMotionSettings,
  SelectionState,
  Workspace,
} from '../domain/models';
import type { SnapSettings } from '../domain/snapping';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore, type WorkspaceStoreState } from './workspaceStore';

export type PointLibraryView = {
  items: Point[];
  lockedPointIds: string[];
  selectedLibraryPointId: string | null;
};

export const selectWorkspace = (state: WorkspaceStoreState): Workspace => {
  return {
    mode: state.ui.mode,
    tool: state.ui.tool,
    paths: state.domain.paths,
    points: state.domain.points,
    lockedPointIds: state.domain.lockedPointIds,
    activePathId: state.domain.activePathId,
    canvasTransform: state.ui.canvasTransform,
    selection: state.ui.selection,
    isDragging: state.ui.isDragging,
    snapSettings: state.ui.snapSettings,
    snapPanelOpen: state.ui.snapPanelOpen,
    backgroundImage: state.ui.backgroundImage,
    robotPreviewEnabled: state.ui.robotPreviewEnabled,
    robotSettings: state.ui.robotSettings,
  };
};

export const selectEditorMode = (
  state: WorkspaceStoreState,
): Workspace['mode'] => {
  return state.ui.mode;
};

export const selectEditorTool = (
  state: WorkspaceStoreState,
): Workspace['tool'] => {
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

export const selectPointLibrary = (
  state: WorkspaceStoreState,
): PointLibraryView => {
  return {
    items: state.domain.points,
    lockedPointIds: state.domain.lockedPointIds,
    selectedLibraryPointId: state.ui.selectedLibraryPointId,
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
): Workspace['canvasTransform'] => {
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
): Workspace['backgroundImage'] => {
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
  const { paths, activePathId } = state.domain;
  return paths.find((path) => path.id === activePathId) ?? null;
};

export const selectSelectedPath = (
  state: WorkspaceStoreState,
): PathModel | null => {
  const { paths } = state.domain;
  const { selection } = state.ui;
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

export const useEditorMode = (): Workspace['mode'] => {
  return useWorkspaceStore(selectEditorMode);
};

export const useEditorTool = (): Workspace['tool'] => {
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

export const useCanvasTransform = (): Workspace['canvasTransform'] => {
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

export const useBackgroundImage = (): Workspace['backgroundImage'] => {
  return useWorkspaceStore(selectBackgroundImage);
};

export const useRobotSettings = (): RobotMotionSettings => {
  return useWorkspaceStore(selectRobotSettings);
};

export const useRobotPreviewEnabled = (): boolean => {
  return useWorkspaceStore(selectRobotPreviewEnabled);
};
