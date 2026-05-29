import { useCallback, useEffect, useRef, useState } from 'react';
import { saveWorkspacePersistence } from '../../io/workspacePersistence';
import {
  isAppError,
  throwAppError,
  type AppError,
} from '../../errors/appError';
import { selectWorkspaceAutosaveSource } from '../../store/workspaceSelectors';
import { useWorkspaceStore } from '../../store/workspaceStore';
import {
  createIdleWorkspaceAutosaveState,
  type WorkspaceAutosaveState,
} from './types';
import { useDebouncedTask } from './useDebouncedTask';
import { hasPersistedWorkspaceSliceChanged } from './useWorkspaceAutosaveTracking';
import { persistWorkspaceAutosaveSource } from './workspaceAutosaveWriter';

const DEFAULT_AUTOSAVE_DEBOUNCE_MS = 600;

const createAutosaveWriteFailedError = (): AppError => {
  return {
    kind: 'autosave',
    reason: 'write-failed',
  };
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

export const useWorkspaceAutosave = ({
  isSuppressed,
  debounceMs = DEFAULT_AUTOSAVE_DEBOUNCE_MS,
  initialSavedAt = null,
  saveWorkspace = saveWorkspacePersistence,
}: UseWorkspaceAutosaveOptions): UseWorkspaceAutosaveResult => {
  const { cancel: cancelPendingSave, schedule } = useDebouncedTask();
  const [autosaveState, setAutosaveState] = useState<WorkspaceAutosaveState>(
    () => createIdleWorkspaceAutosaveState(initialSavedAt),
  );
  const saveWorkspaceRef = useRef(saveWorkspace);
  const trackedSourceRef = useRef(
    selectWorkspaceAutosaveSource(useWorkspaceStore.getState()),
  );
  const latestTrackedSourceRef = useRef(trackedSourceRef.current);
  const isSuppressedRef = useRef(isSuppressed);
  const scheduleSaveRef = useRef<() => void>(() => undefined);

  const getLatestTrackedSource = useCallback(() => {
    return latestTrackedSourceRef.current;
  }, []);

  const syncTrackedSourceState = useCallback((): void => {
    trackedSourceRef.current = latestTrackedSourceRef.current;
  }, []);

  const syncTrackedState = useCallback((): void => {
    cancelPendingSave();
    syncTrackedSourceState();
  }, [cancelPendingSave, syncTrackedSourceState]);

  const setIdleState = useCallback(
    (savedAt: number | null): void => {
      cancelPendingSave();
      setAutosaveState(createIdleWorkspaceAutosaveState(savedAt));
    },
    [cancelPendingSave],
  );

  const setAutosaveErrorState = useCallback((error: AppError): void => {
    setAutosaveState((current) => ({
      kind: 'error',
      savedAt: current.savedAt,
      error,
    }));
  }, []);

  const saveNow = useCallback(async (): Promise<{ savedAt: number }> => {
    cancelPendingSave();
    setAutosaveState((current) => ({
      kind: 'saving',
      savedAt: current.savedAt,
      error: null,
    }));

    try {
      const result = await persistWorkspaceAutosaveSource(
        getLatestTrackedSource(),
        saveWorkspaceRef.current,
      );
      syncTrackedSourceState();
      setAutosaveState(createIdleWorkspaceAutosaveState(result.savedAt));
      return result;
    } catch {
      const autosaveAppError = createAutosaveWriteFailedError();
      setAutosaveErrorState(autosaveAppError);
      return throwAppError(autosaveAppError);
    }
  }, [
    cancelPendingSave,
    getLatestTrackedSource,
    setAutosaveErrorState,
    syncTrackedSourceState,
  ]);

  const scheduleSave = useCallback((): void => {
    if (isSuppressed) {
      return;
    }

    schedule(() => {
      void saveNow().catch((error: unknown) => {
        if (isAppError(error)) {
          return;
        }

        setAutosaveErrorState(createAutosaveWriteFailedError());
      });
    }, debounceMs);
  }, [debounceMs, isSuppressed, saveNow, schedule, setAutosaveErrorState]);

  useEffect(() => {
    isSuppressedRef.current = isSuppressed;
  }, [isSuppressed]);

  useEffect(() => {
    scheduleSaveRef.current = scheduleSave;
  }, [scheduleSave]);

  useEffect(() => {
    if (isSuppressed) {
      cancelPendingSave();
    }
  }, [cancelPendingSave, isSuppressed]);

  useEffect(() => {
    saveWorkspaceRef.current = saveWorkspace;
  }, [saveWorkspace]);

  useEffect(() => {
    const unsubscribe = useWorkspaceStore.subscribe((state) => {
      const nextTrackedSource = selectWorkspaceAutosaveSource(state);
      const previousTrackedSource = latestTrackedSourceRef.current;
      latestTrackedSourceRef.current = nextTrackedSource;

      if (
        !hasPersistedWorkspaceSliceChanged(
          previousTrackedSource,
          nextTrackedSource,
        )
      ) {
        return;
      }

      if (
        hasPersistedWorkspaceSliceChanged(
          trackedSourceRef.current,
          nextTrackedSource,
        ) &&
        !isSuppressedRef.current
      ) {
        scheduleSaveRef.current();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    autosaveState,
    cancelPendingSave,
    syncTrackedState,
    saveNow,
    setIdleState,
  };
};
