import { DEFAULT_SNAP_SETTINGS, type SnapSettings } from './snapping';
import { DEFAULT_CANVAS_SCALE } from './metricScale';

export type EditorMode = 'path' | 'heading';

export type CanvasTool = 'select' | 'add-point' | 'edit-image';

export type Point = {
  id: string;
  x: number;
  y: number;
  robotHeading: number | null;
  isLibrary: boolean;
  name: string;
};

export type Waypoint = {
  id: string;
  pointId: string;
  libraryPointId: string | null;
  pathHeading: number;
};

export type HeadingKeyframe = {
  id: string;
  sectionIndex: number;
  sectionRatio: number;
  robotHeading: number;
  name: string;
};

export type PathModel = {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  waypoints: Waypoint[];
  headingKeyframes: HeadingKeyframe[];
  sectionRMin: (number | null)[];
};

export type CanvasTransform = {
  x: number;
  y: number;
  k: number;
};

export type SelectionState = {
  pathId: string | null;
  waypointId: string | null;
  headingKeyframeId: string | null;
  sectionIndex: number | null;
};

export type BackgroundImage = {
  url: string;
  width: number;
  height: number;
  x: number;
  y: number;
  scale: number;
  alpha: number;
};

export type RobotMotionSettings = {
  length: number;
  width: number;
  acceleration: number;
  deceleration: number;
  maxVelocity: number;
  centripetalAcceleration: number;
};

export type Workspace = {
  mode: EditorMode;
  tool: CanvasTool;
  paths: PathModel[];
  points: Point[];
  lockedPointIds: string[];
  activePathId: string;
  canvasTransform: CanvasTransform;
  selection: SelectionState;
  isDragging: boolean;
  snapSettings: SnapSettings;
  snapPanelOpen: boolean;
  backgroundImage: BackgroundImage | null;
  robotPreviewEnabled: boolean;
  robotSettings: RobotMotionSettings;
};

const DEFAULT_COLORS = ['#1f77b4', '#ff7f0e', '#2ca02c', '#9467bd', '#d62728'];
const MIN_ROBOT_DIMENSION = 0.01;
const MIN_MOTION_CONSTRAINT = 0.001;

export const DEFAULT_ROBOT_MOTION_SETTINGS: RobotMotionSettings = {
  length: 0.9,
  width: 0.7,
  acceleration: 5,
  deceleration: 5,
  maxVelocity: 5,
  centripetalAcceleration: 5,
};

const normalizePositiveFinite = (
  value: number | undefined,
  fallback: number,
  minimum: number,
): number => {
  const resolvedValue = value ?? fallback;

  if (!Number.isFinite(resolvedValue)) {
    return fallback;
  }

  return Math.max(minimum, resolvedValue);
};

export const normalizeRobotMotionSettings = (
  settings?: Partial<RobotMotionSettings>,
): RobotMotionSettings => {
  return {
    length: normalizePositiveFinite(
      settings?.length,
      DEFAULT_ROBOT_MOTION_SETTINGS.length,
      MIN_ROBOT_DIMENSION,
    ),
    width: normalizePositiveFinite(
      settings?.width,
      DEFAULT_ROBOT_MOTION_SETTINGS.width,
      MIN_ROBOT_DIMENSION,
    ),
    acceleration: normalizePositiveFinite(
      settings?.acceleration,
      DEFAULT_ROBOT_MOTION_SETTINGS.acceleration,
      MIN_MOTION_CONSTRAINT,
    ),
    deceleration: normalizePositiveFinite(
      settings?.deceleration,
      DEFAULT_ROBOT_MOTION_SETTINGS.deceleration,
      MIN_MOTION_CONSTRAINT,
    ),
    maxVelocity: normalizePositiveFinite(
      settings?.maxVelocity,
      DEFAULT_ROBOT_MOTION_SETTINGS.maxVelocity,
      MIN_MOTION_CONSTRAINT,
    ),
    centripetalAcceleration: normalizePositiveFinite(
      settings?.centripetalAcceleration,
      DEFAULT_ROBOT_MOTION_SETTINGS.centripetalAcceleration,
      MIN_MOTION_CONSTRAINT,
    ),
  };
};

