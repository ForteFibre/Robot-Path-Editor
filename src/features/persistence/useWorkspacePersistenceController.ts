import { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteWorkspacePersistence } from '../../io/workspacePersistence';
import { deserializeWorkspace } from '../../io/workspaceIO';
import { useWorkspaceActions } from '../../store/workspaceStore';
import type {
  WorkspacePersistenceBootstrapResult,
  WorkspacePersistenceRestoreCandidate,
} from './types';
import { useWorkspaceAutosave } from './useWorkspaceAutosave';

const IMPORT_ERROR_PREFIX =
  'JSONの読み込みに失敗しました。現行形式の workspace.json を選択してください。';

const toWorkspaceErrorMessage = (prefix: string, error: unknown): string => {
  if (error instanceof Error && error.message.length > 0) {
    return `${prefix} (${error.message})`;
  }

  return prefix;
};

const toImportErrorMessage = (error: unknown): string => {
  return toWorkspaceErrorMessage(IMPORT_ERROR_PREFIX, error);
};

const toRecoveredWorkspaceNotice = (
  bootstrapResult: WorkspacePersistenceBootstrapResult | null,
): string | null => {
  if (bootstrapResult?.kind !== 'recovered') {
    return null;
  }

  switch (bootstrapResult.reason) {
    case 'corrupt':
      return '保存データが破損していたため自動削除して起動しました。';
    case 'unsupported-format':
      return '保存データが現在の形式に対応していなかったため自動削除して起動しました。';
    case 'unreadable':
      return '保存データを読み取れなかったため自動削除して起動しました。';
    default:
      return '保存データを復旧できなかったため自動削除して起動しました。';
  }
};

type ControllerActionOptions = {
  closeRestoreDialog?: boolean;
};

type ImportWorkspaceJsonSource = (
  source: string,
  options?: ControllerActionOptions,
) => Promise<boolean>;

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
  workspaceError: string | null;
  clearWorkspaceError: () => void;
  workspaceRecoveryNotice: string | null;
  clearWorkspaceRecoveryNotice: () => void;
  isRestoreDialogOpen: boolean;
  isRestoreDialogBusy: boolean;
  restoreCandidate: WorkspacePersistenceRestoreCandidate | null;
  handleImportJsonSource: ImportWorkspaceJsonSource;
  handleNewWorkspace: () => Promise<void>;
  handleImportJson: (file: File) => Promise<boolean>;
  handleStartFresh: () => Promise<void>;
  handleRestoreLastEdit: () => Promise<void>;
  handleRestoreDialogFileLoad: (file: File) => Promise<boolean>;
};

