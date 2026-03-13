import { useCallback, useMemo } from 'react';
import type {
  WorkspaceFileActionResult,
  WorkspacePersistenceFacade,
} from './types';
import {
  notifyPersistenceError,
  toJsonLoadedMessage,
  type NotificationSetter,
} from './persistenceNotifications';

type UseWorkspaceRestoreDialogActionsOptions = {
  loadRestoreDialogFile: (file: File) => Promise<void>;
  handleRestoreLastEdit: () => Promise<void>;
  isRestoreDialogBusy: boolean;
  restoreCandidate: WorkspacePersistenceFacade['restoreDialog']['result'];
  restoreLinkedWorkspace: () => Promise<WorkspaceFileActionResult | null>;
  setNotification: NotificationSetter;
  startFresh: () => Promise<void>;
};

export const useWorkspaceRestoreDialogActions = ({
  loadRestoreDialogFile,
  handleRestoreLastEdit,
  isRestoreDialogBusy,
  restoreCandidate,
  restoreLinkedWorkspace,
  setNotification,
  startFresh,
}: UseWorkspaceRestoreDialogActionsOptions): WorkspacePersistenceFacade['restoreDialog'] => {
  const onStartFresh = useCallback((): void => {
    setNotification(null);

    startFresh().catch((error: unknown) => {
      notifyPersistenceError(
        error,
        {
          kind: 'error',
          error: { kind: 'workspace-reset', reason: 'persist-failed' },
        },
        setNotification,
      );
    });
  }, [setNotification, startFresh]);

  const onRestoreLastEdit = useCallback((): void => {
    setNotification(null);

    handleRestoreLastEdit().catch((error: unknown) => {
      notifyPersistenceError(
        error,
        {
          kind: 'error',
          error: { kind: 'workspace-restore', reason: 'apply-failed' },
        },
        setNotification,
      );
    });
  }, [handleRestoreLastEdit, setNotification]);

  const onRestoreLinkedFile = useCallback((): void => {
    setNotification(null);

    restoreLinkedWorkspace()
      .then((result) => {
        if (result !== null) {
          setNotification({
            kind: 'success',
            message: toJsonLoadedMessage(result.fileName),
          });
        }
      })
      .catch((error: unknown) => {
        notifyPersistenceError(
          error,
          {
            kind: 'error',
            error: { kind: 'workspace-import', reason: 'read-failed' },
          },
          setNotification,
        );
      });
  }, [restoreLinkedWorkspace, setNotification]);

  const onLoadFromFile = useCallback(
    async (file: File): Promise<void> => {
      setNotification(null);

      try {
        await loadRestoreDialogFile(file);
      } catch (error: unknown) {
        notifyPersistenceError(
          error,
          {
            kind: 'error',
            error: { kind: 'workspace-import', reason: 'read-failed' },
          },
          setNotification,
        );
      }
    },
    [loadRestoreDialogFile, setNotification],
  );

  return useMemo(() => {
    return {
      result: restoreCandidate,
      isBusy: isRestoreDialogBusy,
      onStartFresh,
      onRestoreLastEdit,
      onRestoreLinkedFile,
      onLoadFromFile,
    };
  }, [
    isRestoreDialogBusy,
    onLoadFromFile,
    onRestoreLastEdit,
    onRestoreLinkedFile,
    onStartFresh,
    restoreCandidate,
  ]);
};
