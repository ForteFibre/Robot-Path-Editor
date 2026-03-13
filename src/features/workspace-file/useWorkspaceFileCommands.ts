import { useCallback, useMemo } from 'react';
import type { AppNotification } from '../../errors';
import { isFilePickerAbortError } from '../../io/workspaceFileAccess';
import type { WorkspacePersistenceFacade } from '../persistence/types';
import {
  notifyFileOperationError,
  toWorkspaceLoadSuccessNotification,
  toWorkspaceSaveSuccessNotification,
} from './fileOperationNotifications';
import type { WorkspaceFileCommands } from './types';

type NotificationSetter = (notification: AppNotification | null) => void;

type UseWorkspaceFileCommandsOptions = {
  persistence: WorkspacePersistenceFacade;
  setNotification: NotificationSetter;
};

type UseWorkspaceFileCommandsResult = {
  workspaceCommands: WorkspaceFileCommands;
};

export const useWorkspaceFileCommands = ({
  persistence,
  setNotification,
}: UseWorkspaceFileCommandsOptions): UseWorkspaceFileCommandsResult => {
  const save = useCallback(async (): Promise<void> => {
    setNotification(null);

    try {
      const result = await persistence.saveWorkspace();
      if (result !== null) {
        setNotification(
          toWorkspaceSaveSuccessNotification(
            result,
            persistence.isFileSystemAccessSupported,
          ),
        );
      }
    } catch (error: unknown) {
      if (isFilePickerAbortError(error)) {
        return;
      }

      notifyFileOperationError(
        error,
        {
          kind: 'error',
          error: { kind: 'workspace-export', reason: 'write-failed' },
        },
        setNotification,
      );
    }
  }, [persistence, setNotification]);

  const saveAs = useCallback(async (): Promise<void> => {
    setNotification(null);

    try {
      const result = await persistence.saveWorkspaceAs();
      if (result !== null) {
        setNotification(
          toWorkspaceSaveSuccessNotification(
            result,
            persistence.isFileSystemAccessSupported,
          ),
        );
      }
    } catch (error: unknown) {
      if (isFilePickerAbortError(error)) {
        return;
      }

      notifyFileOperationError(
        error,
        {
          kind: 'error',
          error: { kind: 'workspace-export', reason: 'write-failed' },
        },
        setNotification,
      );
    }
  }, [persistence, setNotification]);

  const openWorkspace = useCallback(async (): Promise<void> => {
    setNotification(null);

    try {
      const result = await persistence.openLinkedWorkspace();
      if (result !== null) {
        setNotification(toWorkspaceLoadSuccessNotification(result));
      }
    } catch (error: unknown) {
      if (isFilePickerAbortError(error)) {
        return;
      }

      notifyFileOperationError(
        error,
        {
          kind: 'error',
          error: { kind: 'workspace-import', reason: 'read-failed' },
        },
        setNotification,
      );
    }
  }, [persistence, setNotification]);

  const importJson = useCallback(
    async (file: File): Promise<void> => {
      setNotification(null);

      try {
        const result = await persistence.importJsonFile(file);
        setNotification(toWorkspaceLoadSuccessNotification(result));
      } catch (error: unknown) {
        notifyFileOperationError(
          error,
          {
            kind: 'error',
            error: { kind: 'workspace-import', reason: 'read-failed' },
          },
          setNotification,
        );
      }
    },
    [persistence, setNotification],
  );

  const newWorkspace = useCallback(async (): Promise<void> => {
    setNotification(null);

    try {
      await persistence.newWorkspace();
      setNotification({
        kind: 'success',
        message: '新しいワークスペースを開始しました。',
      });
    } catch (error: unknown) {
      notifyFileOperationError(
        error,
        {
          kind: 'error',
          error: { kind: 'workspace-reset', reason: 'persist-failed' },
        },
        setNotification,
      );
    }
  }, [persistence, setNotification]);

  const workspaceCommands = useMemo<WorkspaceFileCommands>(() => {
    return {
      isFileSystemAccessSupported: persistence.isFileSystemAccessSupported,
      linkedFileName: persistence.linkedFileName,
      importJson,
      newWorkspace,
      openWorkspace,
      save,
      saveAs,
    };
  }, [
    importJson,
    newWorkspace,
    openWorkspace,
    persistence.isFileSystemAccessSupported,
    persistence.linkedFileName,
    save,
    saveAs,
  ]);

  return {
    workspaceCommands,
  };
};
