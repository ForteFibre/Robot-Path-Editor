import { useMemo } from 'react';
import { useWorkspaceActions } from '../../store/workspaceStore';

type WorkspacePersistenceStoreActions = Pick<
  ReturnType<typeof useWorkspaceActions>,
  'importWorkspaceDocument' | 'resetWorkspace' | 'restoreWorkspaceAutosave'
>;

export const useWorkspacePersistenceStoreActions =
  (): WorkspacePersistenceStoreActions => {
    const {
      importWorkspaceDocument,
      resetWorkspace,
      restoreWorkspaceAutosave,
    } = useWorkspaceActions();

    return useMemo(
      () => ({
        importWorkspaceDocument,
        resetWorkspace,
        restoreWorkspaceAutosave,
      }),
      [importWorkspaceDocument, resetWorkspace, restoreWorkspaceAutosave],
    );
  };
