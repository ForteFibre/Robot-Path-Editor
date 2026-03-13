import {
  getPreviousHeadingKeyframe,
  getSectionPositionPoint,
  projectPointToPathSections,
  resolveDiscretizedHeadingKeyframes,
} from '../../../../domain/headingKeyframes';
import {
  EMPTY_SNAP_GUIDE,
  distance,
  headingDegFromPoints,
  pointFromHeading,
  type Point,
  type SnapGuide,
} from '../../../../domain/geometry';
import type { DiscretizedPath } from '../../../../domain/interpolation';
import type { PathModel, Point as ModelPoint } from '../../../../domain/models';
import type { ResolvedPathModel } from '../../../../domain/pointResolution';
import {
  resolveAngleSnap,
  resolvePointSnap,
} from '../../../../domain/snapping';
import type { SnapSettings } from '../../../../domain/snapSettings';
import type { CanvasInteractionSnapshot } from '../../../../store/types';
import type { AddPointPreviewState } from './types';

export const ANGLE_SNAP_THRESHOLD_DEG = 8;
export const HANDLE_MATCH_EPSILON = 0.1;

export const findWaypointWithPoint = (
  workspace: CanvasInteractionSnapshot,
  pathId: string,
  waypointId: string,
): {
  waypoint: PathModel['waypoints'][number];
  point: ModelPoint;
  libraryPoint: ModelPoint | null;
} | null => {
  const path = workspace.paths.find((candidate) => candidate.id === pathId);
  const waypoint = path?.waypoints.find((item) => item.id === waypointId);
  if (waypoint === undefined) {
    return null;
  }

  const point = workspace.points.find((item) => item.id === waypoint.pointId);
  if (point === undefined) {
    return null;
  }

  const libraryPoint =
    waypoint.libraryPointId === null
      ? null
      : (workspace.points.find((item) => item.id === waypoint.libraryPointId) ??
        null);

  return { waypoint, point, libraryPoint };
};

export const findResolvedWaypointContext = (
  resolvedPaths: ResolvedPathModel[],
  pathId: string,
  waypointId: string,
): {
  previousPoint: Point | null;
  previousHeadingDeg: number | null;
  previousSegmentStart: Point | null;
} => {
  const path = resolvedPaths.find((candidate) => candidate.id === pathId);
  if (path === undefined) {
    return {
      previousPoint: null,
      previousHeadingDeg: null,
      previousSegmentStart: null,
    };
  }

  const waypointIndex = path.waypoints.findIndex(
    (item) => item.id === waypointId,
  );
  if (waypointIndex <= 0) {
    return {
      previousPoint: null,
      previousHeadingDeg: null,
      previousSegmentStart: null,
    };
  }

  const previousWaypoint = path.waypoints[waypointIndex - 1];
  const previousSegmentStart =
    waypointIndex > 1 ? path.waypoints[waypointIndex - 2] : null;

  return {
    previousPoint:
      previousWaypoint === undefined
        ? null
        : { x: previousWaypoint.x, y: previousWaypoint.y },
    previousHeadingDeg: previousWaypoint?.pathHeading ?? null,
    previousSegmentStart:
      previousSegmentStart === null || previousSegmentStart === undefined
        ? null
        : { x: previousSegmentStart.x, y: previousSegmentStart.y },
  };
};

const findActivePathAddContext = (
  resolvedPaths: ResolvedPathModel[],
  activePathId: string,
): {
  previousPoint: Point | null;
  previousHeadingDeg: number | null;
  previousSegmentStart: Point | null;
} => {
  const path = resolvedPaths.find((candidate) => candidate.id === activePathId);
  if (path === undefined || path.waypoints.length === 0) {
    return {
      previousPoint: null,
      previousHeadingDeg: null,
      previousSegmentStart: null,
    };
  }

  const previousWaypoint = path.waypoints.at(-1) ?? null;
  const previousSegmentStartCandidate =
    path.waypoints.length > 1 ? path.waypoints.at(-2) : null;

  return {
    previousPoint:
      previousWaypoint === null
        ? null
        : { x: previousWaypoint.x, y: previousWaypoint.y },
    previousHeadingDeg: previousWaypoint?.pathHeading ?? null,
    previousSegmentStart:
      previousSegmentStartCandidate === null ||
      previousSegmentStartCandidate === undefined
        ? null
        : {
            x: previousSegmentStartCandidate.x,
            y: previousSegmentStartCandidate.y,
          },
  };
};

