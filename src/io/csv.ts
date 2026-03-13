import { discretizePath } from '../domain/interpolation';
import { toRadians } from '../domain/geometry';
import {
  DEFAULT_CSV_EXPORT_STEP,
  MIN_CSV_EXPORT_STEP,
  formatMetricValue,
} from '../domain/metricScale';
import type { CsvWorkspaceSource } from '../domain/workspaceContract';

export const csvHeader = 'x,y,theta';

export type CsvTarget = 'all' | 'active';

export type CsvExportOptions = {
  step?: number;
  target?: CsvTarget;
};

export type CsvExportFile = {
  pathId: string;
  pathName: string;
  filename: string;
  content: string;
};

const formatNumber = (value: number | null): string => {
  if (value === null) {
    return '';
  }

  return formatMetricValue(value);
};

const slugifyPathName = (pathName: string): string => {
  const slug = pathName
    .normalize('NFKD')
    .toLowerCase()
    .trim()
    .replaceAll(/\s+/g, '-')
    .replaceAll(/[^a-z0-9-]/g, '')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-+|-+$/g, '');

  return slug.length > 0 ? slug : 'path';
};

const createPathFilename = (
  pathName: string,
  filenameCounts: Map<string, number>,
): string => {
  const baseName = slugifyPathName(pathName);
  const nextCount = (filenameCounts.get(baseName) ?? 0) + 1;
  filenameCounts.set(baseName, nextCount);

  return nextCount === 1 ? `${baseName}.csv` : `${baseName}-${nextCount}.csv`;
};

export const generateWorkspaceCsvFiles = (
  domain: CsvWorkspaceSource,
  options?: CsvExportOptions,
): CsvExportFile[] => {
  const step = Math.max(
    MIN_CSV_EXPORT_STEP,
    options?.step ?? DEFAULT_CSV_EXPORT_STEP,
  );
  const target = options?.target ?? 'all';
  const files: CsvExportFile[] = [];
  const filenameCounts = new Map<string, number>();

  const targetPathIds =
    target === 'active' ? new Set([domain.activePathId]) : null;

  for (const path of domain.paths) {
    if (targetPathIds !== null && !targetPathIds.has(path.id)) {
      continue;
    }

    if (path.waypoints.length === 0) {
      continue;
    }

    const samples = discretizePath(path, domain.points, step);
    const lines = [csvHeader];

    for (const sample of samples) {
      lines.push(
        [
          formatNumber(sample.x),
          formatNumber(sample.y),
          formatNumber(toRadians(sample.robotHeading)),
        ].join(','),
      );
    }

    files.push({
      pathId: path.id,
      pathName: path.name,
      filename: createPathFilename(path.name, filenameCounts),
      content: `${lines.join('\n')}\n`,
    });
  }

  return files;
};
