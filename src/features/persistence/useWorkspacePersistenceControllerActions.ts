import { useCallback, useMemo } from 'react';
import { throwAppError } from '../../errors/appError';
import { deserializeWorkspace } from '../../io/workspaceCodec';
import { deleteWorkspacePersistence } from '../../io/workspacePersistence';
import type { WorkspacePersistenceRestoreCandidate } from './types';
import type { useWorkspacePersistenceStoreActions } from './useWorkspacePersistenceStoreActions';

type ControllerActionOptions = {
  closeRestoreDialog?: boolean;
};

type ImportWorkspaceJsonSource = (
  source: string,
  options?: ControllerActionOptions,
) => Promise<void>;

type RunWorkspaceMutation = (
  mutation: () => Promise<void> | void,
) => Promise<void>;

type SetRestoreCandidate = (
  candidate: WorkspacePersistenceRestoreCandidate | null,
) => void;

type UseWorkspacePersistenceControllerActionsOptions = {
  importWorkspaceDocument: ReturnType<
    typeof useWorkspacePersistenceStoreActions
  >['importWorkspaceDocument'];
  resetWorkspace: ReturnType<
    typeof useWorkspacePersistenceStoreActions
  >['resetWorkspace'];
  restoreCandidate: WorkspacePersistenceRestoreCandidate | null;
  restoreWorkspaceAutosave: ReturnType<
    typeof useWorkspacePersistenceStoreActions
  >['restoreWorkspaceAutosave'];
  runWorkspaceMutation: RunWorkspaceMutation;
  saveNow: () => Promise<{ savedAt: number }>;
  setIdleState: (savedAt: number | null) => void;
  setRestoreCandidate: SetRestoreCandidate;
};

type UseWorkspacePersistenceControllerActionsResult = {
  handleImportJsonSource: ImportWorkspaceJsonSource;
  handleImportJson: (file: File) => Promise<void>;
  handleNewWorkspace: () => Promise<void>;
  handleStartFresh: () => Promise<void>;
  handleRestoreLastEdit: () => Promise<void>;
  handleRestoreDialogFileLoad: (file: File) => Promise<void>;
};

const getRestoreCandidateSavedAt = (
  candidate: WorkspacePersistenceRestoreCandidate,
): number => {
  return candidate.kind === 'conflict'
    ? candidate.autoSavedAt
    : candidate.savedAt;
};

export const useWorkspacePersistenceControllerActions = ({
  importWorkspaceDocument,
  resetWorkspace,
  restoreCandidate,
  restoreWorkspaceAutosave,
  runWorkspaceMutation,
  saveNow,
  setIdleState,
  setRestoreCandidate,
}: UseWorkspacePersistenceControllerActionsOptions): UseWorkspacePersistenceControllerActionsResult => {
  const handleImportJsonSource = useCallback<ImportWorkspaceJsonSource>(
    async (source, options = {}): Promise<void> => {
      let importedWorkspace: ReturnType<typeof deserializeWorkspace>;
      try {
        importedWorkspace = deserializeWorkspace(source);
      } catch {
        return throwAppError({
          kind: 'workspace-import',
          reason: 'invalid-format',
        });
      }

      try {
        await runWorkspaceMutation(() => {
          importWorkspaceDocument(importedWorkspace);

          if (options.closeRestoreDialog === true) {
            setRestoreCandidate(null);
          }
        });
      } catch {
        throwAppError({ kind: 'workspace-import', reason: 'apply-failed' });
      }

      try {
        await saveNow();
      } catch {
        throwAppError({ kind: 'workspace-import', reason: 'persist-failed' });
      }
    },
    [
      importWorkspaceDocument,
      runWorkspaceMutation,
      saveNow,
      setRestoreCandidate,
    ],
  );

  const handleImportJson = useCallback(
    async (
      file: File,
      options: ControllerActionOptions = {},
    ): Promise<void> => {
      let content: string;
      try {
        content = await file.text();
      } catch {
        return throwAppError({
          kind: 'workspace-import',
          reason: 'read-failed',
        });
      }

      await handleImportJsonSource(content, options);
    },
    [handleImportJsonSource],
  );

  const handleNewWorkspace = useCallback(async (): Promise<void> => {
    try {
      await runWorkspaceMutation(async () => {
        resetWorkspace();
        await deleteWorkspacePersistence();
      });
      setIdleState(null);
    } catch {
      throwAppError({ kind: 'workspace-reset', reason: 'persist-failed' });
    }
  }, [resetWorkspace, runWorkspaceMutation, setIdleState]);

  const handleStartFresh = useCallback(async (): Promise<void> => {
    try {
      await runWorkspaceMutation(async () => {
        resetWorkspace();
        setRestoreCandidate(null);
        await deleteWorkspacePersistence();
      });
      setIdleState(null);
    } catch {
      throwAppError({ kind: 'workspace-reset', reason: 'persist-failed' });
    }
  }, [resetWorkspace, runWorkspaceMutation, setIdleState, setRestoreCandidate]);

  const handleRestoreLastEdit = useCallback(async (): Promise<void> => {
    if (restoreCandidate === null) {
      return;
    }

    try {
      await runWorkspaceMutation(() => {
        restoreWorkspaceAutosave(restoreCandidate.autosave);
        setRestoreCandidate(null);
      });
      setIdleState(getRestoreCandidateSavedAt(restoreCandidate));
    } catch {
      throwAppError({ kind: 'workspace-restore', reason: 'apply-failed' });
    }
  }, [
    restoreCandidate,
    restoreWorkspaceAutosave,
    runWorkspaceMutation,
    setIdleState,
    setRestoreCandidate,
  ]);

  const handleRestoreDialogFileLoad = useCallback(
    async (file: File): Promise<void> => {
      await handleImportJson(file, { closeRestoreDialog: true });
    },
    [handleImportJson],
  );

  return useMemo(
    () => ({
      handleImportJsonSource,
      handleImportJson,
      handleNewWorkspace,
      handleStartFresh,
      handleRestoreLastEdit,
      handleRestoreDialogFileLoad,
    }),
    [
      handleImportJson,
      handleImportJsonSource,
      handleNewWorkspace,
      handleRestoreDialogFileLoad,
      handleRestoreLastEdit,
      handleStartFresh,
    ],
  );
};
