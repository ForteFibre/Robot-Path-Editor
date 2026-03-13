import { useMemo } from 'react';
import type { NotificationSetter } from './persistenceNotifications';
import type { WorkspacePersistenceFacade } from './types';
import { useWorkspaceDocumentSerialization } from './useWorkspaceDocumentSerialization';
import { useWorkspacePersistenceActions } from './useWorkspacePersistenceActions';
import { useWorkspacePersistenceBootstrap } from './useWorkspacePersistenceBootstrap';
import { useWorkspacePersistenceController } from './useWorkspacePersistenceController';
import { useWorkspacePersistenceNotifications } from './useWorkspacePersistenceNotifications';
import { useWorkspaceRestoreDialogActions } from './useWorkspaceRestoreDialogActions';

type UseWorkspacePersistenceOptions = {
  setNotification: NotificationSetter;
};
export const useWorkspacePersistence = ({
  setNotification,
}: UseWorkspacePersistenceOptions): WorkspacePersistenceFacade => {
  const { bootstrapResult } = useWorkspacePersistenceBootstrap();
  const persistenceController =
    useWorkspacePersistenceController(bootstrapResult);
  const { getSerializedWorkspace } = useWorkspaceDocumentSerialization();
  const { recoveredNotification } = useWorkspacePersistenceNotifications({
    autosaveState: persistenceController.autosaveState,
    bootstrapResult,
    setNotification,
  });
  const persistenceActions = useWorkspacePersistenceActions({
    bootstrapResult,
    getSerializedWorkspace,
    handleImportJson: persistenceController.handleImportJson,
    handleImportJsonSource: persistenceController.handleImportJsonSource,
    handleNewWorkspace: persistenceController.handleNewWorkspace,
    handleRestoreDialogFileLoad:
      persistenceController.handleRestoreDialogFileLoad,
    handleStartFresh: persistenceController.handleStartFresh,
    restoreCandidate: persistenceController.restoreCandidate,
  });

  const restoreDialog = useWorkspaceRestoreDialogActions({
    loadRestoreDialogFile: persistenceActions.loadRestoreDialogFile,
    handleRestoreLastEdit: persistenceController.handleRestoreLastEdit,
    isRestoreDialogBusy: persistenceController.isRestoreDialogBusy,
    restoreCandidate: persistenceController.restoreCandidate,
    restoreLinkedWorkspace: persistenceActions.restoreLinkedWorkspace,
    setNotification,
    startFresh: persistenceActions.startFresh,
  });

  return useMemo<WorkspacePersistenceFacade>(() => {
    return {
      autosaveState: persistenceController.autosaveState,
      recoveredNotification,
      restoreDialog,
      pendingSaveConflict: persistenceActions.pendingSaveConflict,
      linkedFileName: persistenceActions.linkedFileName,
      isFileSystemAccessSupported:
        persistenceActions.isFileSystemAccessSupported,
      newWorkspace: persistenceActions.newWorkspace,
      importJsonFile: persistenceActions.importJsonFile,
      openLinkedWorkspace: persistenceActions.openLinkedWorkspace,
      saveWorkspace: persistenceActions.saveWorkspace,
      saveWorkspaceAs: persistenceActions.saveWorkspaceAs,
      restoreLinkedWorkspace: persistenceActions.restoreLinkedWorkspace,
      startFresh: persistenceActions.startFresh,
      cancelSaveConflict: persistenceActions.cancelSaveConflict,
      confirmOverwriteSaveConflict:
        persistenceActions.confirmOverwriteSaveConflict,
    };
  }, [
    persistenceController.autosaveState,
    persistenceActions,
    recoveredNotification,
    restoreDialog,
  ]);
};
