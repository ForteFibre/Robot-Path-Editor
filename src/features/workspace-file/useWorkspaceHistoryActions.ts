import { useMemo } from 'react';
import { useWorkspaceHistory } from '../../store/workspaceHistory';
import { useWorkspaceActions } from '../../store/workspaceStore';

type WorkspaceHistoryActions = Pick<
  ReturnType<typeof useWorkspaceHistory>,
  'canRedo' | 'canUndo'
> &
  Pick<ReturnType<typeof useWorkspaceActions>, 'redo' | 'undo'>;

export const useWorkspaceHistoryActions = (): WorkspaceHistoryActions => {
  const { redo, undo } = useWorkspaceActions();
  const { canRedo, canUndo } = useWorkspaceHistory();

  return useMemo(
    () => ({
      canRedo,
      canUndo,
      redo,
      undo,
    }),
    [canRedo, canUndo, redo, undo],
  );
};
