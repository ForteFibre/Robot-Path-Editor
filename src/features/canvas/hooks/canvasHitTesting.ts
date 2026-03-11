import type Konva from 'konva';
import { getHeadingHandleDistance } from '../../../domain/canvas';
import type { Point as GeometryPoint } from '../../../domain/geometry';
import {
  distance,
  pointFromHeading,
  screenToWorld,
} from '../../../domain/geometry';
import { resolveDiscretizedHeadingKeyframes } from '../../../domain/headingKeyframes';
import type { DiscretizedPath } from '../../../domain/interpolation';
import type {
  BackgroundImage,
  CanvasTransform as ViewTransform,
  Workspace,
} from '../../../domain/models';
import { projectPointToSectionSamples } from '../../../domain/pathSampling';
import type { ResolvedPathModel } from '../../../domain/pointResolution';
import type { RMinDragTarget } from '../components/CanvasRMinDrag';
import { resolveWaypointRobotHeadingHandleAngle } from '../waypointHeading';

export type HitTarget =
  | { kind: 'waypoint'; pathId: string; waypointId: string }
  | { kind: 'path-heading'; pathId: string; waypointId: string }
  | { kind: 'robot-heading'; pathId: string; waypointId: string }
  | { kind: 'heading-keyframe'; pathId: string; headingKeyframeId: string }
  | {
      kind: 'heading-keyframe-heading';
      pathId: string;
      headingKeyframeId: string;
    }
  | {
      kind: 'rmin-handle';
      pathId: string;
      sectionIndex: number;
      center: GeometryPoint;
    }
  | { kind: 'section'; pathId: string; sectionIndex: number }
  | { kind: 'background-image' }
  | { kind: 'canvas' };

type ResolveStageHitParams = {
  workspace: Workspace;
  stage: Konva.Stage;
  resolvedPaths: ResolvedPathModel[];
  discretizedByPath: Map<string, DiscretizedPath>;
  rMinDragTargets: RMinDragTarget[];
};

type CandidateHit = {
  distance: number;
  hit: HitTarget;
};

const getPointerScreenFromStage = (
  stage: Konva.Stage,
): GeometryPoint | null => {
  const pointerPosition = stage.getPointerPosition();
  if (pointerPosition === null) {
    return null;
  }

  return {
    x: pointerPosition.x,
    y: pointerPosition.y,
  };
};

export const getPointerWorldFromStage = (
  stage: Konva.Stage,
  canvasTransform: ViewTransform,
): GeometryPoint | null => {
  const pointerScreen = getPointerScreenFromStage(stage);
  if (pointerScreen === null) {
    return null;
  }

  return screenToWorld(pointerScreen, canvasTransform);
};

const pushCircularHit = (params: {
  hits: CandidateHit[];
  pointerWorld: GeometryPoint;
  center: GeometryPoint;
  radius: number;
  hit: HitTarget;
}): void => {
  const candidateDistance = distance(params.pointerWorld, params.center);
  if (candidateDistance > params.radius) {
    return;
  }

  params.hits.push({
    distance: candidateDistance,
    hit: params.hit,
  });
};

const selectNearestHit = (hits: CandidateHit[]): HitTarget | null => {
  if (hits.length === 0) {
    return null;
  }

  const firstHit = hits[0];
  if (firstHit === undefined) {
    return null;
  }

  return hits.reduce<CandidateHit>((best, current) => {
    return current.distance < best.distance ? current : best;
  }, firstHit).hit;
};

const isPointInsideBackgroundImage = (
  point: GeometryPoint,
  backgroundImage: BackgroundImage,
): boolean => {
  const width = backgroundImage.width * backgroundImage.scale;
  const height = backgroundImage.height * backgroundImage.scale;

  return (
    point.x >= backgroundImage.x &&
    point.x <= backgroundImage.x + width &&
    point.y >= backgroundImage.y &&
    point.y <= backgroundImage.y + height
  );
};

const resolveActivePathContext = (
  workspace: Workspace,
  resolvedPaths: ResolvedPathModel[],
  discretizedByPath: Map<string, DiscretizedPath>,
): {
  activePath: ResolvedPathModel | null;
  detail: DiscretizedPath | undefined;
} => {
  const activePath =
    resolvedPaths.find((path) => path.id === workspace.activePathId) ?? null;
  if (activePath?.visible !== true) {
    return {
      activePath: null,
      detail: undefined,
    };
  }

  return {
    activePath,
    detail: discretizedByPath.get(activePath.id),
  };
};

const resolveHeadingKeyframeHit = (params: {
  activePath: ResolvedPathModel;
  detail: DiscretizedPath | undefined;
  pointerWorld: GeometryPoint;
  workspace: Workspace;
}): HitTarget | null => {
  if (params.detail === undefined) {
    return null;
  }

  const headingHandleDistance = getHeadingHandleDistance(
    params.workspace.canvasTransform.k,
  );
  const modeAllowsHeadingHandle = params.workspace.mode === 'heading';
  const hits: CandidateHit[] = [];

  for (const headingKeyframe of resolveDiscretizedHeadingKeyframes(
    params.activePath,
    params.detail,
  )) {
    if (modeAllowsHeadingHandle) {
      pushCircularHit({
        hits,
        pointerWorld: params.pointerWorld,
        center: pointFromHeading(
          headingKeyframe,
          headingKeyframe.robotHeading,
          headingHandleDistance,
        ),
        radius: 7 / params.workspace.canvasTransform.k,
        hit: {
          kind: 'heading-keyframe-heading',
          pathId: params.activePath.id,
          headingKeyframeId: headingKeyframe.id,
        },
      });
    }

    pushCircularHit({
      hits,
      pointerWorld: params.pointerWorld,
      center: { x: headingKeyframe.x, y: headingKeyframe.y },
      radius: 9 / params.workspace.canvasTransform.k,
      hit: {
        kind: 'heading-keyframe',
        pathId: params.activePath.id,
        headingKeyframeId: headingKeyframe.id,
      },
    });
  }

  return selectNearestHit(hits);
};

