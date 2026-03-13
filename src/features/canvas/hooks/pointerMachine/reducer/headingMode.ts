import {
  getPreviousHeadingKeyframe,
  projectPointToPathSections,
  resolveDiscretizedHeadingKeyframes,
} from '../../../../../domain/headingKeyframes';
import { makeId } from '../../../../../domain/factories';
import {
  findResolvedWaypointContext,
  findWaypointWithPoint,
  resolveHeadingKeyframeAnchor,
  resolveHeadingKeyframePreview,
  resolveHeadingWithModifiers,
} from '../geometry';
import { resolveContinuousDragStateOnMove } from '../transitionUtils';
import type {
  DraggingHeadingKeyframeHeadingState,
  DraggingHeadingKeyframeState,
  DraggingRobotHeadingState,
  PointerSnapshot,
  TransitionResult,
} from '../types';
import { capturePointerEffect, EMPTY_GUIDE, idleState, result } from './shared';

export const reduceSectionPointerDown = (
  snapshot: PointerSnapshot,
  sectionHit: Extract<PointerSnapshot['hit'], { kind: 'section' }>,
): TransitionResult => {
  const { workspace } = snapshot;

  if (workspace.mode === 'path') {
    return result(idleState(), [
      {
        kind: 'path.select-section',
        pathId: sectionHit.pathId,
        sectionIndex: sectionHit.sectionIndex,
      },
    ]);
  }

  if (workspace.tool !== 'add-point' || snapshot.world === null) {
    return result(idleState());
  }

  const preview = resolveHeadingKeyframePreview({
    workspace,
    resolvedPaths: snapshot.resolvedPaths,
    discretizedByPath: snapshot.discretizedByPath,
    source: snapshot.world,
  });
  if (preview?.kind !== 'heading-keyframe') {
    return result(idleState());
  }

  const headingKeyframeId = makeId();

  return result(
    {
      kind: 'dragging-heading-keyframe-heading',
      pathId: workspace.activePathId,
      headingKeyframeId,
      anchor: preview.point,
      startScreenX: snapshot.clientX,
      startScreenY: snapshot.clientY,
      hasMoved: false,
      origin: 'add-point',
    },
    [
      {
        kind: 'command.execute-add-heading-keyframe',
        params: {
          pathId: workspace.activePathId,
          headingKeyframeId,
          sectionIndex: preview.sectionIndex,
          sectionRatio: preview.sectionRatio,
          robotHeading: preview.robotHeading,
        },
      },
      { kind: 'local.set-add-point-preview', preview: null },
      capturePointerEffect(snapshot),
    ],
  );
};

export const reduceRobotHeadingPointerDown = (
  snapshot: PointerSnapshot,
  hit: Extract<PointerSnapshot['hit'], { kind: 'robot-heading' }>,
): TransitionResult => {
  if (snapshot.workspace.mode !== 'heading') {
    return result(idleState());
  }

  const resolved = findWaypointWithPoint(
    snapshot.workspace,
    hit.pathId,
    hit.waypointId,
  );
  if (resolved === null) {
    return result(idleState());
  }

  return result(
    {
      kind: 'dragging-robot-heading',
      pathId: hit.pathId,
      waypointId: hit.waypointId,
      anchor: { x: resolved.point.x, y: resolved.point.y },
      startScreenX: snapshot.clientX,
      startScreenY: snapshot.clientY,
      hasMoved: false,
    },
    [capturePointerEffect(snapshot)],
  );
};

export const reduceHeadingKeyframePointerDown = (
  snapshot: PointerSnapshot,
  hit: Extract<PointerSnapshot['hit'], { kind: 'heading-keyframe' }>,
): TransitionResult => {
  if (snapshot.workspace.mode !== 'heading') {
    return result(idleState());
  }

  return result(
    {
      kind: 'dragging-heading-keyframe',
      pathId: hit.pathId,
      headingKeyframeId: hit.headingKeyframeId,
      startScreenX: snapshot.clientX,
      startScreenY: snapshot.clientY,
      hasMoved: false,
    },
    [capturePointerEffect(snapshot)],
  );
};

