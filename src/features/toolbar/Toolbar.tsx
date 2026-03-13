import { type ReactElement } from 'react';
import { useEditorMode, useEditorTool } from '../../store/workspaceSelectors';
import { useWorkspaceHistoryActions } from '../workspace-file/useWorkspaceHistoryActions';
import type { WorkspaceToolbarCommands } from '../workspace-file/types';
import { FileMenu } from './components/FileMenu';
import { SettingsMenu } from './components/SettingsMenu';
import { useWorkspaceSaveHotkeys } from './components/useWorkspaceSaveHotkeys';
import { useUndoRedoHotkeys } from './hooks/useUndoRedoHotkeys';
import { ToolbarPresenter } from './ToolbarPresenter';
import { useToolbarActions } from './useToolbarActions';

type ToolbarProps = {
  workspaceCommands: WorkspaceToolbarCommands;
};

export const Toolbar = ({ workspaceCommands }: ToolbarProps): ReactElement => {
  const { setMode, setTool } = useToolbarActions();
  const { canRedo, canUndo, redo, undo } = useWorkspaceHistoryActions();
  const mode = useEditorMode();
  const tool = useEditorTool();

  useUndoRedoHotkeys();
  useWorkspaceSaveHotkeys({ workspaceCommands });

  return (
    <ToolbarPresenter
      mode={mode}
      tool={tool}
      canUndo={canUndo}
      canRedo={canRedo}
      onSelectPathMode={() => {
        setMode('path');
      }}
      onSelectHeadingMode={() => {
        setMode('heading');
      }}
      onSelectTool={setTool}
      onUndo={() => {
        undo();
      }}
      onRedo={() => {
        redo();
      }}
      fileMenu={<FileMenu workspaceCommands={workspaceCommands} />}
      settingsMenu={<SettingsMenu />}
    />
  );
};
