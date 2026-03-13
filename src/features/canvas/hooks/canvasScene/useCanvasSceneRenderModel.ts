import { useDeferredValue, useMemo } from 'react';
import {
  toBackgroundImageCanvasOrigin,
  toBackgroundImageCanvasRenderState,
} from '../../../../domain/backgroundImage';
import { getCanvasRenderStep } from '../../../../domain/canvas';
import { discretizePathDetailed } from '../../../../domain/interpolation';
import type { ResolvedPathModel } from '../../../../domain/pointResolution';
import type { PathTiming } from '../../../../domain/pathTiming';
import { buildPathTimingGeometry } from '../../../../domain/pathTimingSegments';
import {
  buildPreviewHeadingKeyframe,
  buildPreviewPath,
  buildPreviewWaypoint,
} from './canvasScenePreview';
import type {
  CanvasSceneRenderModel,
  UseCanvasSceneModelParams,
} from './types';

type UseCanvasSceneRenderModelParams = Pick<
  UseCanvasSceneModelParams,
  | 'paths'
  | 'points'
  | 'lockedPointIds'
  | 'activePath'
  | 'selection'
  | 'canvasTransform'
  | 'backgroundImage'
  | 'addPointPreview'
> & {
  resolvedPaths: ResolvedPathModel[];
  activeResolvedPath: ResolvedPathModel | null;
  activePathTiming: PathTiming | null;
};

export const useCanvasSceneRenderModel = ({
  paths,
  points,
  lockedPointIds,
  activePath,
  selection,
  canvasTransform,
  backgroundImage,
  addPointPreview,
  resolvedPaths,
  activeResolvedPath,
  activePathTiming,
}: UseCanvasSceneRenderModelParams): CanvasSceneRenderModel => {
  const visibleActivePathTiming = useMemo(() => {
    if (activePath?.visible !== true) {
      return null;
    }

    return activePathTiming;
  }, [activePath, activePathTiming]);

  const activePathAnimationColor = useMemo(() => {
    if (activePath?.visible !== true) {
      return null;
    }

    return activePath.color;
  }, [activePath]);

  const renderStep = getCanvasRenderStep(canvasTransform.k);
  const deferredPathsForDiscretize = useDeferredValue(paths);
  const deferredPointsForDiscretize = useDeferredValue(points);

  const discretizedByPath = useMemo(() => {
    const byPath = new Map<string, ReturnType<typeof discretizePathDetailed>>();

    for (const path of deferredPathsForDiscretize) {
      byPath.set(
        path.id,
        discretizePathDetailed(path, deferredPointsForDiscretize, renderStep),
      );
    }

    return byPath;
  }, [deferredPathsForDiscretize, deferredPointsForDiscretize, renderStep]);

  const geometryByPath = useMemo(() => {
    const byPath = new Map<
      string,
      ReturnType<typeof buildPathTimingGeometry>
    >();

    for (const path of paths) {
      if (!path.visible) {
        continue;
      }

      byPath.set(path.id, buildPathTimingGeometry(path, points));
    }

    return byPath;
  }, [paths, points]);

  const backgroundImageRenderState =
    backgroundImage === null
      ? null
      : toBackgroundImageCanvasRenderState(backgroundImage);
  const backgroundImageCanvasOrigin =
    backgroundImage === null
      ? null
      : toBackgroundImageCanvasOrigin(backgroundImage);

  const addPointPreviewWaypoint = useMemo(() => {
    if (
      addPointPreview?.kind !== 'path-waypoint' ||
      activeResolvedPath === null
    ) {
      return null;
    }

    return buildPreviewWaypoint(
      addPointPreview,
      `WP ${activeResolvedPath.waypoints.length + 1}`,
    );
  }, [activeResolvedPath, addPointPreview]);

  const addPointPreviewHeadingKeyframe = useMemo(() => {
    if (
      addPointPreview?.kind !== 'heading-keyframe' ||
      activeResolvedPath === null
    ) {
      return null;
    }

    return buildPreviewHeadingKeyframe(
      addPointPreview,
      `Heading ${activeResolvedPath.headingKeyframes.length + 1}`,
    );
  }, [activeResolvedPath, addPointPreview]);

  const addPointPreviewPath = useMemo(
    () =>
      buildPreviewPath({
        activeResolvedPath,
        previewWaypoint: addPointPreviewWaypoint,
        previewHeadingKeyframe: addPointPreviewHeadingKeyframe,
      }),
    [
      activeResolvedPath,
      addPointPreviewHeadingKeyframe,
      addPointPreviewWaypoint,
    ],
  );

  const activePathId = activePath?.id ?? null;

  const visiblePaths = useMemo(
    () =>
      resolvedPaths
        .filter((path) => path.visible)
        .map((path) => ({
          path,
          detail: discretizedByPath.get(path.id),
          geometrySegments: geometryByPath.get(path.id)?.segments ?? [],
          selection,
          lockedPointIds,
          isActive: activePathId === path.id,
        })),
    [
      activePathId,
      discretizedByPath,
      geometryByPath,
      lockedPointIds,
      resolvedPaths,
      selection,
    ],
  );

  return {
    visiblePaths,
    activePathTiming: visibleActivePathTiming,
    activePathAnimationColor,
    backgroundImageRenderState,
    backgroundImageCanvasOrigin,
    addPointPreviewPath,
    addPointPreviewWaypoint,
    addPointPreviewHeadingKeyframe,
  };
};
