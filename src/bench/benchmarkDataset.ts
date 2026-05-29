import type { WorkspaceDocument } from '../domain/workspaceContract';
import type { PathModel, Point, RobotMotionSettings } from '../domain/models';
import { DEFAULT_ROBOT_MOTION_SETTINGS } from '../domain/modelNormalization';

const DEFAULT_PATH_COUNT = 18;
const DEFAULT_WAYPOINTS_PER_PATH = 42;
const DEFAULT_LIBRARY_POINT_COUNT = 160;

const createPoint = (params: {
  id: string;
  name: string;
  x: number;
  y: number;
  isLibrary?: boolean;
  robotHeading?: number | null;
}): Point => {
  return {
    id: params.id,
    name: params.name,
    x: params.x,
    y: params.y,
    isLibrary: params.isLibrary ?? false,
    robotHeading: params.robotHeading ?? null,
  };
};

const createLibraryPoints = (count: number): Point[] => {
  return Array.from({ length: count }, (_value, index) => {
    return createPoint({
      id: `library-point-${index}`,
      name: `Library ${index + 1}`,
      x: Math.sin(index / 7) * 18 + (index % 8) * 0.7,
      y: Math.cos(index / 9) * 15 + Math.floor(index / 8) * 0.9,
      isLibrary: true,
      robotHeading: (index * 19) % 360,
    });
  });
};

const createPathPoints = (params: {
  pathIndex: number;
  waypointCount: number;
  libraryPoints: Point[];
}): { points: Point[]; path: PathModel } => {
  const pathPoints: Point[] = [];
  const waypoints: PathModel['waypoints'] = [];
  const headingKeyframes: PathModel['headingKeyframes'] = [];
  const sectionRMin: (number | null)[] = [];

  for (
    let waypointIndex = 0;
    waypointIndex < params.waypointCount;
    waypointIndex += 1
  ) {
    const t = waypointIndex / Math.max(1, params.waypointCount - 1);
    const x =
      params.pathIndex * 1.6 +
      waypointIndex * 0.85 +
      Math.sin((params.pathIndex + 1) * t * Math.PI * 2) * 1.4;
    const y =
      Math.cos(t * Math.PI * 2.4 + params.pathIndex * 0.35) *
        (4 + params.pathIndex * 0.12) +
      params.pathIndex * 2.3;
    const pointId = `path-${params.pathIndex}-point-${waypointIndex}`;
    const linkedLibraryPoint =
      waypointIndex % 5 === 0
        ? (params.libraryPoints[
            (params.pathIndex * params.waypointCount + waypointIndex) %
              params.libraryPoints.length
          ] ?? null)
        : null;

    if (linkedLibraryPoint !== null) {
      pathPoints.push(
        createPoint({
          id: pointId,
          name: linkedLibraryPoint.name,
          x: linkedLibraryPoint.x,
          y: linkedLibraryPoint.y,
          robotHeading: linkedLibraryPoint.robotHeading,
        }),
      );
    } else {
      pathPoints.push(
        createPoint({
          id: pointId,
          name: `P${params.pathIndex + 1}-WP${waypointIndex + 1}`,
          x,
          y,
          robotHeading:
            waypointIndex % 3 === 0
              ? (params.pathIndex * 17 + waypointIndex * 11) % 360
              : null,
        }),
      );
    }

    waypoints.push({
      id: `path-${params.pathIndex}-waypoint-${waypointIndex}`,
      pointId,
      libraryPointId: linkedLibraryPoint?.id ?? null,
      pathHeading: ((waypointIndex + params.pathIndex) * 13) % 360,
    });

    if (waypointIndex < params.waypointCount - 1) {
      sectionRMin.push(
        waypointIndex % 4 === 0 ? 0.8 + (waypointIndex % 6) * 0.12 : null,
      );
    }

    if (waypointIndex < params.waypointCount - 1 && waypointIndex % 3 === 1) {
      headingKeyframes.push({
        id: `path-${params.pathIndex}-heading-${headingKeyframes.length}`,
        sectionIndex: waypointIndex,
        sectionRatio: 0.5,
        robotHeading: ((params.pathIndex + 1) * 23 + waypointIndex * 9) % 360,
        name: `H${headingKeyframes.length + 1}`,
      });
    }
  }

  return {
    points: pathPoints,
    path: {
      id: `path-${params.pathIndex}`,
      name: `Path ${params.pathIndex + 1}`,
      color: `hsl(${(params.pathIndex * 37) % 360} 70% 55%)`,
      visible: true,
      waypoints,
      headingKeyframes,
      sectionRMin,
    },
  };
};

const createRobotSettings = (): RobotMotionSettings => {
  return {
    ...DEFAULT_ROBOT_MOTION_SETTINGS,
  };
};

export const createBenchmarkWorkspaceDocument = (): WorkspaceDocument => {
  const libraryPoints = createLibraryPoints(DEFAULT_LIBRARY_POINT_COUNT);
  const points = [...libraryPoints];
  const paths: PathModel[] = [];

  for (let pathIndex = 0; pathIndex < DEFAULT_PATH_COUNT; pathIndex += 1) {
    const pathData = createPathPoints({
      pathIndex,
      waypointCount: DEFAULT_WAYPOINTS_PER_PATH,
      libraryPoints,
    });
    points.push(...pathData.points);
    paths.push(pathData.path);
  }

  return {
    domain: {
      paths,
      points,
      lockedPointIds: libraryPoints
        .filter((_point, index) => index % 6 === 0)
        .map((point) => point.id),
      activePathId: paths[0]?.id ?? 'path-0',
    },
    backgroundImage: null,
    robotSettings: createRobotSettings(),
  };
};
