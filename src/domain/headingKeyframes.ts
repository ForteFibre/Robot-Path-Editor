import { type Point } from './geometry';
import {
  type ResolvedHeadingKeyframe,
  type ResolvedPathModel,
} from './pointResolution';
import {
  buildCumulativeDistances,
  getSectionPolylineBetweenRatios,
  projectPointToSectionSamples,
  resolveSectionPositionSample,
  type DiscretizedPath,
  type HeadingSample,
} from './pathSampling';

export type PathSectionPosition = {
  sectionIndex: number;
  sectionRatio: number;
};

export type ProjectedHeadingKeyframe = ResolvedHeadingKeyframe & {
  cumulativeDistance: number;
};

export type HeadingKeyframeRange = {
  sectionIndex: number;
  startRatio: number;
  endRatio: number;
  robotHeadingStart: number;
  robotHeadingEnd: number;
};

export const resolveDiscretizedHeadingKeyframes = (
  path: ResolvedPathModel,
  detail: DiscretizedPath,
): ResolvedHeadingKeyframe[] => {
  return path.headingKeyframes
    .map((keyframe) => {
      const position = resolveSectionPositionSample(
        detail,
        keyframe.sectionIndex,
        keyframe.sectionRatio,
      );
      if (position === null) {
        return null;
      }

      return {
        ...keyframe,
        x: position.x,
        y: position.y,
        pathHeading: position.pathHeading,
      };
    })
    .filter(
      (keyframe): keyframe is ResolvedHeadingKeyframe => keyframe !== null,
    );
};

export const getSectionPositionPoint = (
  detail: DiscretizedPath,
  position: PathSectionPosition,
): (Point & { pathHeading: number }) | null => {
  const resolved = resolveSectionPositionSample(
    detail,
    position.sectionIndex,
    position.sectionRatio,
  );
  if (resolved === null) {
    return null;
  }

  return {
    x: resolved.x,
    y: resolved.y,
    pathHeading: resolved.pathHeading,
  };
};

export const projectPointToPathSections = (
  detail: DiscretizedPath,
  point: Point,
): PathSectionPosition | null => {
  const projected = projectPointToSectionSamples(detail, point);
  if (projected === null) {
    return null;
  }

  return {
    sectionIndex: projected.sectionIndex,
    sectionRatio: projected.sectionRatio,
  };
};

export const projectHeadingKeyframesToSamples = (
  detail: DiscretizedPath,
  keyframes: ResolvedHeadingKeyframe[],
): ProjectedHeadingKeyframe[] => {
  if (detail.samples.length === 0 || keyframes.length === 0) {
    return [];
  }

  const cumulativeDistances = buildCumulativeDistances(detail.samples);

  return keyframes
    .map((keyframe) => {
      const resolved = resolveSectionPositionSample(
        detail,
        keyframe.sectionIndex,
        keyframe.sectionRatio,
        cumulativeDistances,
      );

      return {
        ...keyframe,
        cumulativeDistance: resolved?.cumulativeDistance ?? 0,
      };
    })
    .sort((a, b) => {
      if (a.sectionIndex !== b.sectionIndex) {
        return a.sectionIndex - b.sectionIndex;
      }

      if (a.sectionRatio !== b.sectionRatio) {
        return a.sectionRatio - b.sectionRatio;
      }

      return a.name.localeCompare(b.name);
    });
};

export const buildHeadingKeyframeRanges = (
  keyframes: ResolvedHeadingKeyframe[],
): HeadingKeyframeRange[] => {
  const ranges: HeadingKeyframeRange[] = [];

  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const start = keyframes[index];
    const end = keyframes[index + 1];
    if (start === undefined || end === undefined) {
      continue;
    }

    if (start.sectionIndex !== end.sectionIndex) {
      continue;
    }

    ranges.push({
      sectionIndex: start.sectionIndex,
      startRatio: start.sectionRatio,
      endRatio: end.sectionRatio,
      robotHeadingStart: start.robotHeading,
      robotHeadingEnd: end.robotHeading,
    });
  }

  return ranges;
};

export const getHeadingKeyframeRangePolyline = (
  detail: DiscretizedPath,
  range: HeadingKeyframeRange,
): HeadingSample[] => {
  return getSectionPolylineBetweenRatios(
    detail,
    range.sectionIndex,
    range.startRatio,
    range.endRatio,
  );
};

export const getPreviousHeadingKeyframe = (
  keyframes: ResolvedHeadingKeyframe[],
  sectionIndex: number,
  sectionRatio: number,
): ResolvedHeadingKeyframe | null => {
  const sorted = [...keyframes].sort((a, b) => {
    if (a.sectionIndex !== b.sectionIndex) {
      return a.sectionIndex - b.sectionIndex;
    }

    return a.sectionRatio - b.sectionRatio;
  });

  let previous: ResolvedHeadingKeyframe | null = null;

  for (const keyframe of sorted) {
    if (keyframe.sectionIndex > sectionIndex) {
      break;
    }

    if (
      keyframe.sectionIndex === sectionIndex &&
      keyframe.sectionRatio > sectionRatio
    ) {
      break;
    }

    previous = keyframe;
  }

  return previous;
};
