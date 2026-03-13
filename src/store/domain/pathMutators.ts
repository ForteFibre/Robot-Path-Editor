import { createPath } from '../../domain/factories';
import { createPointIndex } from '../../domain/pointResolution';
import type { DomainState } from '../types';
import { normalizeWorkspaceDomainState as normalizeDomainState } from '../../domain/workspaceNormalization';
import { duplicatePathModel, updatePath } from './structure';

export const addPath = (domain: DomainState): DomainState => {
  const newPath = createPath(domain.paths.length);

  return normalizeDomainState({
    ...domain,
    paths: [...domain.paths, newPath],
    activePathId: newPath.id,
  });
};

export const duplicatePath = (
  domain: DomainState,
  pathId: string,
): DomainState => {
  const source = domain.paths.find((path) => path.id === pathId);
  if (source === undefined) {
    return domain;
  }

  const duplicated = duplicatePathModel(
    source,
    domain.paths.length,
    createPointIndex(domain.points),
  );

  return normalizeDomainState({
    ...domain,
    paths: [...domain.paths, duplicated.path],
    points: [...domain.points, ...duplicated.points],
    activePathId: duplicated.path.id,
  });
};

export const deletePath = (
  domain: DomainState,
  pathId: string,
): DomainState => {
  if (domain.paths.length <= 1) {
    return domain;
  }

  const paths = domain.paths.filter((path) => path.id !== pathId);
  const activePath =
    paths.find((path) => path.id === domain.activePathId) ?? paths[0];

  if (activePath === undefined) {
    return domain;
  }

  return normalizeDomainState({
    ...domain,
    paths,
    activePathId: activePath.id,
  });
};

export const renamePath = (
  domain: DomainState,
  pathId: string,
  name: string,
): DomainState => {
  return updatePath(domain, pathId, (path) => ({
    ...path,
    name,
  }));
};

export const recolorPath = (
  domain: DomainState,
  pathId: string,
  color: string,
): DomainState => {
  return updatePath(domain, pathId, (path) => ({
    ...path,
    color,
  }));
};

export const togglePathVisible = (
  domain: DomainState,
  pathId: string,
): DomainState => {
  return updatePath(domain, pathId, (path) => ({
    ...path,
    visible: !path.visible,
  }));
};

export const setActivePath = (
  domain: DomainState,
  pathId: string,
): DomainState => {
  if (!domain.paths.some((path) => path.id === pathId)) {
    return domain;
  }

  return {
    ...domain,
    activePathId: pathId,
  };
};
