import { useCanvasSceneInteractionModel } from './canvasScene/useCanvasSceneInteractionModel';
import { useCanvasSceneRenderModel } from './canvasScene/useCanvasSceneRenderModel';
import type {
  UseCanvasSceneModelParams,
  UseCanvasSceneModelResult,
} from './canvasScene/types';

export const useCanvasSceneModel = (
  params: UseCanvasSceneModelParams,
): UseCanvasSceneModelResult => {
  const { derived, ...baseParams } = params;
  const { interaction, resolveRMinDragTargets } =
    useCanvasSceneInteractionModel({
      ...baseParams,
      resolvedPaths: derived.resolvedPaths,
    });
  const render = useCanvasSceneRenderModel({
    ...baseParams,
    resolvedPaths: derived.resolvedPaths,
    activeResolvedPath: derived.activeResolvedPath,
    activePathTiming: derived.activePathTiming,
  });

  return {
    interaction,
    render,
    resolveRMinDragTargets,
  };
};
