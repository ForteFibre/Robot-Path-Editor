import { type ReactElement, useMemo } from 'react';
import './App.css';
import appShellStyles from './features/app-shell/AppShell.module.css';
import { PathCanvas } from './features/canvas/PathCanvas';
import { AppConfirmationDialog } from './features/app-shell/AppConfirmationDialog';
import { AppConfirmationProvider } from './features/app-shell/AppConfirmationContext';
import {
  AppNotificationProvider,
  useAppNotification,
} from './features/app-shell/AppNotificationContext';
import { FloatingInspector } from './features/floating/FloatingInspector';
import { useFloatingInspectorLayout } from './features/floating/useFloatingInspectorLayout';
import { AppNotificationBanner } from './features/app-shell/AppNotificationBanner';
import { PwaUpdateBanner } from './features/pwa/PwaUpdateBanner';
import { PathDetailsPanel } from './features/path-details/PathDetailsPanel';
import { WorkspaceRestoreDialog } from './features/persistence/WorkspaceRestoreDialog';
import { useWorkspacePersistence } from './features/persistence/useWorkspacePersistence';
import { WorkspaceEditorProvider } from './features/app-shell/WorkspaceEditorContext';
import { Sidebar } from './features/sidebar/Sidebar';
import { Toolbar } from './features/toolbar/Toolbar';
import { WorkspaceFileConflictDialog } from './features/workspace-file/WorkspaceFileConflictDialog';
import { useCsvExportCommand } from './features/workspace-file/useCsvExportCommand';
import { useWorkspaceConflictDialogController } from './features/workspace-file/useWorkspaceConflictDialogController';
import { useWorkspaceFileCommands } from './features/workspace-file/useWorkspaceFileCommands';
import { usePwaController } from './pwa/usePwaController';

const EditorApp = (): ReactElement => {
  const { notification, setNotification, clearNotification } =
    useAppNotification();
  const { appBodyRef, sidebarRef, layout } = useFloatingInspectorLayout();
  const pwaController = usePwaController();
  const workspacePersistence = useWorkspacePersistence({
    setNotification,
  });
  const { workspaceCommands } = useWorkspaceFileCommands({
    persistence: workspacePersistence,
    setNotification,
  });
  const { conflictDialogProps } = useWorkspaceConflictDialogController({
    persistence: workspacePersistence,
    setNotification,
  });
  const csvExportCommand = useCsvExportCommand({
    setNotification,
  });
  const toolbarCommands = useMemo(
    () => ({
      ...workspaceCommands,
      ...csvExportCommand,
    }),
    [csvExportCommand, workspaceCommands],
  );

  return (
    <div className={appShellStyles.appShell}>
      <Toolbar workspaceCommands={toolbarCommands} />

      <PwaUpdateBanner
        isVisible={pwaController.isUpdateBannerVisible}
        onDismiss={pwaController.dismissUpdate}
        onUpdate={() => {
          void pwaController.applyUpdate();
        }}
      />

      <AppNotificationBanner
        notification={notification}
        onDismiss={clearNotification}
      />

      <div className={appShellStyles.appBody} ref={appBodyRef}>
        <WorkspaceEditorProvider>
          <Sidebar hostRef={sidebarRef} />
          <PathCanvas />
          <PathDetailsPanel />
          <FloatingInspector layout={layout} />
        </WorkspaceEditorProvider>
      </div>

      <WorkspaceRestoreDialog {...workspacePersistence.restoreDialog} />

      <WorkspaceFileConflictDialog {...conflictDialogProps} />

      <AppConfirmationDialog />
    </div>
  );
};

const App = (): ReactElement => {
  return (
    <AppNotificationProvider>
      <AppConfirmationProvider>
        <EditorApp />
      </AppConfirmationProvider>
    </AppNotificationProvider>
  );
};

export default App;
