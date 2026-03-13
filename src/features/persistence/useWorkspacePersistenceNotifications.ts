import { useEffect, useMemo } from 'react';
import type { AppNotification } from '../../errors';
import {
  toLinkedFileUnreadableNotification,
  toRecoveredWorkspaceNotification,
  type NotificationSetter,
} from './persistenceNotifications';
import type {
  WorkspaceAutosaveState,
  WorkspacePersistenceBootstrapResult,
} from './types';

type UseWorkspacePersistenceNotificationsOptions = {
  autosaveState: WorkspaceAutosaveState;
  bootstrapResult: WorkspacePersistenceBootstrapResult | null;
  setNotification: NotificationSetter;
};

type UseWorkspacePersistenceNotificationsResult = {
  recoveredNotification: AppNotification | null;
};

export const useWorkspacePersistenceNotifications = ({
  autosaveState,
  bootstrapResult,
  setNotification,
}: UseWorkspacePersistenceNotificationsOptions): UseWorkspacePersistenceNotificationsResult => {
  const recoveredNotification = useMemo<AppNotification | null>(() => {
    return toRecoveredWorkspaceNotification(bootstrapResult);
  }, [bootstrapResult]);
  const linkedFileUnreadableNotification =
    useMemo<AppNotification | null>(() => {
      return toLinkedFileUnreadableNotification(bootstrapResult);
    }, [bootstrapResult]);

  useEffect(() => {
    if (recoveredNotification === null) {
      return;
    }

    setNotification(recoveredNotification);
  }, [recoveredNotification, setNotification]);

  useEffect(() => {
    if (linkedFileUnreadableNotification === null) {
      return;
    }

    setNotification(linkedFileUnreadableNotification);
  }, [linkedFileUnreadableNotification, setNotification]);

  useEffect(() => {
    if (autosaveState.kind !== 'error') {
      return;
    }

    setNotification({
      kind: 'error',
      error: autosaveState.error,
    });
  }, [autosaveState, setNotification]);

  return {
    recoveredNotification,
  };
};
