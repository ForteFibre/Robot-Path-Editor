import { useMemo } from 'react';
import { useWorkspaceActions } from '../../store/workspaceStore';

type SidebarActions = Pick<
  ReturnType<typeof useWorkspaceActions>,
  | 'addPath'
  | 'deletePath'
  | 'duplicatePath'
  | 'recolorPath'
  | 'renamePath'
  | 'setActivePath'
  | 'togglePathVisible'
>;

export const useSidebarActions = (): SidebarActions => {
  const actions = useWorkspaceActions();
  const {
    addPath,
    deletePath,
    duplicatePath,
    recolorPath,
    renamePath,
    setActivePath,
    togglePathVisible,
  } = actions;

  return useMemo(
    () => ({
      addPath,
      deletePath,
      duplicatePath,
      recolorPath,
      renamePath,
      setActivePath,
      togglePathVisible,
    }),
    [
      addPath,
      deletePath,
      duplicatePath,
      recolorPath,
      renamePath,
      setActivePath,
      togglePathVisible,
    ],
  );
};
