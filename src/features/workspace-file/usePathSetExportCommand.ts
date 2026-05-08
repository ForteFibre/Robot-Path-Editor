import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { AppNotification } from '../../errors';
import { generatePathSetV1 } from '../../io/pathSetExport';
import { downloadText } from '../../io/workspaceIO';
import { cloneDomainState } from '../../store/slices/pathSlice';
import { selectDomainState } from '../../store/workspaceSelectors';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { notifyFileOperationError } from './fileOperationNotifications';
import type { PathSetExportCommands } from './types';

type NotificationSetter = (notification: AppNotification | null) => void;

type UsePathSetExportCommandOptions = {
  setNotification: NotificationSetter;
};

export const usePathSetExportCommand = ({
  setNotification,
}: UsePathSetExportCommandOptions): PathSetExportCommands => {
  const domain = useWorkspaceStore(selectDomainState);
  const domainRef = useRef(domain);

  useEffect(() => {
    domainRef.current = domain;
  }, [domain]);

  const exportPathSetV1 = useCallback((): Promise<void> => {
    setNotification(null);

    try {
      const pathSet = generatePathSetV1(cloneDomainState(domainRef.current));
      const content = JSON.stringify(pathSet, null, 2);
      downloadText('path-set.json', content, 'application/json');
      setNotification({
        kind: 'success',
        message: 'Path Set をダウンロードしました。',
      });
    } catch (error: unknown) {
      notifyFileOperationError(
        error,
        {
          kind: 'error',
          error: { kind: 'workspace-export', reason: 'write-failed' },
        },
        setNotification,
      );
    }

    return Promise.resolve();
  }, [setNotification]);

  return useMemo<PathSetExportCommands>(() => {
    return {
      exportPathSetV1,
    };
  }, [exportPathSetV1]);
};