export const makeId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  const random = Math.random().toString(36).slice(2, 10);
  return `id-${Date.now().toString(36)}-${random}`;
};

export const createWaypoint = (partial?: Partial<Waypoint>): Waypoint => {
  return {
    id: partial?.id ?? makeId(),
    pointId: partial?.pointId ?? makeId(),
    libraryPointId: partial?.libraryPointId ?? null,
    pathHeading: partial?.pathHeading ?? 0,
  };
};

export const createPath = (index: number): PathModel => {
  return {
    id: makeId(),
    name: `Path ${index + 1}`,
    color: DEFAULT_COLORS[index % DEFAULT_COLORS.length] ?? '#1f77b4',
    visible: true,
    waypoints: [],
    headingKeyframes: [],
    sectionRMin: [],
  };
};

export const createHeadingKeyframe = (
  partial?: Partial<HeadingKeyframe>,
): HeadingKeyframe => {
  return {
    id: partial?.id ?? makeId(),
    sectionIndex: partial?.sectionIndex ?? 0,
    sectionRatio: partial?.sectionRatio ?? 0.5,
    robotHeading: partial?.robotHeading ?? 0,
    name: partial?.name ?? 'HP',
  };
};

export const createPoint = (partial?: Partial<Point>): Point => {
  return {
    id: partial?.id ?? makeId(),
    x: partial?.x ?? 0,
    y: partial?.y ?? 0,
    robotHeading: partial?.robotHeading ?? null,
    isLibrary: partial?.isLibrary ?? false,
    name: partial?.name ?? '',
  };
};

export const createLibraryPoint = (
  name: string,
  partial?: Partial<Point>,
): Point => {
  return createPoint({
    ...partial,
    isLibrary: true,
    name,
  });
};

export const normalizePathSections = (path: PathModel): PathModel => {
  const sectionCount = Math.max(0, path.waypoints.length - 1);

  const sectionRMin = Array.from({ length: sectionCount }, (_value, index) => {
    const sectionValue = path.sectionRMin[index];

    if (sectionValue === null || sectionValue === undefined) {
      return null;
    }

    if (!Number.isFinite(sectionValue)) {
      return null;
    }

    return sectionValue > 0 ? sectionValue : null;
  });

  return {
    ...path,
    headingKeyframes:
      sectionCount === 0
        ? []
        : path.headingKeyframes
            .map((keyframe) => ({
              ...keyframe,
              sectionIndex: Math.min(
                Math.max(0, keyframe.sectionIndex),
                sectionCount - 1,
              ),
              sectionRatio: Number.isFinite(keyframe.sectionRatio)
                ? Math.min(Math.max(keyframe.sectionRatio, 0), 1)
                : 0,
            }))
            .sort((a, b) => {
              if (a.sectionIndex !== b.sectionIndex) {
                return a.sectionIndex - b.sectionIndex;
              }

              if (a.sectionRatio !== b.sectionRatio) {
                return a.sectionRatio - b.sectionRatio;
              }

              return a.name.localeCompare(b.name);
            }),
    sectionRMin,
  };
};

export const initialWorkspace = (): Workspace => {
  const firstPath = createPath(0);

  return {
    mode: 'path',
    tool: 'select',
    paths: [firstPath],
    points: [],
    lockedPointIds: [],
    activePathId: firstPath.id,
    canvasTransform: {
      x: 200,
      y: 100,
      k: DEFAULT_CANVAS_SCALE,
    },
    selection: {
      pathId: firstPath.id,
      waypointId: null,
      headingKeyframeId: null,
      sectionIndex: null,
    },
    isDragging: false,
    snapSettings: DEFAULT_SNAP_SETTINGS,
    snapPanelOpen: false,
    backgroundImage: null,
    robotPreviewEnabled: true,
    robotSettings: DEFAULT_ROBOT_MOTION_SETTINGS,
  };
};
