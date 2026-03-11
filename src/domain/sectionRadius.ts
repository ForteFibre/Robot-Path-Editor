import { type DubinsEndpoint } from './dubins';
import {
  computeAutoSectionDubinsPath,
  isStraightSection,
  resolveSectionDubinsPath,
  type SectionDubinsPath,
} from './sectionDubins';

export type SectionRadiusValue = number | null;

type SectionRadiusWaypoint = {
  x: number;
  y: number;
  pathHeading: number;
};

type SectionRadiusPath<TWaypoint extends SectionRadiusWaypoint> = {
  waypoints: readonly TWaypoint[];
  sectionRMin: readonly (number | null)[];
};

const toEndpoint = (waypoint: SectionRadiusWaypoint): DubinsEndpoint => {
  return {
    x: waypoint.x,
    y: waypoint.y,
    headingDeg: waypoint.pathHeading,
  };
};

const normalizeManualSectionRMin = (
  value: number | null | undefined,
): SectionRadiusValue => {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
};

export const resolveSectionDubins = (
  start: SectionRadiusWaypoint,
  end: SectionRadiusWaypoint,
  manualRadius: number | null,
): SectionDubinsPath | null => {
  return resolveSectionDubinsPath(
    toEndpoint(start),
    toEndpoint(end),
    normalizeManualSectionRMin(manualRadius),
  );
};

export const computeSectionRMax = (
  start: SectionRadiusWaypoint,
  end: SectionRadiusWaypoint,
): SectionRadiusValue => {
  const auto = computeAutoSectionDubinsPath(toEndpoint(start), toEndpoint(end));
  return auto?.turningRadius ?? null;
};

export const resolveSectionRMin = <TWaypoint extends SectionRadiusWaypoint>(
  path: SectionRadiusPath<TWaypoint>,
  sectionIndex: number,
): SectionRadiusValue => {
  const start = path.waypoints[sectionIndex];
  const end = path.waypoints[sectionIndex + 1];

  if (start === undefined || end === undefined) {
    return null;
  }

  if (isStraightSection(toEndpoint(start), toEndpoint(end))) {
    return null;
  }

  return (
    resolveSectionDubins(start, end, path.sectionRMin[sectionIndex] ?? null)
      ?.turningRadius ?? null
  );
};
