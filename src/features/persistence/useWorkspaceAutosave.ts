import { useCallback, useEffect, useRef, useState } from 'react';
import { saveWorkspacePersistence } from '../../io/workspacePersistence';
import {
  getWorkspacePersistedState,
  useWorkspaceStore,
  type WorkspaceStoreState,
} from '../../store/workspaceStore';
import {
  createIdleWorkspaceAutosaveState,
  type WorkspaceAutosaveState,
} from './types';

const DEFAULT_AUTOSAVE_DEBOUNCE_MS = 600;
const AUTOSAVE_ERROR_PREFIX = '自動保存に失敗しました。';

type PersistedWorkspaceSlice = {
  domain: WorkspaceStoreState['domain'];
  mode: WorkspaceStoreState['ui']['mode'];
  tool: WorkspaceStoreState['ui']['tool'];
  selection: WorkspaceStoreState['ui']['selection'];
  canvasTransform: WorkspaceStoreState['ui']['canvasTransform'];
  backgroundImage: WorkspaceStoreState['ui']['backgroundImage'];
  robotPreviewEnabled: WorkspaceStoreState['ui']['robotPreviewEnabled'];
  robotSettings: WorkspaceStoreState['ui']['robotSettings'];
};

type UseWorkspaceAutosaveOptions = {
  isSuppressed: boolean;
  debounceMs?: number;
  initialSavedAt?: number | null;
  saveWorkspace?: typeof saveWorkspacePersistence;
};

type UseWorkspaceAutosaveResult = {
  autosaveState: WorkspaceAutosaveState;
  cancelPendingSave: () => void;
  syncTrackedState: () => void;
  saveNow: () => Promise<{ savedAt: number }>;
  setIdleState: (savedAt: number | null) => void;
};

const selectPersistedWorkspaceSlice = (
  state: WorkspaceStoreState,
): PersistedWorkspaceSlice => {
  return {
    domain: state.domain,
    mode: state.ui.mode,
    tool: state.ui.tool,
    selection: state.ui.selection,
    canvasTransform: state.ui.canvasTransform,
    backgroundImage: state.ui.backgroundImage,
    robotPreviewEnabled: state.ui.robotPreviewEnabled,
    robotSettings: state.ui.robotSettings,
  };
};

const hasSelectionChanged = (
  left: PersistedWorkspaceSlice['selection'],
  right: PersistedWorkspaceSlice['selection'],
): boolean => {
  return (
    left.pathId !== right.pathId ||
    left.waypointId !== right.waypointId ||
    left.headingKeyframeId !== right.headingKeyframeId ||
    left.sectionIndex !== right.sectionIndex
  );
};

const hasCanvasTransformChanged = (
  left: PersistedWorkspaceSlice['canvasTransform'],
  right: PersistedWorkspaceSlice['canvasTransform'],
): boolean => {
  return left.x !== right.x || left.y !== right.y || left.k !== right.k;
};

const hasBackgroundImageChanged = (
  left: PersistedWorkspaceSlice['backgroundImage'],
  right: PersistedWorkspaceSlice['backgroundImage'],
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
  left: PersistedWorkspaceSlice['robotSettings'],
  right: PersistedWorkspaceSlice['robotSettings'],
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
  left: PersistedWorkspaceSlice,
  right: PersistedWorkspaceSlice,
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

const toAutosaveErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.length > 0) {
    return `${AUTOSAVE_ERROR_PREFIX} (${error.message})`;
  }

  return AUTOSAVE_ERROR_PREFIX;
};

export const useWorkspaceAutosave = ({
  isSuppressed,
  debounceMs = DEFAULT_AUTOSAVE_DEBOUNCE_MS,
  initialSavedAt = null,
  saveWorkspace = saveWorkspacePersistence,
}: UseWorkspaceAutosaveOptions): UseWorkspaceAutosaveResult => {
  const [autosaveState, setAutosaveState] = useState<WorkspaceAutosaveState>(
    () => createIdleWorkspaceAutosaveState(initialSavedAt),
  );
  const trackedSliceRef = useRef<PersistedWorkspaceSlice>(
    selectPersistedWorkspaceSlice(useWorkspaceStore.getState()),
  );
  const suppressionRef = useRef(isSuppressed);
  const saveWorkspaceRef = useRef(saveWorkspace);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPendingSave = useCallback((): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const syncTrackedState = useCallback((): void => {
    cancelPendingSave();
    trackedSliceRef.current = selectPersistedWorkspaceSlice(
      useWorkspaceStore.getState(),
    );
  }, [cancelPendingSave]);

  const setIdleState = useCallback(
    (savedAt: number | null): void => {
      cancelPendingSave();
      setAutosaveState(createIdleWorkspaceAutosaveState(savedAt));
    },
    [cancelPendingSave],
  );

  const saveNow = useCallback(async (): Promise<{ savedAt: number }> => {
    cancelPendingSave();
    setAutosaveState((current) => ({
      kind: 'saving',
      savedAt: current.savedAt,
      message: null,
    }));

    try {
      const result = await saveWorkspaceRef.current(
        getWorkspacePersistedState(),
      );
      trackedSliceRef.current = selectPersistedWorkspaceSlice(
        useWorkspaceStore.getState(),
      );
      setAutosaveState(createIdleWorkspaceAutosaveState(result.savedAt));
      return result;
    } catch (error: unknown) {
      setAutosaveState((current) => ({
        kind: 'error',
        savedAt: current.savedAt,
        message: toAutosaveErrorMessage(error),
      }));
      throw error;
    }
  }, [cancelPendingSave]);

  const scheduleSave = useCallback((): void => {
    if (suppressionRef.current) {
      return;
    }

    cancelPendingSave();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void saveNow().catch(() => undefined);
    }, debounceMs);
  }, [cancelPendingSave, debounceMs, saveNow]);

  useEffect(() => {
    suppressionRef.current = isSuppressed;

    if (isSuppressed) {
      cancelPendingSave();
    }
  }, [cancelPendingSave, isSuppressed]);

  useEffect(() => {
    saveWorkspaceRef.current = saveWorkspace;
  }, [saveWorkspace]);

  useEffect(() => {
    trackedSliceRef.current = selectPersistedWorkspaceSlice(
      useWorkspaceStore.getState(),
    );

    const unsubscribe = useWorkspaceStore.subscribe((state) => {
      const nextTrackedSlice = selectPersistedWorkspaceSlice(state);

      if (
        !hasPersistedWorkspaceSliceChanged(
          trackedSliceRef.current,
          nextTrackedSlice,
        )
      ) {
        return;
      }

      trackedSliceRef.current = nextTrackedSlice;

      if (suppressionRef.current) {
        return;
      }

      scheduleSave();
    });

    return () => {
      unsubscribe();
      cancelPendingSave();
    };
  }, [cancelPendingSave, scheduleSave]);

  return {
    autosaveState,
    cancelPendingSave,
    syncTrackedState,
    saveNow,
    setIdleState,
  };
};
