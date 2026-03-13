import { useCallback, useMemo } from 'react';
import { downloadText } from '../../io/workspaceIO';
import { useWorkspaceFileLink } from './useWorkspaceFileLink';
import type {
  ConflictState,
  WorkspaceFileActionResult,
  WorkspacePersistenceBootstrapResult,
  WorkspacePersistenceRestoreCandidate,
} from './types';

const WORKSPACE_DOWNLOAD_FILE_NAME = 'workspace.json';
const WORKSPACE_DOWNLOAD_MIME_TYPE = 'application/json';

const toWorkspaceFileActionResult = (
  fileName: string,
): WorkspaceFileActionResult => {
  return {
    fileName,
  };
};

const resolveLinkedFileName = (params: {
  bootstrapResult: WorkspacePersistenceBootstrapResult | null;
  linkedFileName: string | null;
  restoreCandidate: WorkspacePersistenceRestoreCandidate | null;
}): string | null => {
  const { bootstrapResult, linkedFileName, restoreCandidate } = params;

  return (
    linkedFileName ??
    (restoreCandidate?.kind === 'conflict'
      ? restoreCandidate.linkedFileName
      : null) ??
    (bootstrapResult?.kind === 'conflict'
      ? bootstrapResult.linkedFileName
      : null)
  );
};

type ImportWorkspaceJsonSource = (
  source: string,
  options?: {
    closeRestoreDialog?: boolean;
  },
) => Promise<void>;

type UseWorkspacePersistenceActionsOptions = {
  bootstrapResult: WorkspacePersistenceBootstrapResult | null;
  getSerializedWorkspace: () => string;
  handleImportJson: (file: File) => Promise<void>;
  handleImportJsonSource: ImportWorkspaceJsonSource;
  handleNewWorkspace: () => Promise<void>;
  handleRestoreDialogFileLoad: (file: File) => Promise<void>;
  handleStartFresh: () => Promise<void>;
  restoreCandidate: WorkspacePersistenceRestoreCandidate | null;
};

type UseWorkspacePersistenceActionsResult = {
  cancelSaveConflict: () => void;
  confirmOverwriteSaveConflict: () => Promise<WorkspaceFileActionResult | null>;
  downloadWorkspace: () => WorkspaceFileActionResult;
  importJsonFile: (file: File) => Promise<WorkspaceFileActionResult>;
  isFileSystemAccessSupported: boolean;
  linkedFileName: string | null;
  loadRestoreDialogFile: (file: File) => Promise<void>;
  newWorkspace: () => Promise<void>;
  openLinkedWorkspace: () => Promise<WorkspaceFileActionResult | null>;
  pendingSaveConflict: ConflictState | null;
  restoreLinkedWorkspace: () => Promise<WorkspaceFileActionResult | null>;
  saveWorkspace: () => Promise<WorkspaceFileActionResult | null>;
  saveWorkspaceAs: () => Promise<WorkspaceFileActionResult | null>;
  startFresh: () => Promise<void>;
};

export const useWorkspacePersistenceActions = ({
  bootstrapResult,
  getSerializedWorkspace,
  handleImportJson,
  handleImportJsonSource,
  handleNewWorkspace,
  handleRestoreDialogFileLoad,
  handleStartFresh,
  restoreCandidate,
}: UseWorkspacePersistenceActionsOptions): UseWorkspacePersistenceActionsResult => {
  const {
    cancelSaveConflict,
    clearLink,
    confirmOverwrite,
    isSupported,
    linkedFileName,
    loadLatestFromLinkedFile,
    openWithFilePicker,
    pendingSaveConflict,
    save,
    saveAs,
  } = useWorkspaceFileLink({
    getSerializedWorkspace,
    importWorkspaceJsonSource: handleImportJsonSource,
  });

  const downloadWorkspace = useCallback((): WorkspaceFileActionResult => {
    downloadText(
      WORKSPACE_DOWNLOAD_FILE_NAME,
      getSerializedWorkspace(),
      WORKSPACE_DOWNLOAD_MIME_TYPE,
    );

    return toWorkspaceFileActionResult(WORKSPACE_DOWNLOAD_FILE_NAME);
  }, [getSerializedWorkspace]);

  const newWorkspace = useCallback(async (): Promise<void> => {
    await handleNewWorkspace();
    await clearLink();
  }, [clearLink, handleNewWorkspace]);

  const startFresh = useCallback(async (): Promise<void> => {
    await handleStartFresh();
    await clearLink();
  }, [clearLink, handleStartFresh]);

  const importJsonFile = useCallback(
    async (file: File): Promise<WorkspaceFileActionResult> => {
      await handleImportJson(file);
      await clearLink();

      return toWorkspaceFileActionResult(file.name);
    },
    [clearLink, handleImportJson],
  );

  const loadRestoreDialogFile = useCallback(
    async (file: File): Promise<void> => {
      await handleRestoreDialogFileLoad(file);
      await clearLink();
    },
    [clearLink, handleRestoreDialogFileLoad],
  );

  const openLinkedWorkspace =
    useCallback(async (): Promise<WorkspaceFileActionResult | null> => {
      const handle = await openWithFilePicker();

      if (handle === null) {
        return null;
      }

      return toWorkspaceFileActionResult(handle.name);
    }, [openWithFilePicker]);

  const saveWorkspace =
    useCallback(async (): Promise<WorkspaceFileActionResult | null> => {
      if (!isSupported) {
        return downloadWorkspace();
      }

      const handle = await save();

      if (handle === null) {
        return null;
      }

      return toWorkspaceFileActionResult(handle.name);
    }, [downloadWorkspace, isSupported, save]);

  const saveWorkspaceAs =
    useCallback(async (): Promise<WorkspaceFileActionResult | null> => {
      if (!isSupported) {
        return downloadWorkspace();
      }

      const handle = await saveAs();

      if (handle === null) {
        return null;
      }

      return toWorkspaceFileActionResult(handle.name);
    }, [downloadWorkspace, isSupported, saveAs]);

  const resolvedLinkedFileName = useMemo<string | null>(() => {
    return resolveLinkedFileName({
      bootstrapResult,
      linkedFileName,
      restoreCandidate,
    });
  }, [bootstrapResult, linkedFileName, restoreCandidate]);

  const restoreLinkedWorkspace =
    useCallback(async (): Promise<WorkspaceFileActionResult | null> => {
      const imported = await loadLatestFromLinkedFile();

      if (!imported || resolvedLinkedFileName === null) {
        return null;
      }

      return toWorkspaceFileActionResult(resolvedLinkedFileName);
    }, [loadLatestFromLinkedFile, resolvedLinkedFileName]);

  const confirmOverwriteSaveConflict =
    useCallback(async (): Promise<WorkspaceFileActionResult | null> => {
      const handle = await confirmOverwrite();

      if (handle === null) {
        return null;
      }

      return toWorkspaceFileActionResult(handle.name);
    }, [confirmOverwrite]);

  return {
    cancelSaveConflict,
    confirmOverwriteSaveConflict,
    downloadWorkspace,
    importJsonFile,
    isFileSystemAccessSupported: isSupported,
    linkedFileName: resolvedLinkedFileName,
    loadRestoreDialogFile,
    newWorkspace,
    openLinkedWorkspace,
    pendingSaveConflict,
    restoreLinkedWorkspace,
    saveWorkspace,
    saveWorkspaceAs,
    startFresh,
  };
};
