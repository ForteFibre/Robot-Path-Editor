import type { PathModel } from '../../domain/models';

const getPathDisplayName = (name: string): string => {
  return name.trim().length > 0 ? name : 'Untitled Path';
};

const comparePathNames = (left: string, right: string): number => {
  return getPathDisplayName(left).localeCompare(
    getPathDisplayName(right),
    'ja',
  );
};

export const sortPathsByDisplayName = (paths: PathModel[]): PathModel[] => {
  return [...paths].sort((left, right) =>
    comparePathNames(left.name, right.name),
  );
};
