import { MIN_RENDER_STEP } from '../domain/metricScale';
import { distance, toRadians } from '../domain/geometry';
import { discretizePathDetailed } from '../domain/interpolation';
import type { Point } from '../domain/models';
import {
  createPointIndex,
  resolvePathModel,
  type ResolvedPathModel,
} from '../domain/pointResolution';
import {
  resolveSectionPositionSample,
  type DiscretizedPath,
} from '../domain/pathSampling';
import { resolveSectionDubins } from '../domain/sectionRadius';
import { isStraightSection } from '../domain/sectionDubins';
import type { WorkspaceDomainState } from '../domain/workspaceContract';

export type LineCommand = {
  type: 'line';
  distance: number;
};

export type ArcCommand = {
  type: 'arc';
  radius: number;
  turn_angle: number;
};

export type MotionCommand = LineCommand | ArcCommand;

export type RobotHeadingKeyframe = {
  progress: number;
  heading: number;
};

export type Section = {
  from: string;
  to: string;
  path_heading_start: number;
  motion: MotionCommand[];
  robot_heading?: RobotHeadingKeyframe[];
};

export type PathDef = {
  sections: Section[];
};

export type PointDef = {
  x: number;
  y: number;
  robot_heading: number;
};

export type PathSetV1 = {
  $schema: 'https://fibril-path-editor.fortefibre.net/schemas/path-set-v1.schema.json';
  schema_version: 1;
  units: {
    length: 'm';
    angle: 'rad';
  };
  points: Record<string, PointDef>;
  paths: Record<string, PathDef>;
};

const MIN_COMMAND_VALUE = 1e-9;

const sanitizeName = (name: string): string => {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : 'unnamed';
};

const buildPointIdToPathNameMap = (
  domain: WorkspaceDomainState,
): Map<string, string> => {
  const map = new Map<string, string>();
  for (const path of domain.paths) {
    for (const waypoint of path.waypoints) {
      if (waypoint.libraryPointId !== null) {
        continue;
      }
      const point = domain.points.find((p) => p.id === waypoint.pointId);
      if (point !== undefined && !map.has(point.id)) {
        map.set(point.id, path.name);
      }
    }
  }
  return map;
};

const resolvePointExportName = (
  point: Point,
  libraryPoint: Point | null,
  pathName: string,
): string => {
  if (libraryPoint !== null) {
    return sanitizeName(libraryPoint.name);
  }
  return `${sanitizeName(pathName)}/${sanitizeName(point.name)}`;
};

const buildMotionCommands = (
  start: { x: number; y: number; pathHeading: number },
  end: { x: number; y: number; pathHeading: number },
  manualRMin: number | null,
): MotionCommand[] => {
  const startEndpoint = {
    x: start.x,
    y: start.y,
    headingDeg: start.pathHeading,
  };
  const endEndpoint = {
    x: end.x,
    y: end.y,
    headingDeg: end.pathHeading,
  };

  if (isStraightSection(startEndpoint, endEndpoint)) {
    const dist = distance(start, end);
    if (dist > MIN_COMMAND_VALUE) {
      return [{ type: 'line', distance: dist }];
    }
    return [];
  }

  const dubinsResult = resolveSectionDubins(start, end, manualRMin);
  if (dubinsResult === null) {
    const dist = distance(start, end);
    if (dist > MIN_COMMAND_VALUE) {
      return [{ type: 'line', distance: dist }];
    }
    return [];
  }

  const commands: MotionCommand[] = [];
  for (let i = 0; i < dubinsResult.path.segmentTypes.length; i++) {
    const segType = dubinsResult.path.segmentTypes[i];
    const param = dubinsResult.path.params[i];
    if (segType === undefined || param === undefined) {
      continue;
    }
    if (Math.abs(param) < MIN_COMMAND_VALUE) {
      continue;
    }

    if (segType === 'S') {
      const dist = param * dubinsResult.turningRadius;
      if (dist > MIN_COMMAND_VALUE) {
        commands.push({ type: 'line', distance: dist });
      }
    } else if (segType === 'L') {
      commands.push({
        type: 'arc',
        radius: dubinsResult.turningRadius,
        turn_angle: param,
      });
    } else {
      commands.push({
        type: 'arc',
        radius: dubinsResult.turningRadius,
        turn_angle: -param,
      });
    }
  }
  return commands;
};