export const resolvePointWithModifiers = (params: {
  source: Point;
  candidates: Point[];
  previousPoint: Point | null;
  previousHeadingDeg: number | null;
  previousSegmentStart: Point | null;
  settings: SnapSettings;
  threshold: number;
  shiftKey: boolean;
  altKey: boolean;
}): { point: Point; guide: SnapGuide } => {
  const {
    source,
    candidates,
    previousPoint,
    previousHeadingDeg,
    previousSegmentStart,
    settings,
    threshold,
    shiftKey,
    altKey,
  } = params;

  if (altKey) {
    return {
      point: source,
      guide: EMPTY_SNAP_GUIDE,
    };
  }

  if (shiftKey && previousPoint !== null) {
    const snappedAngle = resolveAngleSnap({
      origin: previousPoint,
      target: source,
      previousHeadingDeg,
      previousPoint,
      previousSegmentStart,
      settings,
      thresholdDeg: ANGLE_SNAP_THRESHOLD_DEG,
      force: true,
    });
    const radius = distance(previousPoint, source);

    return {
      point: pointFromHeading(previousPoint, snappedAngle.angle, radius),
      guide: snappedAngle.guide,
    };
  }

  return resolvePointSnap(source, {
    candidates,
    previousPoint,
    previousHeadingDeg,
    previousSegmentStart,
    settings,
    threshold,
  });
};

export const resolveHeadingWithModifiers = (params: {
  origin: Point;
  target: Point;
  previousHeadingDeg: number | null;
  previousPoint: Point | null;
  previousSegmentStart: Point | null;
  settings: SnapSettings;
  shiftKey: boolean;
  altKey: boolean;
}): { angle: number; guide: SnapGuide } => {
  const {
    origin,
    target,
    previousHeadingDeg,
    previousPoint,
    previousSegmentStart,
    settings,
    shiftKey,
    altKey,
  } = params;

  if (altKey) {
    return {
      angle: headingDegFromPoints(origin, target),
      guide: EMPTY_SNAP_GUIDE,
    };
  }

  return resolveAngleSnap({
    origin,
    target,
    previousHeadingDeg,
    previousPoint,
    previousSegmentStart,
    settings,
    thresholdDeg: ANGLE_SNAP_THRESHOLD_DEG,
    force: shiftKey,
  });
};

export const isWaypointCoordinateLocked = (
  workspace: CanvasInteractionSnapshot,
  pathId: string,
  waypointId: string,
): boolean => {
  const resolved = findWaypointWithPoint(workspace, pathId, waypointId);
  return resolved === null
    ? false
    : resolved.waypoint.libraryPointId !== null &&
        workspace.lockedPointIds.includes(resolved.waypoint.libraryPointId);
};

export const resolveHeadingKeyframeAnchor = (
  resolvedPaths: ResolvedPathModel[],
  discretizedByPath: Map<string, DiscretizedPath>,
  pathId: string,
  headingKeyframeId: string,
): Point | null => {
  const path = resolvedPaths.find((candidate) => candidate.id === pathId);
  const detail = discretizedByPath.get(pathId);
  if (path === undefined || detail === undefined) {
    return null;
  }

  const keyframe = resolveDiscretizedHeadingKeyframes(path, detail).find(
    (item) => item.id === headingKeyframeId,
  );
  return keyframe === undefined ? null : { x: keyframe.x, y: keyframe.y };
};

