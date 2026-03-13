import { useMemo } from 'react';
import { useWorkspaceActions } from '../../store/workspaceStore';

type PathDetailsActions = Pick<
  ReturnType<typeof useWorkspaceActions>,
  'reorderWaypoint' | 'setSelection'
>;

export const usePathDetailsActions = (): PathDetailsActions => {
  const { reorderWaypoint, setSelection } = useWorkspaceActions();

  return useMemo(
    () => ({
      reorderWaypoint,
      setSelection,
    }),
    [reorderWaypoint, setSelection],
  );
};
