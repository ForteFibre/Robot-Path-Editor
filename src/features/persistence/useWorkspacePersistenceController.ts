import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  WorkspacePersistenceBootstrapResult,
  WorkspacePersistenceRestoreCandidate,
} from './types';
import { useWorkspaceAutosave } from './useWorkspaceAutosave';
import { useWorkspacePersistenceControllerActions } from './useWorkspacePersistenceControllerActions';
import { useWorkspacePersistenceStoreActions } from './useWorkspacePersistenceStoreActions';

const toRestoreCandidate = (
  bootstrapResult: WorkspacePersistenceBootstrapResult | null,
): WorkspacePersistenceRestoreCandidate | null => {
  if (
    bootstrapResult?.kind !== 'autosave-only' &&
    bootstrapResult?.kind !== 'conflict'
  ) {
    return null;
  }

  return bootstrapResult;
};

const getRestoreCandidateSavedAt = (
  candidate: WorkspacePersistenceRestoreCandidate,
): number => {
  return candidate.kind === 'conflict'
    ? candidate.autoSavedAt
    : candidate.savedAt;
};

type UseWorkspacePersistenceControllerResult = {
  autosaveState: ReturnType<typeof useWorkspaceAutosave>['autosaveState'];
  isRestoreDialogOpen: boolean;
  isRestoreDialogBusy: boolean;
  restoreCandidate: WorkspacePersistenceRestoreCandidate | null;
  handleImportJsonSource: ReturnType<
    typeof useWorkspacePersistenceControllerActions
  >['handleImportJsonSource'];
  handleNewWorkspace: () => Promise<void>;
  handleImportJson: (file: File) => Promise<void>;
  handleStartFresh: () => Promise<void>;
  handleRestoreLastEdit: () => Promise<void>;
  handleRestoreDialogFileLoad: (file: File) => Promise<void>;
};

export const useWorkspacePersistenceController = (
  bootstrapResult: WorkspacePersistenceBootstrapResult | null,
): UseWorkspacePersistenceControllerResult => {
  const { importWorkspaceDocument, resetWorkspace, restoreWorkspaceAutosave } =
    useWorkspacePersistenceStoreActions();
  const bootstrapRestoreCandidate = toRestoreCandidate(bootstrapResult);
  const [isMutatingWorkspace, setIsMutatingWorkspace] = useState(false);
  const [restoreCandidate, setRestoreCandidate] =
    useState<WorkspacePersistenceRestoreCandidate | null>(() => {
      return toRestoreCandidate(bootstrapResult);
    });

  const isAutosaveSuppressed =
    bootstrapResult === null ||
    restoreCandidate !== null ||
    isMutatingWorkspace;
  const {
    autosaveState,
    cancelPendingSave,
    saveNow,
    setIdleState,
    syncTrackedState,
  } = useWorkspaceAutosave({
    isSuppressed: isAutosaveSuppressed,
    initialSavedAt:
      bootstrapRestoreCandidate === null
        ? null
        : getRestoreCandidateSavedAt(bootstrapRestoreCandidate),
  });

  useEffect(() => {
    const nextRestoreCandidate = toRestoreCandidate(bootstrapResult);

    if (nextRestoreCandidate === null) {
      return;
    }

    setRestoreCandidate((current) => current ?? nextRestoreCandidate);
    syncTrackedState();
    setIdleState(getRestoreCandidateSavedAt(nextRestoreCandidate));
  }, [bootstrapResult, setIdleState, syncTrackedState]);

  const runWorkspaceMutation = useCallback(
    async (mutation: () => Promise<void> | void): Promise<void> => {
      cancelPendingSave();
      setIsMutatingWorkspace(true);

      try {
        await mutation();
        syncTrackedState();
      } finally {
        setIsMutatingWorkspace(false);
      }
    },
    [cancelPendingSave, syncTrackedState],
  );

  const {
    handleImportJson,
    handleImportJsonSource,
    handleNewWorkspace,
    handleRestoreDialogFileLoad,
    handleRestoreLastEdit,
    handleStartFresh,
  } = useWorkspacePersistenceControllerActions({
    importWorkspaceDocument,
    resetWorkspace,
    restoreCandidate,
    restoreWorkspaceAutosave,
    runWorkspaceMutation,
    saveNow,
    setIdleState,
    setRestoreCandidate,
  });

  const value = useMemo<UseWorkspacePersistenceControllerResult>(() => {
    return {
      autosaveState,
      isRestoreDialogOpen: restoreCandidate !== null,
      isRestoreDialogBusy: isMutatingWorkspace,
      restoreCandidate,
      handleImportJsonSource,
      handleNewWorkspace,
      handleImportJson,
      handleStartFresh,
      handleRestoreLastEdit,
      handleRestoreDialogFileLoad,
    };
  }, [
    autosaveState,
    handleImportJson,
    handleImportJsonSource,
    handleNewWorkspace,
    handleRestoreDialogFileLoad,
    handleRestoreLastEdit,
    handleStartFresh,
    isMutatingWorkspace,
    restoreCandidate,
  ]);

  return value;
};
