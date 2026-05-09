import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { AppNotification } from '../../errors';
import { generatePathSetV1 } from '../../io/pathSetExport';
import {
  isFilePickerAbortError,
  isFileSystemAccessSupported,
  saveJsonFileAs,
} from '../../io/workspaceFileAccess';
import { downloadText } from '../../io/workspaceIO';
import { cloneDomainState } from '../../store/slices/pathSlice';
import { selectDomainState } from '../../store/workspaceSelectors';
import { useWorkspaceStore } from '../../store/workspaceStore';
import {
  notifyFileOperationError,
  toJsonFileDownloadedSuccessNotification,
  toJsonFileSavedSuccessNotification,
} from './fileOperationNotifications';
import type { PathSetExportCommands } from './types';

type NotificationSetter = (notification: AppNotification | null) => void;

type UsePathSetExportCommandOptions = {
  setNotification: NotificationSetter;
};

const PATH_SET_FILE_NAME = 'path-set.json';
const PATH_SET_MIME_TYPE = 'application/json';
const PATH_SET_FILE_DESCRIPTION = 'Path Set JSON';

export const usePathSetExportCommand = ({
  setNotification,
}: UsePathSetExportCommandOptions): PathSetExportCommands => {
  const domain = useWorkspaceStore(selectDomainState);
  const domainRef = useRef(domain);

  useEffect(() => {
    domainRef.current = domain;
  }, [domain]);

  const exportPathSetV1 = useCallback(async (): Promise<void> => {
    setNotification(null);

    try {
      const pathSet = generatePathSetV1(cloneDomainState(domainRef.current));
      const content = JSON.stringify(pathSet, null, 2);

      if (!isFileSystemAccessSupported()) {
        downloadText(PATH_SET_FILE_NAME, content, PATH_SET_MIME_TYPE);
        setNotification(
          toJsonFileDownloadedSuccessNotification(PATH_SET_FILE_NAME),
        );
        return;
      }

      const handle = await saveJsonFileAs(content, {
        description: PATH_SET_FILE_DESCRIPTION,
        suggestedName: PATH_SET_FILE_NAME,
      });
      setNotification(toJsonFileSavedSuccessNotification(handle.handle.name));
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
  }, [setNotification]);

  return useMemo<PathSetExportCommands>(() => {
    return {
      exportPathSetV1,
    };
  }, [exportPathSetV1]);
};