export const resolveHeadingKeyframePreview = (params: {
  workspace: CanvasInteractionSnapshot;
  resolvedPaths: ResolvedPathModel[];
  discretizedByPath: Map<string, DiscretizedPath>;
  source: Point;
}): AddPointPreviewState | null => {
  const activePath = params.resolvedPaths.find(
    (path) => path.id === params.workspace.activePathId,
  );
  const detail = params.discretizedByPath.get(params.workspace.activePathId);
  if (
    activePath === undefined ||
    detail === undefined ||
    activePath.waypoints.length < 2
  ) {
    return null;
  }

  const projected = projectPointToPathSections(detail, params.source);
  if (projected === null) {
    return null;
  }

  const position = getSectionPositionPoint(detail, projected);
  if (position === null) {
    return null;
  }

  const previous = getPreviousHeadingKeyframe(
    resolveDiscretizedHeadingKeyframes(activePath, detail),
    projected.sectionIndex,
    projected.sectionRatio,
  );

  return {
    kind: 'heading-keyframe',
    point: { x: position.x, y: position.y },
    robotHeading: previous?.robotHeading ?? position.pathHeading,
    sectionIndex: projected.sectionIndex,
    sectionRatio: projected.sectionRatio,
  };
};

export const resolvePathAddPointPreview = (params: {
  workspace: CanvasInteractionSnapshot;
  resolvedPaths: ResolvedPathModel[];
  candidates: Point[];
  source: Point;
  settings: SnapSettings;
  threshold: number;
  shiftKey: boolean;
  altKey: boolean;
}): { preview: AddPointPreviewState | null; guide: SnapGuide } => {
  const {
    workspace,
    resolvedPaths,
    candidates,
    source,
    settings,
    threshold,
    shiftKey,
    altKey,
  } = params;
  const activePath = workspace.paths.find(
    (path) => path.id === workspace.activePathId,
  );

  if (activePath === undefined) {
    return {
      preview: null,
      guide: EMPTY_SNAP_GUIDE,
    };
  }

  const selectedWaypointId = workspace.selection.waypointId;
  const resolvedActive = resolvedPaths.find(
    (path) => path.id === activePath.id,
  );

  let context: ReturnType<typeof findActivePathAddContext>;
  let sourcePoint: Point | null = null;
  let nextPoint: Point | null = null;

  if (
    selectedWaypointId !== null &&
    resolvedActive !== undefined &&
    workspace.selection.pathId === activePath.id
  ) {
    context = findResolvedWaypointContext(
      resolvedPaths,
      activePath.id,
      selectedWaypointId,
    );
    const selectedIdx = resolvedActive.waypoints.findIndex(
      (wp) => wp.id === selectedWaypointId,
    );
    if (selectedIdx >= 0) {
      const selectedWp = resolvedActive.waypoints[selectedIdx];
      if (selectedWp !== undefined) {
        sourcePoint = { x: selectedWp.x, y: selectedWp.y };
      }
      const nextWp = resolvedActive.waypoints[selectedIdx + 1];
      if (nextWp !== undefined) {
        nextPoint = { x: nextWp.x, y: nextWp.y };
      }
    }
  } else {
    context = findActivePathAddContext(resolvedPaths, activePath.id);
    sourcePoint = context.previousPoint;
  }

  const snapped = resolvePointWithModifiers({
    source,
    candidates,
    previousPoint: context.previousPoint,
    previousHeadingDeg: context.previousHeadingDeg,
    previousSegmentStart: context.previousSegmentStart,
    settings,
    threshold,
    shiftKey,
    altKey,
  });

  return {
    preview: {
      kind: 'path-waypoint',
      point: snapped.point,
      pathHeading:
        context.previousHeadingDeg ??
        activePath.waypoints.at(-1)?.pathHeading ??
        0,
      sourcePoint,
      nextPoint,
    },
    guide: snapped.guide,
  };
};