export const reduceHeadingKeyframeHeadingPointerDown = (
  snapshot: PointerSnapshot,
  hit: Extract<PointerSnapshot['hit'], { kind: 'heading-keyframe-heading' }>,
): TransitionResult => {
  if (snapshot.workspace.mode !== 'heading') {
    return result(idleState());
  }

  const anchor = resolveHeadingKeyframeAnchor(
    snapshot.resolvedPaths,
    snapshot.discretizedByPath,
    hit.pathId,
    hit.headingKeyframeId,
  );
  if (anchor === null) {
    return result(idleState());
  }

  return result(
    {
      kind: 'dragging-heading-keyframe-heading',
      pathId: hit.pathId,
      headingKeyframeId: hit.headingKeyframeId,
      anchor,
      startScreenX: snapshot.clientX,
      startScreenY: snapshot.clientY,
      hasMoved: false,
      origin: 'existing',
    },
    [capturePointerEffect(snapshot)],
  );
};

export const reduceRobotHeadingMove = (
  state: DraggingRobotHeadingState,
  snapshot: PointerSnapshot,
): TransitionResult => {
  const movedState = resolveContinuousDragStateOnMove({ state, snapshot });
  if (movedState === null || snapshot.world === null) {
    return result(state);
  }

  const context = findResolvedWaypointContext(
    snapshot.resolvedPaths,
    state.pathId,
    state.waypointId,
  );
  const heading = resolveHeadingWithModifiers({
    origin: state.anchor,
    target: snapshot.world,
    previousHeadingDeg: context.previousHeadingDeg,
    previousPoint: context.previousPoint,
    previousSegmentStart: context.previousSegmentStart,
    settings: snapshot.snapSettings,
    shiftKey: snapshot.shiftKey,
    altKey: snapshot.altKey,
  });

  return result(movedState, [
    { kind: 'local.set-add-point-preview', preview: null },
    { kind: 'local.set-snap-guide', guide: heading.guide },
    {
      kind: 'heading.update-waypoint-robot-heading',
      pathId: state.pathId,
      waypointId: state.waypointId,
      robotHeading: heading.angle,
    },
  ]);
};

export const reduceHeadingKeyframeMove = (
  state: DraggingHeadingKeyframeState,
  snapshot: PointerSnapshot,
): TransitionResult => {
  const movedState = resolveContinuousDragStateOnMove({ state, snapshot });
  if (movedState === null || snapshot.world === null) {
    return result(state);
  }

  const detail = snapshot.discretizedByPath.get(state.pathId);
  if (detail === undefined) {
    return result(state);
  }

  const projected = projectPointToPathSections(detail, snapshot.world);
  if (projected === null) {
    return result(state);
  }

  return result(movedState, [
    { kind: 'local.set-add-point-preview', preview: null },
    { kind: 'local.set-snap-guide', guide: EMPTY_GUIDE },
    {
      kind: 'heading.update-heading-keyframe-position',
      pathId: state.pathId,
      headingKeyframeId: state.headingKeyframeId,
      sectionIndex: projected.sectionIndex,
      sectionRatio: projected.sectionRatio,
    },
  ]);
};

export const reduceHeadingKeyframeHeadingMove = (
  state: DraggingHeadingKeyframeHeadingState,
  snapshot: PointerSnapshot,
): TransitionResult => {
  const movedState = resolveContinuousDragStateOnMove({ state, snapshot });
  if (movedState === null || snapshot.world === null) {
    return result(state);
  }

  const path = snapshot.resolvedPaths.find(
    (candidate) => candidate.id === state.pathId,
  );
  const detail = snapshot.discretizedByPath.get(state.pathId);
  if (path === undefined || detail === undefined) {
    return result(state);
  }

  const keyframes = resolveDiscretizedHeadingKeyframes(path, detail);
  const current = keyframes.find((item) => item.id === state.headingKeyframeId);
  const previous =
    current === undefined
      ? null
      : getPreviousHeadingKeyframe(
          keyframes.filter((item) => item.id !== current.id),
          current.sectionIndex,
          current.sectionRatio,
        );
  const heading = resolveHeadingWithModifiers({
    origin: state.anchor,
    target: snapshot.world,
    previousHeadingDeg: previous?.robotHeading ?? null,
    previousPoint: previous === null ? null : { x: previous.x, y: previous.y },
    previousSegmentStart: null,
    settings: snapshot.snapSettings,
    shiftKey: snapshot.shiftKey,
    altKey: snapshot.altKey,
  });

  return result(movedState, [
    { kind: 'local.set-add-point-preview', preview: null },
    { kind: 'local.set-snap-guide', guide: heading.guide },
    {
      kind: 'heading.update-heading-keyframe-heading',
      pathId: state.pathId,
      headingKeyframeId: state.headingKeyframeId,
      robotHeading: heading.angle,
    },
  ]);
};
