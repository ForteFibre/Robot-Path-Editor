import {
  discretizePathDetailed,
  resolveDiscretizedHeadingKeyframes,
} from '../../domain/interpolation';
import type {
  ResolvedHeadingKeyframe,
  ResolvedPathModel,
  ResolvedWaypoint,
} from '../../domain/pointResolution';
import { resolveSectionRMin } from '../../domain/sectionRadius';
import type { PathModel, Point, SelectionState } from '../../domain/models';

export type SectionSelection = {
  index: number;
  start: { x: number; y: number };
  end: { x: number; y: number };
  manualRMin: number | null;
  effectiveRMin: number;
  sliderMax: number;
};

export type WaypointSelection = ResolvedWaypoint & {
  interpolatedRobotHeading: number;
  linkedWaypointCount: number;
};

export type HeadingKeyframeSelection = ResolvedHeadingKeyframe;

const resolveSelectedPath = (
  resolvedPaths: ResolvedPathModel[],
  pathId: string | null,
): ResolvedPathModel | null => {
  if (pathId === null) {
    return null;
  }

  return resolvedPaths.find((path) => path.id === pathId) ?? null;
};

const resolveSelectedPathInput = (
  rawPaths: PathModel[],
  selectedPath: ResolvedPathModel | null,
  pathId: string | null,
): PathModel | ResolvedPathModel | null => {
  if (pathId === null) {
    return null;
  }

  return rawPaths.find((path) => path.id === pathId) ?? selectedPath;
};

const resolveSelectedDetail = (
  selectedPathInput: PathModel | ResolvedPathModel | null,
  points: Point[],
): ReturnType<typeof discretizePathDetailed> | null => {
  if (selectedPathInput === null) {
    return null;
  }

  return discretizePathDetailed(selectedPathInput as PathModel, points, 0.1);
};

const resolveWaypointSampleIndex = (
  detail: ReturnType<typeof discretizePathDetailed> | null,
  waypointIndex: number,
): number => {
  if (detail === null) {
    return -1;
  }

  if (waypointIndex <= 0) {
    return 0;
  }

  return (
    detail.sectionSampleRanges[waypointIndex - 1]?.endSampleIndex ??
    detail.samples.length - 1
  );
};

const countLinkedWaypoints = (
  paths: PathModel[],
  libraryPointId: string | null,
): number => {
  if (libraryPointId === null) {
    return 0;
  }

  return paths.reduce((count, path) => {
    return (
      count +
      path.waypoints.filter(
        (waypoint) => waypoint.libraryPointId === libraryPointId,
      ).length
    );
  }, 0);
};

export const resolveSelectedWaypoint = (
  selectedPath: ResolvedPathModel | null,
  rawPaths: PathModel[],
  detail: ReturnType<typeof discretizePathDetailed> | null,
  waypointId: string | null,
): WaypointSelection | null => {
  if (selectedPath === null || waypointId === null) {
    return null;
  }

  const waypointIndex = selectedPath.waypoints.findIndex(
    (waypoint) => waypoint.id === waypointId,
  );
  const waypoint = selectedPath.waypoints[waypointIndex];
  if (waypoint === undefined) {
    return null;
  }

  const sampleIndex = resolveWaypointSampleIndex(detail, waypointIndex);
  const interpolatedSample =
    sampleIndex >= 0 && detail !== null
      ? detail.samples[sampleIndex]
      : undefined;

  return {
    ...waypoint,
    interpolatedRobotHeading:
      interpolatedSample?.robotHeading ?? waypoint.pathHeading,
    linkedWaypointCount: countLinkedWaypoints(
      rawPaths,
      waypoint.libraryPointId,
    ),
  };
};

export const resolveSelectedHeadingKeyframe = (
  selectedPath: ResolvedPathModel | null,
  detail: ReturnType<typeof discretizePathDetailed> | null,
  headingKeyframeId: string | null,
): HeadingKeyframeSelection | null => {
  if (selectedPath === null || detail === null || headingKeyframeId === null) {
    return null;
  }

  return (
    resolveDiscretizedHeadingKeyframes(selectedPath, detail).find(
      (keyframe) => keyframe.id === headingKeyframeId,
    ) ?? null
  );
};

export const resolveSelectedSection = (
  selectedPath: ResolvedPathModel | null,
  sectionIndex: number | null,
): SectionSelection | null => {
  if (selectedPath === null || sectionIndex === null) {
    return null;
  }

  const start = selectedPath.waypoints[sectionIndex];
  const end = selectedPath.waypoints[sectionIndex + 1];
  if (start === undefined || end === undefined) {
    return null;
  }

  const effectiveRMin = resolveSectionRMin(selectedPath, sectionIndex) ?? 1;

  return {
    index: sectionIndex,
    start,
    end,
    manualRMin: selectedPath.sectionRMin[sectionIndex] ?? null,
    effectiveRMin,
    sliderMax: Math.max(
      effectiveRMin,
      Math.hypot(end.x - start.x, end.y - start.y),
      1,
    ),
  };
};

export const resolveSelection = (
  resolvedPaths: ResolvedPathModel[],
  rawPaths: PathModel[],
  points: Point[],
  selection: SelectionState,
): {
  selectedPath: ResolvedPathModel | null;
  selectedWaypoint: WaypointSelection | null;
  selectedHeadingKeyframe: HeadingKeyframeSelection | null;
  selectedSection: SectionSelection | null;
} => {
  const selectedPath = resolveSelectedPath(resolvedPaths, selection.pathId);
  const selectedPathInput = resolveSelectedPathInput(
    rawPaths,
    selectedPath,
    selection.pathId,
  );
  const selectedDetail = resolveSelectedDetail(selectedPathInput, points);
  const selectedWaypoint = resolveSelectedWaypoint(
    selectedPath,
    rawPaths,
    selectedDetail,
    selection.waypointId,
  );
  const selectedHeadingKeyframe = resolveSelectedHeadingKeyframe(
    selectedPath,
    selectedDetail,
    selection.headingKeyframeId,
  );
  const selectedSection = resolveSelectedSection(
    selectedPath,
    selection.sectionIndex,
  );

  return {
    selectedPath,
    selectedWaypoint,
    selectedHeadingKeyframe,
    selectedSection,
  };
};

export const EMPTY_RESOLVED_SELECTION = {
  selectedPath: null,
  selectedWaypoint: null,
  selectedHeadingKeyframe: null,
  selectedSection: null,
};
