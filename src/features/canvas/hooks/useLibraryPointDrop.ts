import { useEffect, useMemo, useState, type RefObject } from 'react';
import type Konva from 'konva';
import type { CanvasTransform } from '../../../domain/canvasTransform';
import type { EditorMode, PathModel } from '../../../domain/models';
import type { DiscretizedPath } from '../../../domain/interpolation';
import type { ResolvedPathModel } from '../../../domain/pointResolution';
import { resolveDropInsertionAfterWaypointId } from '../dropInsertion';
import { getPointerWorldFromStage } from './canvasHitTesting';

export type LibraryDropPreview = {
  isActive: boolean;
  label: string | null;
};

const INACTIVE_DROP_PREVIEW: LibraryDropPreview = {
  isActive: false,
  label: null,
};

type InsertLibraryWaypointInput = {
  pathId: string;
  x: number;
  y: number;
  libraryPointId?: string;
  linkToLibrary?: boolean;
  coordinateSource?: 'input' | 'library';
  afterWaypointId?: string | null;
};

type UseLibraryPointDropParams = {
  canvasHostRef: RefObject<HTMLElement | null>;
  stageRef: RefObject<Konva.Stage | null>;
  mode: EditorMode;
  activePath: PathModel | null;
  resolvedPaths: ResolvedPathModel[];
  discretizedByPathForInteraction: Map<string, DiscretizedPath>;
  canvasTransform: CanvasTransform;
  insertLibraryWaypoint: (input: InsertLibraryWaypointInput) => string | null;
};

export const useLibraryPointDrop = ({
  canvasHostRef,
  stageRef,
  mode,
  activePath,
  resolvedPaths,
  discretizedByPathForInteraction,
  canvasTransform,
  insertLibraryWaypoint,
}: UseLibraryPointDropParams): {
  libraryDropPreview: LibraryDropPreview;
} => {
  const [libraryDropPreview, setLibraryDropPreview] =
    useState<LibraryDropPreview>(INACTIVE_DROP_PREVIEW);

  const activeResolvedPath = useMemo(() => {
    if (activePath === null) {
      return null;
    }

    return resolvedPaths.find((path) => path.id === activePath.id) ?? null;
  }, [activePath, resolvedPaths]);

  useEffect(() => {
    if (mode !== 'path') {
      setLibraryDropPreview(INACTIVE_DROP_PREVIEW);
    }
  }, [mode]);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (host === null) {
      return;
    }

    const resetPreview = (): void => {
      setLibraryDropPreview(INACTIVE_DROP_PREVIEW);
    };

    const handleNativeDragEnter = (event: DragEvent): void => {
      if (mode !== 'path') {
        return;
      }

      const label = event.dataTransfer?.getData(
        'application/x-point-library-name',
      );

      if (label === undefined) {
        return;
      }

      setLibraryDropPreview({
        isActive: true,
        label: label.length > 0 ? label : null,
      });
    };

    const handleNativeDragOver = (event: DragEvent): void => {
      if (mode !== 'path') {
        return;
      }

      event.preventDefault();
      if (event.dataTransfer !== null) {
        event.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleNativeDragLeave = (): void => {
      resetPreview();
    };

    const handleNativeDrop = (event: DragEvent): void => {
      resetPreview();

      if (
        mode !== 'path' ||
        activePath === null ||
        event.dataTransfer === null
      ) {
        return;
      }

      event.preventDefault();

      const libraryPointId = event.dataTransfer.getData(
        'application/x-point-library-id',
      );
      if (libraryPointId.length === 0) {
        return;
      }

      const stage = stageRef.current;
      if (stage === null) {
        return;
      }

      stage.setPointersPositions(event);
      const world = getPointerWorldFromStage(stage, canvasTransform);
      if (world === null) {
        return;
      }

      const afterWaypointId = resolveDropInsertionAfterWaypointId({
        activePath: activeResolvedPath,
        detail: discretizedByPathForInteraction.get(activePath.id),
        worldPoint: world,
      });

      const insertInput: InsertLibraryWaypointInput = {
        pathId: activePath.id,
        libraryPointId,
        x: world.x,
        y: world.y,
        linkToLibrary: true,
        coordinateSource: 'library',
      };

      if (afterWaypointId !== undefined) {
        insertInput.afterWaypointId = afterWaypointId;
      }

      insertLibraryWaypoint(insertInput);
    };

    host.addEventListener('dragenter', handleNativeDragEnter);
    host.addEventListener('dragover', handleNativeDragOver);
    host.addEventListener('dragleave', handleNativeDragLeave);
    host.addEventListener('drop', handleNativeDrop);

    return () => {
      host.removeEventListener('dragenter', handleNativeDragEnter);
      host.removeEventListener('dragover', handleNativeDragOver);
      host.removeEventListener('dragleave', handleNativeDragLeave);
      host.removeEventListener('drop', handleNativeDrop);
    };
  }, [
    activePath,
    activeResolvedPath,
    canvasHostRef,
    canvasTransform,
    discretizedByPathForInteraction,
    insertLibraryWaypoint,
    mode,
    stageRef,
  ]);

  return {
    libraryDropPreview,
  };
};
