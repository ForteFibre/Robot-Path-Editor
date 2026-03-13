import { useCallback, useMemo } from 'react';
import { getCanvasRenderStep } from '../../../../domain/canvas';
import { discretizePathDetailed } from '../../../../domain/interpolation';
import type { ResolvedPathModel } from '../../../../domain/pointResolution';
import type { RMinDragTarget } from '../../types/rMinDragTarget';
import { resolveSceneRMinDragTargets } from './rMinTargets';
import type {
  CanvasSceneDragState,
  CanvasSceneInteractionModel,
  UseCanvasSceneModelParams,
} from './types';

type UseCanvasSceneInteractionModelParams = Pick<
  UseCanvasSceneModelParams,
  'mode' | 'tool' | 'paths' | 'points' | 'selection' | 'canvasTransform'
> & {
  resolvedPaths: ResolvedPathModel[];
};

type UseCanvasSceneInteractionModelResult = {
  interaction: CanvasSceneInteractionModel;
  resolveRMinDragTargets: (dragState: CanvasSceneDragState) => RMinDragTarget[];
};

export const useCanvasSceneInteractionModel = ({
  mode,
  tool,
  paths,
  points,
  selection,
  canvasTransform,
  resolvedPaths,
}: UseCanvasSceneInteractionModelParams): UseCanvasSceneInteractionModelResult => {
  const allVisibleWaypointPoints = useMemo(() => {
    return resolvedPaths.flatMap((path) => {
      if (!path.visible) {
        return [];
      }

      return path.waypoints.map((waypoint) => ({
        id: waypoint.id,
        x: waypoint.x,
        y: waypoint.y,
      }));
    });
  }, [resolvedPaths]);

  const renderStep = getCanvasRenderStep(canvasTransform.k);

  const discretizedByPathForInteraction = useMemo(() => {
    const byPath = new Map<string, ReturnType<typeof discretizePathDetailed>>();

    for (const path of paths) {
      byPath.set(path.id, discretizePathDetailed(path, points, renderStep));
    }

    return byPath;
  }, [paths, points, renderStep]);

  const resolveRMinDragTargets = useCallback(
    ({ draggingWaypointId, draggingPathId }: CanvasSceneDragState) => {
      if (
        mode !== 'path' ||
        (tool === 'add-point' && draggingWaypointId === null)
      ) {
        return [];
      }

      return resolveSceneRMinDragTargets({
        paths: resolvedPaths,
        selection,
        draggingWaypointId,
        draggingPathId,
      });
    },
    [mode, resolvedPaths, selection, tool],
  );

  const baseRMinDragTargets = useMemo(
    () =>
      resolveRMinDragTargets({
        draggingWaypointId: null,
        draggingPathId: null,
      }),
    [resolveRMinDragTargets],
  );

  return {
    interaction: {
      resolvedPaths,
      allVisibleWaypointPoints,
      discretizedByPathForInteraction,
      baseRMinDragTargets,
    },
    resolveRMinDragTargets,
  };
};
