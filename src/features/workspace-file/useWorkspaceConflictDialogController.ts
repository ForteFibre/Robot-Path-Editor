import { useCallback, useMemo, useState } from 'react';
import type { AppNotification } from '../../errors';
import type {
  ConflictState,
  WorkspacePersistenceFacade,
} from '../persistence/types';
import {
  notifyFileOperationError,
  toWorkspaceLoadSuccessNotification,
  toWorkspaceSaveSuccessNotification,
} from './fileOperationNotifications';

type NotificationSetter = (notification: AppNotification | null) => void;

type WorkspaceConflictDialogProps = {
  conflict: ConflictState | null;
  isBusy: boolean;
  onCancel: () => void;
  onConfirmOverwrite: () => void;
  onLoadLatestFromFile: () => void;
};

type UseWorkspaceConflictDialogControllerOptions = {
  persistence: WorkspacePersistenceFacade;
  setNotification: NotificationSetter;
};

type UseWorkspaceConflictDialogControllerResult = {
  conflictDialogProps: WorkspaceConflictDialogProps;
};

export const useWorkspaceConflictDialogController = ({
  persistence,
  setNotification,
}: UseWorkspaceConflictDialogControllerOptions): UseWorkspaceConflictDialogControllerResult => {
  const [isConflictDialogBusy, setIsConflictDialogBusy] = useState(false);

  const confirmOverwriteConflict = useCallback(async (): Promise<void> => {
    setNotification(null);
    setIsConflictDialogBusy(true);

    try {
      const result = await persistence.confirmOverwriteSaveConflict();
      if (result !== null) {
        setNotification(toWorkspaceSaveSuccessNotification(result, true));
      }
    } catch (error: unknown) {
      notifyFileOperationError(
        error,
        {
          kind: 'error',
          error: { kind: 'workspace-export', reason: 'write-failed' },
        },
        setNotification,
      );
    } finally {
      setIsConflictDialogBusy(false);
    }
  }, [persistence, setNotification]);

  const loadLatestFromConflictDialog = useCallback(async (): Promise<void> => {
    setNotification(null);
    setIsConflictDialogBusy(true);

    try {
      const result = await persistence.restoreLinkedWorkspace();

      if (result !== null) {
        setNotification(toWorkspaceLoadSuccessNotification(result));
      }
    } catch (error: unknown) {
      notifyFileOperationError(
        error,
        {
          kind: 'error',
          error: { kind: 'workspace-import', reason: 'read-failed' },
        },
        setNotification,
      );
    } finally {
      setIsConflictDialogBusy(false);
    }
  }, [persistence, setNotification]);

  const conflictDialogProps = useMemo<WorkspaceConflictDialogProps>(() => {
    return {
      conflict: persistence.pendingSaveConflict,
      isBusy: isConflictDialogBusy,
      onCancel: persistence.cancelSaveConflict,
      onConfirmOverwrite: () => {
        confirmOverwriteConflict().catch(() => undefined);
      },
      onLoadLatestFromFile: () => {
        loadLatestFromConflictDialog().catch(() => undefined);
      },
    };
  }, [
    confirmOverwriteConflict,
    isConflictDialogBusy,
    loadLatestFromConflictDialog,
    persistence.cancelSaveConflict,
    persistence.pendingSaveConflict,
  ]);

  return {
    conflictDialogProps,
  };
};