const buildRobotHeadingProfile = (
  robotHeadingDetail: DiscretizedPath,
  resolvedPath: ResolvedPathModel,
  sectionIndex: number,
): RobotHeadingKeyframe[] => {
  const start = resolveSectionPositionSample(
    robotHeadingDetail,
    sectionIndex,
    0,
  );
  const end = resolveSectionPositionSample(robotHeadingDetail, sectionIndex, 1);
  if (start === null || end === null) {
    return [];
  }

  const keyframes: RobotHeadingKeyframe[] = [];

  keyframes.push({
    progress: 0,
    heading: toRadians(start.robotHeading),
  });

  keyframes.push({
    progress: 1,
    heading: toRadians(end.robotHeading),
  });

  for (const keyframe of resolvedPath.headingKeyframes) {
    if (keyframe.sectionIndex === sectionIndex) {
      keyframes.push({
        progress: keyframe.sectionRatio,
        heading: toRadians(keyframe.robotHeading),
      });
    }
  }

  const map = new Map<number, number>();
  for (const kf of keyframes) {
    map.set(kf.progress, kf.heading);
  }

  return Array.from(map.entries())
    .map(([progress, heading]) => ({ progress, heading }))
    .sort((a, b) => a.progress - b.progress);
};

const resolveWaypointRobotHeading = (
  robotHeadingDetail: DiscretizedPath,
  resolvedPath: ResolvedPathModel,
  waypointIndex: number,
): number | null => {
  if (resolvedPath.waypoints.length === 0) {
    return null;
  }

  if (resolvedPath.waypoints.length === 1) {
    return robotHeadingDetail.samples[0]?.robotHeading ?? null;
  }

  if (waypointIndex === 0) {
    return (
      resolveSectionPositionSample(robotHeadingDetail, 0, 0)?.robotHeading ??
      null
    );
  }

  return (
    resolveSectionPositionSample(robotHeadingDetail, waypointIndex - 1, 1)
      ?.robotHeading ?? null
  );
};

export const generatePathSetV1 = (domain: WorkspaceDomainState): PathSetV1 => {
  const points: Record<string, PointDef> = {};
  const paths: Record<string, PathDef> = {};
  const pointsById = createPointIndex(domain.points);
  const pointIdToPathName = buildPointIdToPathNameMap(domain);
  const processedPointIds = new Set<string>();

  for (const path of domain.paths) {
    const resolvedPath = resolvePathModel(path, pointsById);
    const robotHeadingDetail = discretizePathDetailed(
      path,
      domain.points,
      MIN_RENDER_STEP,
    );
    const sections: Section[] = [];

    for (let i = 0; i < resolvedPath.waypoints.length - 1; i++) {
      const start = resolvedPath.waypoints[i];
      const end = resolvedPath.waypoints[i + 1];
      if (start === undefined || end === undefined) {
        continue;
      }

      const fromName = resolvePointExportName(
        start.point,
        start.libraryPoint,
        pointIdToPathName.get(start.point.id) ?? path.name,
      );
      const toName = resolvePointExportName(
        end.point,
        end.libraryPoint,
        pointIdToPathName.get(end.point.id) ?? path.name,
      );

      const motion = buildMotionCommands(
        start,
        end,
        path.sectionRMin[i] ?? null,
      );
      if (motion.length === 0) {
        continue;
      }

      const robotHeading = buildRobotHeadingProfile(
        robotHeadingDetail,
        resolvedPath,
        i,
      );

      sections.push({
        from: fromName,
        to: toName,
        path_heading_start: toRadians(start.pathHeading),
        motion,
        robot_heading: robotHeading,
      });
    }

    for (const [waypointIndex, waypoint] of resolvedPath.waypoints.entries()) {
      if (processedPointIds.has(waypoint.point.id)) {
        continue;
      }
      processedPointIds.add(waypoint.point.id);

      const name = resolvePointExportName(
        waypoint.point,
        waypoint.libraryPoint,
        pointIdToPathName.get(waypoint.point.id) ?? path.name,
      );
      const effectivePoint = waypoint.libraryPoint ?? waypoint.point;
      points[name] = {
        x: effectivePoint.x,
        y: effectivePoint.y,
        robot_heading: toRadians(
          resolveWaypointRobotHeading(
            robotHeadingDetail,
            resolvedPath,
            waypointIndex,
          ) ?? waypoint.pathHeading,
        ),
      };
    }

    if (sections.length > 0) {
      paths[sanitizeName(path.name)] = { sections };
    }
  }

  return {
    $schema:
      'https://fibril-path-editor.fortefibre.net/schemas/path-set-v1.schema.json',
    schema_version: 1,
    units: { length: 'm', angle: 'rad' },
    points,
    paths,
  };
};
