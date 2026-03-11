import { useEffect, useMemo } from 'react';
import type { PathModel, Point } from '../../domain/models';
import { useWorkspaceActions } from '../../store/workspaceStore';
import {
  useActivePathId,
  useLockedPointIds,
  usePaths,
  usePoints,
  useSelectedLibraryPointId,
  useSelectedWaypoint,
} from '../../store/workspaceSelectors';

export type LibraryPointListItem = {
  id: string;
  name: string;
  x: number;
  y: number;
  robotHeading: number | null;
  usageCount: number;
  isLocked: boolean;
};

export type LibraryPointDraft = {
  name: string;
  x: number | null;
  y: number | null;
  robotHeading: number | null;
};

const DEFAULT_DRAFT: LibraryPointDraft = {
  name: '',
  x: null,
  y: null,
  robotHeading: null,
};

const listLibraryPoints = (points: Point[]): Point[] => {
  return points.filter((point) => point.isLibrary);
};

export const countLibraryPointUsages = (
  paths: PathModel[],
): Map<string, number> => {
  const usageCounts = new Map<string, number>();

  for (const path of paths) {
    for (const waypoint of path.waypoints) {
      if (waypoint.libraryPointId === null) {
        continue;
      }

      usageCounts.set(
        waypoint.libraryPointId,
        (usageCounts.get(waypoint.libraryPointId) ?? 0) + 1,
      );
    }
  }

  return usageCounts;
};

export const usePointLibrary = () => {
  const {
    addLibraryPoint,
    deleteLibraryPoint,
    insertLibraryWaypointAtEndOfPath,
    setSelectedLibraryPointId,
    toggleLibraryPointLock,
    updateLibraryPoint,
  } = useWorkspaceActions();
  const activePathId = useActivePathId();
  const points = usePoints();
  const paths = usePaths();
  const lockedPointIds = useLockedPointIds();
  const selectedWaypoint = useSelectedWaypoint();
  const selectedLibraryPointId = useSelectedLibraryPointId();

  const items = useMemo<LibraryPointListItem[]>(() => {
    const usageCounts = countLibraryPointUsages(paths);

    return listLibraryPoints(points).map((point) => ({
      id: point.id,
      name: point.name,
      x: point.x,
      y: point.y,
      robotHeading: point.robotHeading,
      usageCount: usageCounts.get(point.id) ?? 0,
      isLocked: lockedPointIds.includes(point.id),
    }));
  }, [lockedPointIds, paths, points]);

  const highlightedLibraryPointId = selectedWaypoint?.libraryPointId ?? null;

  useEffect(() => {
    const isSelectedStillValid =
      selectedLibraryPointId !== null &&
      items.some((item) => item.id === selectedLibraryPointId);

    if (isSelectedStillValid) {
      return;
    }

    const fallbackId = highlightedLibraryPointId ?? items[0]?.id ?? null;

    if (fallbackId !== selectedLibraryPointId) {
      setSelectedLibraryPointId(fallbackId);
    }
  }, [
    highlightedLibraryPointId,
    items,
    selectedLibraryPointId,
    setSelectedLibraryPointId,
  ]);

  const createPoint = (draft: LibraryPointDraft): string | null => {
    const createdId = addLibraryPoint({
      name: draft.name,
      x: draft.x ?? 0,
      y: draft.y ?? 0,
      robotHeading: draft.robotHeading,
    });

    setSelectedLibraryPointId(createdId);
    return createdId;
  };

  const selectPoint = (pointId: string): void => {
    setSelectedLibraryPointId(pointId);
  };

  const updatePointItem = (
    pointId: string,
    patch: Partial<
      Pick<LibraryPointListItem, 'name' | 'x' | 'y' | 'robotHeading'>
    >,
  ): void => {
    updateLibraryPoint(pointId, patch);
  };

  const insertPointIntoPath = (pointId: string): void => {
    insertLibraryWaypointAtEndOfPath(pointId, activePathId);
  };

  const deletePoint = (pointId: string): void => {
    const item = items.find((candidate) => candidate.id === pointId);
    if (item === undefined) {
      return;
    }

    if (item.usageCount > 0) {
      const confirmed =
        typeof globalThis.confirm === 'function'
          ? globalThis.confirm(
              `${item.name} を削除すると ${item.usageCount} 個の linked waypoint が Library から外れます。続行しますか？`,
            )
          : true;
      if (!confirmed) {
        return;
      }
    }

    deleteLibraryPoint(pointId);
  };

  const togglePointLock = (pointId: string): void => {
    toggleLibraryPointLock(pointId);
  };

  return {
    items,
    selectedLibraryPointId,
    highlightedLibraryPointId,
    createPoint,
    selectPoint,
    updatePointItem,
    insertPointIntoPath,
    deletePoint,
    togglePointLock,
    defaultDraft: DEFAULT_DRAFT,
  };
};
