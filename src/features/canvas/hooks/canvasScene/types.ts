import type { BackgroundImageRenderState } from '../../../../domain/backgroundImage';
import type { CanvasTransform } from '../../../../domain/canvasTransform';
import type { Point as GeometryPoint } from '../../../../domain/geometry';
import type { DiscretizedPath } from '../../../../domain/interpolation';
import type {
  BackgroundImage,
  CanvasTool,
  EditorMode,
  PathModel,
  Point,
  RobotMotionSettings,
  SelectionState,
} from '../../../../domain/models';
import type {
  ResolvedHeadingKeyframe,
  ResolvedPathModel,
  ResolvedWaypoint,
} from '../../../../domain/pointResolution';
import type { PathTiming } from '../../../../domain/pathTiming';
import type { PathGeometrySegment } from '../../../../domain/pathTimingSegments';
import type { RMinDragTarget } from '../../types/rMinDragTarget';
import type { AddPointPreviewState } from '../useCanvasPointerMachine';

export type CanvasSceneVisiblePath = {
  path: ResolvedPathModel;
  detail: DiscretizedPath | undefined;
  geometrySegments: PathGeometrySegment[];
  selection: SelectionState;
  lockedPointIds: string[];
  isActive: boolean;
};

export type CanvasSceneInteractionModel = {
  resolvedPaths: ResolvedPathModel[];
  allVisibleWaypointPoints: (GeometryPoint & { id: string })[];
  discretizedByPathForInteraction: Map<string, DiscretizedPath>;
  baseRMinDragTargets: RMinDragTarget[];
};

export type CanvasSceneRenderModel = {
  visiblePaths: CanvasSceneVisiblePath[];
  activePathTiming: PathTiming | null;
  activePathAnimationColor: string | null;
  backgroundImageRenderState: BackgroundImageRenderState | null;
  backgroundImageCanvasOrigin: GeometryPoint | null;
  addPointPreviewPath: ResolvedPathModel | null;
  addPointPreviewWaypoint: ResolvedWaypoint | null;
  addPointPreviewHeadingKeyframe: ResolvedHeadingKeyframe | null;
};

export type CanvasSceneDragState = {
  draggingWaypointId: string | null;
  draggingPathId: string | null;
};

export type CanvasSceneSharedDerived = {
  resolvedPaths: ResolvedPathModel[];
  activeResolvedPath: ResolvedPathModel | null;
  activePathTiming: PathTiming | null;
};

export type UseCanvasSceneModelParams = {
  mode: EditorMode;
  tool: CanvasTool;
  paths: PathModel[];
  points: Point[];
  lockedPointIds: string[];
  activePath: PathModel | null;
  selection: SelectionState;
  canvasTransform: CanvasTransform;
  backgroundImage: BackgroundImage | null;
  robotSettings: RobotMotionSettings;
  addPointPreview: AddPointPreviewState | null;
  derived: CanvasSceneSharedDerived;
};

export type UseCanvasSceneModelResult = {
  interaction: CanvasSceneInteractionModel;
  render: CanvasSceneRenderModel;
  resolveRMinDragTargets: (dragState: CanvasSceneDragState) => RMinDragTarget[];
};
