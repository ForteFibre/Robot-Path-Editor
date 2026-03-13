import type { HeadingKeyframe, PathModel, Point, Waypoint } from './models';

const DEFAULT_PATH_COLORS = [
  '#1f77b4',
  '#ff7f0e',
  '#2ca02c',
  '#9467bd',
  '#d62728',
];

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
    color: DEFAULT_PATH_COLORS[index % DEFAULT_PATH_COLORS.length] ?? '#1f77b4',
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