const resolveWaypointHit = (params: {
  activePath: ResolvedPathModel;
  detail: DiscretizedPath | undefined;
  pointerWorld: GeometryPoint;
  workspace: Workspace;
}): HitTarget | null => {
  const headingHandleDistance = getHeadingHandleDistance(
    params.workspace.canvasTransform.k,
  );
  const modeAllowsRobotHeading = params.workspace.mode === 'heading';
  const hits: CandidateHit[] = [];

  for (const [
    waypointIndex,
    waypoint,
  ] of params.activePath.waypoints.entries()) {
    if (modeAllowsRobotHeading) {
      const effectiveRobotHeading = resolveWaypointRobotHeadingHandleAngle(
        params.activePath,
        params.detail,
        waypointIndex,
      );
      pushCircularHit({
        hits,
        pointerWorld: params.pointerWorld,
        center: pointFromHeading(
          waypoint,
          effectiveRobotHeading,
          headingHandleDistance,
        ),
        radius: 7 / params.workspace.canvasTransform.k,
        hit: {
          kind: 'robot-heading',
          pathId: params.activePath.id,
          waypointId: waypoint.id,
        },
      });
    }

    pushCircularHit({
      hits,
      pointerWorld: params.pointerWorld,
      center: pointFromHeading(
        waypoint,
        waypoint.pathHeading,
        headingHandleDistance,
      ),
      radius: 7 / params.workspace.canvasTransform.k,
      hit: {
        kind: 'path-heading',
        pathId: params.activePath.id,
        waypointId: waypoint.id,
      },
    });

    pushCircularHit({
      hits,
      pointerWorld: params.pointerWorld,
      center: { x: waypoint.x, y: waypoint.y },
      radius: 10 / params.workspace.canvasTransform.k,
      hit: {
        kind: 'waypoint',
        pathId: params.activePath.id,
        waypointId: waypoint.id,
      },
    });
  }

  return selectNearestHit(hits);
};

const resolveRMinHit = (params: {
  pointerWorld: GeometryPoint;
  workspace: Workspace;
  rMinDragTargets: RMinDragTarget[];
}): HitTarget | null => {
  const hits: CandidateHit[] = [];

  for (const target of params.rMinDragTargets) {
    pushCircularHit({
      hits,
      pointerWorld: params.pointerWorld,
      center: target.center,
      radius: 8 / params.workspace.canvasTransform.k,
      hit: {
        kind: 'rmin-handle',
        pathId: target.pathId,
        sectionIndex: target.sectionIndex,
        center: target.center,
      },
    });
  }

  return selectNearestHit(hits);
};

const resolveSectionHit = (params: {
  activePath: ResolvedPathModel;
  detail: DiscretizedPath | undefined;
  pointerWorld: GeometryPoint;
  workspace: Workspace;
}): HitTarget | null => {
  if (params.detail === undefined) {
    return null;
  }

  const projected = projectPointToSectionSamples(
    params.detail,
    params.pointerWorld,
  );
  if (
    projected === null ||
    projected.distanceToPoint > 7 / params.workspace.canvasTransform.k
  ) {
    return null;
  }

  return {
    kind: 'section',
    pathId: params.activePath.id,
    sectionIndex: projected.sectionIndex,
  };
};

export const resolveStageHit = ({
  workspace,
  stage,
  resolvedPaths,
  discretizedByPath,
  rMinDragTargets,
}: ResolveStageHitParams): HitTarget => {
  const pointerWorld = getPointerWorldFromStage(
    stage,
    workspace.canvasTransform,
  );
  if (pointerWorld === null) {
    return { kind: 'canvas' };
  }

  if (
    workspace.tool === 'edit-image' &&
    workspace.backgroundImage !== null &&
    isPointInsideBackgroundImage(pointerWorld, workspace.backgroundImage)
  ) {
    return { kind: 'background-image' };
  }

  const { activePath, detail } = resolveActivePathContext(
    workspace,
    resolvedPaths,
    discretizedByPath,
  );

  if (activePath !== null) {
    const headingKeyframeHit = resolveHeadingKeyframeHit({
      activePath,
      detail,
      pointerWorld,
      workspace,
    });
    if (headingKeyframeHit !== null) {
      return headingKeyframeHit;
    }

    const waypointHit = resolveWaypointHit({
      activePath,
      detail,
      pointerWorld,
      workspace,
    });
    if (waypointHit !== null) {
      return waypointHit;
    }

    const rMinHit = resolveRMinHit({
      pointerWorld,
      workspace,
      rMinDragTargets,
    });
    if (rMinHit !== null) {
      return rMinHit;
    }

    const sectionHit = resolveSectionHit({
      activePath,
      detail,
      pointerWorld,
      workspace,
    });
    if (sectionHit !== null) {
      return sectionHit;
    }
  }

  return { kind: 'canvas' };
};
