import { useCallback, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { WorkspaceAutosaveSource } from '../../store/adapters/workspacePersistence';
import { selectWorkspaceAutosaveSource } from '../../store/workspaceSelectors';
import { useWorkspaceStore } from '../../store/workspaceStore';

const hasSelectionChanged = (
  left: WorkspaceAutosaveSource['selection'],
  right: WorkspaceAutosaveSource['selection'],
): boolean => {
  return (
    left.pathId !== right.pathId ||
    left.waypointId !== right.waypointId ||
    left.headingKeyframeId !== right.headingKeyframeId ||
    left.sectionIndex !== right.sectionIndex
  );
};

const hasCanvasTransformChanged = (
  left: WorkspaceAutosaveSource['canvasTransform'],
  right: WorkspaceAutosaveSource['canvasTransform'],
): boolean => {
  return left.x !== right.x || left.y !== right.y || left.k !== right.k;
};

const hasBackgroundImageChanged = (
  left: WorkspaceAutosaveSource['backgroundImage'],
  right: WorkspaceAutosaveSource['backgroundImage'],
): boolean => {
  if (left === right) {
    return false;
  }

  if (left === null || right === null) {
    return left !== right;
  }

  return (
    left.url !== right.url ||
    left.width !== right.width ||
    left.height !== right.height ||
    left.x !== right.x ||
    left.y !== right.y ||
    left.scale !== right.scale ||
    left.alpha !== right.alpha
  );
};

const hasRobotSettingsChanged = (
  left: WorkspaceAutosaveSource['robotSettings'],
  right: WorkspaceAutosaveSource['robotSettings'],
): boolean => {
  return (
    left.length !== right.length ||
    left.width !== right.width ||
    left.acceleration !== right.acceleration ||
    left.deceleration !== right.deceleration ||
    left.maxVelocity !== right.maxVelocity ||
    left.centripetalAcceleration !== right.centripetalAcceleration
  );
};

const hasPersistedWorkspaceSliceChanged = (
  left: WorkspaceAutosaveSource,
  right: WorkspaceAutosaveSource,
): boolean => {
  return (
    left.domain !== right.domain ||
    left.mode !== right.mode ||
    left.tool !== right.tool ||
    hasSelectionChanged(left.selection, right.selection) ||
    hasCanvasTransformChanged(left.canvasTransform, right.canvasTransform) ||
    hasBackgroundImageChanged(left.backgroundImage, right.backgroundImage) ||
    left.robotPreviewEnabled !== right.robotPreviewEnabled ||
    hasRobotSettingsChanged(left.robotSettings, right.robotSettings)
  );
};

type UseWorkspaceAutosaveTrackingResult = {
  trackedSource: WorkspaceAutosaveSource;
  hasTrackedChange: boolean;
  getLatestTrackedSource: () => WorkspaceAutosaveSource;
  syncTrackedState: () => void;
};

export const useWorkspaceAutosaveTracking =
  (): UseWorkspaceAutosaveTrackingResult => {
    const trackedSource = useWorkspaceStore(
      useShallow(selectWorkspaceAutosaveSource),
    );
    const trackedSliceRef = useRef<WorkspaceAutosaveSource>(trackedSource);
    const latestTrackedSliceRef =
      useRef<WorkspaceAutosaveSource>(trackedSource);
    const hasTrackedChange = hasPersistedWorkspaceSliceChanged(
      trackedSliceRef.current,
      trackedSource,
    );

    const getLatestTrackedSource = useCallback((): WorkspaceAutosaveSource => {
      return latestTrackedSliceRef.current;
    }, []);

    const syncTrackedState = useCallback((): void => {
      trackedSliceRef.current = latestTrackedSliceRef.current;
    }, []);

    useEffect(() => {
      latestTrackedSliceRef.current = trackedSource;

      if (
        hasPersistedWorkspaceSliceChanged(
          trackedSliceRef.current,
          trackedSource,
        )
      ) {
        trackedSliceRef.current = trackedSource;
      }
    }, [trackedSource]);

    useEffect(() => {
      const unsubscribe = useWorkspaceStore.subscribe((state) => {
        latestTrackedSliceRef.current = selectWorkspaceAutosaveSource(state);
      });

      return () => {
        unsubscribe();
      };
    }, []);

    return {
      trackedSource,
      hasTrackedChange,
      getLatestTrackedSource,
      syncTrackedState,
    };
  };
