import {
  computeDubinsArcCentersForPath,
  type DubinsCenters,
} from '../../../../domain/dubins';
import {
  resolveSectionDubins,
  resolveSectionRMin,
} from '../../../../domain/sectionRadius';
import type { SelectionState } from '../../../../domain/models';
import type { ResolvedPathModel } from '../../../../domain/pointResolution';
import type { RMinDragTarget } from '../../types/rMinDragTarget';

type ResolveSceneRMinDragTargetsParams = {
  paths: ResolvedPathModel[];
  selection: SelectionState;
  draggingWaypointId: string | null;
  draggingPathId: string | null;
};

const resolveSectionCenters = (
  path: ResolvedPathModel,
  sectionIndex: number,
): DubinsCenters | null => {
  const start = path.waypoints[sectionIndex];
  const end = path.waypoints[sectionIndex + 1];
  if (start === undefined || end === undefined) {
    return null;
  }

  const rMin = resolveSectionRMin(path, sectionIndex);
  if (rMin === null) {
    return null;
  }

  const resolved = resolveSectionDubins(
    start,
    end,
    path.sectionRMin[sectionIndex] ?? null,
  );
  if (resolved === null) {
    return null;
  }

  return computeDubinsArcCentersForPath(
    { x: start.x, y: start.y, headingDeg: start.pathHeading },
    resolved.path,
    resolved.turningRadius,
  );
};

const mapCentersToTargets = (
  path: ResolvedPathModel,
  centers: DubinsCenters | null,
  sectionIndex: number,
): RMinDragTarget[] => {
  if (centers === null) {
    return [];
  }

  const start = path.waypoints[sectionIndex];
  const end = path.waypoints[sectionIndex + 1];
  if (start === undefined || end === undefined) {
    return [];
  }

  const rMin = resolveSectionRMin(path, sectionIndex);
  if (rMin === null) {
    return [];
  }

  const isAuto =
    path.sectionRMin[sectionIndex] === null ||
    path.sectionRMin[sectionIndex] === undefined;

  const results: RMinDragTarget[] = [];

  if (centers.startCenter !== undefined) {
    results.push({
      pathId: path.id,
      sectionIndex,
      center: centers.startCenter,
      waypointPoint: { x: start.x, y: start.y },
      rMin,
      isAuto,
    });
  }

  if (centers.endCenter !== undefined) {
    results.push({
      pathId: path.id,
      sectionIndex,
      center: centers.endCenter,
      waypointPoint: { x: end.x, y: end.y },
      rMin,
      isAuto,
    });
  }

  return results;
};

const createTargetKey = (target: RMinDragTarget): string => {
  return `${target.sectionIndex}-${target.center.x.toFixed(6)}-${target.center.y.toFixed(6)}`;
};

export const resolveSceneRMinDragTargets = ({
  paths,
  selection,
  draggingWaypointId,
  draggingPathId,
}: ResolveSceneRMinDragTargetsParams): RMinDragTarget[] => {
  const targetPathId = selection.pathId ?? draggingPathId;
  if (targetPathId === null) {
    return [];
  }

  const targetPath = paths.find((path) => path.id === targetPathId);
  if (targetPath === undefined || targetPath.waypoints.length < 2) {
    return [];
  }

  const getSectionTargets = (sectionIndex: number): RMinDragTarget[] => {
    return mapCentersToTargets(
      targetPath,
      resolveSectionCenters(targetPath, sectionIndex),
      sectionIndex,
    );
  };

  if (selection.sectionIndex !== null) {
    return getSectionTargets(selection.sectionIndex);
  }

  const waypointIds = new Set<string>();
  if (selection.waypointId !== null) {
    waypointIds.add(selection.waypointId);
  }
  if (draggingWaypointId !== null) {
    waypointIds.add(draggingWaypointId);
  }

  if (waypointIds.size === 0) {
    return [];
  }

  const results: RMinDragTarget[] = [];
  const existingKeys = new Set<string>();

  const addUniqueTargets = (targets: RMinDragTarget[]): void => {
    for (const target of targets) {
      const key = createTargetKey(target);
      if (existingKeys.has(key)) {
        continue;
      }

      existingKeys.add(key);
      results.push(target);
    }
  };

  for (const waypointId of waypointIds) {
    const waypointIndex = targetPath.waypoints.findIndex(
      (waypoint) => waypoint.id === waypointId,
    );
    if (waypointIndex < 0) {
      continue;
    }

    if (waypointIndex > 0) {
      addUniqueTargets(getSectionTargets(waypointIndex - 1));
    }

    if (waypointIndex < targetPath.waypoints.length - 1) {
      addUniqueTargets(getSectionTargets(waypointIndex));
    }
  }

  return results;
};