export const useWorkspacePersistenceController = (
  bootstrapResult: WorkspacePersistenceBootstrapResult | null,
): UseWorkspacePersistenceControllerResult => {
  const { importWorkspace, resetWorkspace } = useWorkspaceActions();
  const bootstrapRestoreCandidate = toRestoreCandidate(bootstrapResult);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [workspaceRecoveryNotice, setWorkspaceRecoveryNotice] = useState<
    string | null
  >(() => toRecoveredWorkspaceNotice(bootstrapResult));
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

  useEffect(() => {
    const nextNotice = toRecoveredWorkspaceNotice(bootstrapResult);

    if (nextNotice === null) {
      return;
    }

    setWorkspaceRecoveryNotice(nextNotice);
  }, [bootstrapResult]);

  const clearWorkspaceError = useCallback((): void => {
    setWorkspaceError(null);
  }, []);

  const clearWorkspaceRecoveryNotice = useCallback((): void => {
    setWorkspaceRecoveryNotice(null);
  }, []);

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

  const importWorkspaceJsonSource = useCallback<ImportWorkspaceJsonSource>(
    async (source, options = {}): Promise<boolean> => {
      clearWorkspaceError();

      let importedWorkspace;
      try {
        importedWorkspace = deserializeWorkspace(source);
      } catch (error: unknown) {
        setWorkspaceError(toImportErrorMessage(error));
        return false;
      }

      try {
        await runWorkspaceMutation(() => {
          importWorkspace(importedWorkspace);

          if (options.closeRestoreDialog === true) {
            setRestoreCandidate(null);
          }
        });
      } catch (error: unknown) {
        setWorkspaceError(
          toWorkspaceErrorMessage(
            'ワークスペースの読み込みに失敗しました。',
            error,
          ),
        );
        return false;
      }

      try {
        await saveNow();
      } catch (error: unknown) {
        setWorkspaceError(
          toWorkspaceErrorMessage(
            '読み込んだワークスペースの保存に失敗しました。',
            error,
          ),
        );
      }

      return true;
    },
    [clearWorkspaceError, importWorkspace, runWorkspaceMutation, saveNow],
  );

  const importWorkspaceFile = useCallback(
    async (
      file: File,
      options: ControllerActionOptions = {},
    ): Promise<boolean> => {
      clearWorkspaceError();

      let content;
      try {
        content = await file.text();
      } catch (error: unknown) {
        setWorkspaceError(toImportErrorMessage(error));
        return false;
      }

      return await importWorkspaceJsonSource(content, options);
    },
    [clearWorkspaceError, importWorkspaceJsonSource],
  );

  const handleNewWorkspace = useCallback(async (): Promise<void> => {
    clearWorkspaceError();

    try {
      await runWorkspaceMutation(async () => {
        resetWorkspace();
        await deleteWorkspacePersistence();
      });
      setIdleState(null);
    } catch (error: unknown) {
      setWorkspaceError(
        toWorkspaceErrorMessage(
          '新しいワークスペースの開始に失敗しました。',
          error,
        ),
      );
    }
  }, [clearWorkspaceError, resetWorkspace, runWorkspaceMutation, setIdleState]);

  const handleStartFresh = useCallback(async (): Promise<void> => {
    clearWorkspaceError();

    try {
      await runWorkspaceMutation(async () => {
        resetWorkspace();
        setRestoreCandidate(null);
        await deleteWorkspacePersistence();
      });
      setIdleState(null);
    } catch (error: unknown) {
      setWorkspaceError(
        toWorkspaceErrorMessage(
          '新規ワークスペースの初期化に失敗しました。',
          error,
        ),
      );
    }
  }, [clearWorkspaceError, resetWorkspace, runWorkspaceMutation, setIdleState]);

  const handleRestoreLastEdit = useCallback(async (): Promise<void> => {
    if (restoreCandidate === null) {
      return;
    }

    clearWorkspaceError();

    try {
      await runWorkspaceMutation(() => {
        importWorkspace(restoreCandidate.autosave);
        setRestoreCandidate(null);
      });
      setIdleState(getRestoreCandidateSavedAt(restoreCandidate));
    } catch (error: unknown) {
      setWorkspaceError(
        toWorkspaceErrorMessage(
          '保存されたワークスペースの復元に失敗しました。',
          error,
        ),
      );
    }
  }, [
    clearWorkspaceError,
    importWorkspace,
    restoreCandidate,
    runWorkspaceMutation,
    setIdleState,
  ]);

  const handleRestoreDialogFileLoad = useCallback(
    async (file: File): Promise<boolean> => {
      return await importWorkspaceFile(file, { closeRestoreDialog: true });
    },
    [importWorkspaceFile],
  );

  const value = useMemo<UseWorkspacePersistenceControllerResult>(() => {
    return {
      autosaveState,
      workspaceError,
      clearWorkspaceError,
      workspaceRecoveryNotice,
      clearWorkspaceRecoveryNotice,
      isRestoreDialogOpen: restoreCandidate !== null,
      isRestoreDialogBusy: isMutatingWorkspace,
      restoreCandidate,
      handleImportJsonSource: importWorkspaceJsonSource,
      handleNewWorkspace,
      handleImportJson: importWorkspaceFile,
      handleStartFresh,
      handleRestoreLastEdit,
      handleRestoreDialogFileLoad,
    };
  }, [
    autosaveState,
    clearWorkspaceError,
    clearWorkspaceRecoveryNotice,
    importWorkspaceJsonSource,
    handleNewWorkspace,
    handleRestoreDialogFileLoad,
    handleRestoreLastEdit,
    handleStartFresh,
    importWorkspaceFile,
    isMutatingWorkspace,
    restoreCandidate,
    workspaceError,
    workspaceRecoveryNotice,
  ]);

  return value;
};
