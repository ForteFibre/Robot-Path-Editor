import { useMemo } from 'react';
import { useWorkspaceActions } from '../../store/workspaceStore';

type ToolbarActions = Pick<
  ReturnType<typeof useWorkspaceActions>,
  'setMode' | 'setTool'
>;

export const useToolbarActions = (): ToolbarActions => {
  const { setMode, setTool } = useWorkspaceActions();

  return useMemo(
    () => ({
      setMode,
      setTool,
    }),
    [setMode, setTool],
  );
};
