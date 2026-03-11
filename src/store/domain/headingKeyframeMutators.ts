import { createHeadingKeyframe } from '../../domain/models';
import type { HeadingKeyframe } from '../../domain/models';
import { normalizeOptionalName } from '../../domain/naming';
import type { DomainState } from '../types';
import {
  appendHeadingKeyframe,
  findHeadingKeyframe,
  nextHeadingKeyframeName,
  removeHeadingKeyframe,
  updatePath,
} from './shared';

type HeadingKeyframePatch = Partial<Omit<HeadingKeyframe, 'id'>>;

const isNoOp = (
  keyframe: HeadingKeyframe,
  patch: HeadingKeyframePatch,
): boolean => {
  return (
    (patch.sectionIndex === undefined ||
      patch.sectionIndex === keyframe.sectionIndex) &&
    (patch.sectionRatio === undefined ||
      patch.sectionRatio === keyframe.sectionRatio) &&
    (patch.robotHeading === undefined ||
      patch.robotHeading === keyframe.robotHeading) &&
    (patch.name === undefined ||
      normalizeOptionalName(patch.name) ===
        normalizeOptionalName(keyframe.name))
  );
};

export const addHeadingKeyframe = (
  domain: DomainState,
  pathId: string,
  keyframe: HeadingKeyframe,
): DomainState => {
  return updatePath(domain, pathId, (path) =>
    appendHeadingKeyframe(path, {
      ...keyframe,
      name:
        normalizeOptionalName(keyframe.name) ?? nextHeadingKeyframeName(path),
    }),
  );
};

export const createAndAddHeadingKeyframe = (
  domain: DomainState,
  input: {
    pathId: string;
    sectionIndex: number;
    sectionRatio: number;
    robotHeading: number;
  },
): { domain: DomainState; headingKeyframeId: string | null } => {
  const path = domain.paths.find((candidate) => candidate.id === input.pathId);
  if (path === undefined || path.waypoints.length < 2) {
    return { domain, headingKeyframeId: null };
  }

  const keyframe = createHeadingKeyframe({
    sectionIndex: input.sectionIndex,
    sectionRatio: input.sectionRatio,
    robotHeading: input.robotHeading,
    name: nextHeadingKeyframeName(path),
  });

  return {
    domain: addHeadingKeyframe(domain, input.pathId, keyframe),
    headingKeyframeId: keyframe.id,
  };
};

export const updateHeadingKeyframe = (
  domain: DomainState,
  pathId: string,
  headingKeyframeId: string,
  patch: HeadingKeyframePatch,
): DomainState => {
  const keyframe = findHeadingKeyframe(domain, pathId, headingKeyframeId);
  if (keyframe === undefined || isNoOp(keyframe, patch)) {
    return domain;
  }

  return updatePath(domain, pathId, (path) => ({
    ...path,
    headingKeyframes: path.headingKeyframes.map((candidate) => {
      if (candidate.id !== headingKeyframeId) {
        return candidate;
      }

      const nextName =
        patch.name === undefined
          ? candidate.name
          : (normalizeOptionalName(patch.name) ?? candidate.name);

      return {
        ...candidate,
        ...patch,
        name: nextName,
      };
    }),
  }));
};

export const deleteHeadingKeyframe = (
  domain: DomainState,
  pathId: string,
  headingKeyframeId: string,
): DomainState => {
  return updatePath(domain, pathId, (path) =>
    removeHeadingKeyframe(path, headingKeyframeId),
  );
};
