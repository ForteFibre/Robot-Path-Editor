import type {
  ResolvedHeadingKeyframe,
  ResolvedPathModel,
  ResolvedWaypoint,
} from '../../../../domain/pointResolution';
import type { AddPointPreviewState } from '../useCanvasPointerMachine';

type PathWaypointPreview = Extract<
  AddPointPreviewState,
  { kind: 'path-waypoint' }
>;

type HeadingKeyframePreview = Extract<
  AddPointPreviewState,
  { kind: 'heading-keyframe' }
>;

type BuildPreviewPathParams = {
  activeResolvedPath: ResolvedPathModel | null;
  previewWaypoint: ResolvedWaypoint | null;
  previewHeadingKeyframe: ResolvedHeadingKeyframe | null;
};

export const buildPreviewWaypoint = (
  preview: PathWaypointPreview,
  name: string,
): ResolvedWaypoint => {
  return {
    id: 'add-point-preview-waypoint',
    pointId: 'add-point-preview-point',
    libraryPointId: null,
    name,
    pathHeading: preview.pathHeading,
    point: {
      id: 'add-point-preview-point',
      x: preview.point.x,
      y: preview.point.y,
      robotHeading: null,
      isLibrary: false,
      name,
    },
    libraryPoint: null,
    x: preview.point.x,
    y: preview.point.y,
  };
};

export const buildPreviewHeadingKeyframe = (
  preview: HeadingKeyframePreview,
  name: string,
): ResolvedHeadingKeyframe => {
  return {
    id: 'add-point-preview-heading-keyframe',
    name,
    sectionIndex: preview.sectionIndex,
    sectionRatio: preview.sectionRatio,
    robotHeading: preview.robotHeading,
    x: preview.point.x,
    y: preview.point.y,
    pathHeading: 0,
  };
};

export const buildPreviewPath = ({
  activeResolvedPath,
  previewWaypoint,
  previewHeadingKeyframe,
}: BuildPreviewPathParams): ResolvedPathModel | null => {
  if (
    (previewWaypoint === null && previewHeadingKeyframe === null) ||
    activeResolvedPath === null
  ) {
    return null;
  }

  return activeResolvedPath;
};
