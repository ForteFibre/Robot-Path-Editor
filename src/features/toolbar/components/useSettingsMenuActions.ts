import { useMemo } from 'react';
import { useWorkspaceActions } from '../../../store/workspaceStore';

type SettingsMenuActions = Pick<
  ReturnType<typeof useWorkspaceActions>,
  | 'setBackgroundImage'
  | 'setRobotPreviewEnabled'
  | 'setRobotSettings'
  | 'setTool'
  | 'updateBackgroundImage'
>;

export const useSettingsMenuActions = (): SettingsMenuActions => {
  const actions = useWorkspaceActions();
  const {
    setBackgroundImage,
    setRobotPreviewEnabled,
    setRobotSettings,
    setTool,
    updateBackgroundImage,
  } = actions;

  return useMemo(
    () => ({
      setBackgroundImage,
      setRobotPreviewEnabled,
      setRobotSettings,
      setTool,
      updateBackgroundImage,
    }),
    [
      setBackgroundImage,
      setRobotPreviewEnabled,
      setRobotSettings,
      setTool,
      updateBackgroundImage,
    ],
  );
};
