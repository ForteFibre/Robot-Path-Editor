import type { PathModel, Point, RobotMotionSettings } from '../domain/models';
import {
  createPointIndex,
  resolvePathModel,
  type ResolvedPathModel,
} from '../domain/pointResolution';
import { computePathTiming, type PathTiming } from '../domain/pathTiming';
import type { WorkspaceStoreState } from './workspaceStore';

export type WorkspaceDerivedState = {
  resolvedPaths: ResolvedPathModel[];
  activeResolvedPath: ResolvedPathModel | null;
  activePathTiming: PathTiming | null;
};

type WorkspacePathResolutionInputs = {
  activePathId: string | null;
  paths: readonly PathModel[];
  points: readonly Point[];
};

export type WorkspaceDerivedInputs = WorkspacePathResolutionInputs & {
  robotSettings: RobotMotionSettings;
};

const computeWorkspacePathResolution = ({
  activePathId,
  paths,
  points,
}: WorkspacePathResolutionInputs): Pick<
  WorkspaceDerivedState,
  'resolvedPaths' | 'activeResolvedPath'
> => {
  const resolvedPaths = computeResolvedPaths(paths, points);

  return {
    resolvedPaths,
    activeResolvedPath: computeActiveResolvedPath(activePathId, resolvedPaths),
  };
};

const selectWorkspacePathResolutionInputs = (state: WorkspaceStoreState) => ({
  activePathId: state.domain.activePathId,
  paths: state.domain.paths,
  points: state.domain.points,
});

export const selectWorkspaceDerivedInputs = (state: WorkspaceStoreState) => ({
  activePathId: state.domain.activePathId,
  paths: state.domain.paths,
  points: state.domain.points,
  robotSettings: state.ui.robotSettings,
});

export const computeResolvedPaths = (
  paths: readonly PathModel[],
  points: readonly Point[],
): ResolvedPathModel[] => {
  const pointsById = createPointIndex(points as Point[]);

  return paths.map((path) => resolvePathModel(path, pointsById));
};

export const computeActiveResolvedPath = (
  activePathId: string | null,
  resolvedPaths: readonly ResolvedPathModel[],
): ResolvedPathModel | null => {
  if (activePathId === null) {
    return null;
  }

  return resolvedPaths.find((path) => path.id === activePathId) ?? null;
};

export const computeActivePathTiming = (
  activePath: ResolvedPathModel | null,
  points: readonly Point[],
  robotSettings: RobotMotionSettings,
): PathTiming | null => {
  if (activePath === null) {
    return null;
  }

  return computePathTiming(activePath, points as Point[], robotSettings);
};

export const computeWorkspaceDerivedState = (
  inputs: WorkspaceDerivedInputs,
): WorkspaceDerivedState => {
  const { resolvedPaths, activeResolvedPath } =
    computeWorkspacePathResolution(inputs);

  return {
    resolvedPaths,
    activeResolvedPath,
    activePathTiming: computeActivePathTiming(
      activeResolvedPath,
      inputs.points,
      inputs.robotSettings,
    ),
  };
};

export const selectResolvedPaths = (
  state: WorkspaceStoreState,
): ResolvedPathModel[] => {
  return computeWorkspacePathResolution(
    selectWorkspacePathResolutionInputs(state),
  ).resolvedPaths;
};

export const selectActiveResolvedPath = (
  state: WorkspaceStoreState,
): ResolvedPathModel | null => {
  return computeWorkspacePathResolution(
    selectWorkspacePathResolutionInputs(state),
  ).activeResolvedPath;
};

export const selectActivePathTiming = (
  state: WorkspaceStoreState,
): PathTiming | null => {
  return computeWorkspaceDerivedState(selectWorkspaceDerivedInputs(state))
    .activePathTiming;
};

export const selectWorkspaceDerived = (
  state: WorkspaceStoreState,
): WorkspaceDerivedState => {
  return computeWorkspaceDerivedState(selectWorkspaceDerivedInputs(state));
};
