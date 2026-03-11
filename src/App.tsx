import { useEffect, useState, type ReactElement } from 'react';
import './App.css';
import { DEFAULT_CSV_EXPORT_STEP } from './domain/metricScale';
import { PathCanvas } from './features/canvas/PathCanvas';
import { FloatingInspector } from './features/floating/FloatingInspector';
import { PwaUpdateBanner } from './features/pwa/PwaUpdateBanner';
import { WorkspaceFileConflictDialog } from './features/persistence/WorkspaceFileConflictDialog';
import { WorkspaceRestoreDialog } from './features/persistence/WorkspaceRestoreDialog';
import { bootstrapWorkspacePersistence } from './features/persistence/bootstrapWorkspacePersistence';
import type { WorkspacePersistenceBootstrapResult } from './features/persistence/types';
import { useWorkspaceFileLink } from './features/persistence/useWorkspaceFileLink';
import { useWorkspacePersistenceController } from './features/persistence/useWorkspacePersistenceController';
import { PathDetailsPanel } from './features/path-details/PathDetailsPanel';
import { Sidebar } from './features/sidebar/Sidebar';
import { Toolbar } from './features/toolbar/Toolbar';
import { generateWorkspaceCsvFiles, type CsvTarget } from './io/csv';
import {
  type FileToWrite,
  isDirectoryPickerAbortError,
  isDirectoryExportSupported,
  writeFilesToDirectory,
} from './io/fileSystemAccess';
import {
  isFilePickerAbortError,
  isFileSystemAccessSupported,
} from './io/workspaceFileAccess';
import { downloadText, serializeWorkspace } from './io/workspaceIO';
import {
  getDomainSnapshot,
  getWorkspacePersistedState,
} from './store/workspaceStore';
import { usePwaController } from './pwa/usePwaController';

const JSON_EXPORT_ERROR_PREFIX = 'JSONの書き込みに失敗しました。';
const JSON_IMPORT_ERROR_PREFIX = 'JSONの読み込みに失敗しました。';
const CSV_EXPORT_ERROR_PREFIX = 'CSVの書き込みに失敗しました。';

type AppStatus = {
  tone: 'error' | 'info' | 'success';
  message: string;
};

const toJsonExportErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.length > 0) {
    return `${JSON_EXPORT_ERROR_PREFIX} (${error.message})`;
  }

  return JSON_EXPORT_ERROR_PREFIX;
};

const toCsvExportErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.length > 0) {
    return `${CSV_EXPORT_ERROR_PREFIX} (${error.message})`;
  }

  return CSV_EXPORT_ERROR_PREFIX;
};

const toCsvExportSuccessMessage = (
  writtenCount: number,
  directoryName: string,
): string => {
  return `CSVを ${writtenCount} ファイル、フォルダ「${directoryName}」に出力しました。`;
};

const toJsonImportErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.length > 0) {
    return `${JSON_IMPORT_ERROR_PREFIX} (${error.message})`;
  }

  return JSON_IMPORT_ERROR_PREFIX;
};

const toJsonImportSuccessMessage = (fileName: string): string => {
  return `JSONを「${fileName}」から読み込みました。`;
};

const toJsonExportSuccessMessage = (fileName: string): string => {
  return `JSONを「${fileName}」に保存しました。`;
};

const EditorApp = (): ReactElement => {
  const [csvTarget, setCsvTarget] = useState<CsvTarget>('all');
  const [csvStep, setCsvStep] = useState(DEFAULT_CSV_EXPORT_STEP);
  const [appStatus, setAppStatus] = useState<AppStatus | null>(null);
  const [bootstrapResult, setBootstrapResult] =
    useState<WorkspacePersistenceBootstrapResult | null>(null);
  const [isFileConflictDialogBusy, setIsFileConflictDialogBusy] =
    useState(false);
  const pwaController = usePwaController();
  const persistenceController =
    useWorkspacePersistenceController(bootstrapResult);
  const workspaceFileLink = useWorkspaceFileLink({
    importWorkspaceJsonSource: persistenceController.handleImportJsonSource,
  });

  useEffect(() => {
    let isMounted = true;

    void bootstrapWorkspacePersistence()
      .then((result) => {
        if (!isMounted) {
          return;
        }

        setBootstrapResult(result);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setBootstrapResult({ kind: 'no-restore' });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const exportFilesWithFallback = async (
    files: FileToWrite[],
  ): Promise<Awaited<ReturnType<typeof writeFilesToDirectory>> | null> => {
    if (!isDirectoryExportSupported()) {
      for (const file of files) {
        downloadText(file.filename, file.content, file.mimeType);
      }

      return null;
    }

    return await writeFilesToDirectory(files);
  };

  const handleSaveWorkspace = async (): Promise<void> => {
    setAppStatus(null);

    const json = serializeWorkspace(getWorkspacePersistedState());

    if (!isFileSystemAccessSupported() || !workspaceFileLink.isSupported) {
      downloadText('workspace.json', json, 'application/json');
      return;
    }

    try {
      const handle = await workspaceFileLink.save();

      if (handle !== null) {
        setAppStatus({
          tone: 'success',
          message: toJsonExportSuccessMessage(handle.name),
        });
      }
    } catch (error: unknown) {
      if (isFilePickerAbortError(error)) {
        return;
      }

      setAppStatus({
        tone: 'error',
        message: toJsonExportErrorMessage(error),
      });
    }
  };

  const handleSaveWorkspaceAs = async (): Promise<void> => {
    setAppStatus(null);

    const json = serializeWorkspace(getWorkspacePersistedState());

    if (!isFileSystemAccessSupported() || !workspaceFileLink.isSupported) {
      downloadText('workspace.json', json, 'application/json');
      return;
    }

    try {
      const handle = await workspaceFileLink.saveAs();

      if (handle !== null) {
        setAppStatus({
          tone: 'success',
          message: toJsonExportSuccessMessage(handle.name),
        });
      }
    } catch (error: unknown) {
      if (isFilePickerAbortError(error)) {
        return;
      }

      setAppStatus({
        tone: 'error',
        message: toJsonExportErrorMessage(error),
      });
    }
  };

  const handleExportCsv = async (): Promise<void> => {
    setAppStatus(null);

    try {
      const files = generateWorkspaceCsvFiles(getDomainSnapshot(), {
        step: csvStep,
        target: csvTarget,
      }).map((file) => ({
        filename: file.filename,
        content: file.content,
        mimeType: 'text/csv;charset=utf-8',
      }));

      const result = await exportFilesWithFallback(files);

      if (result !== null) {
        setAppStatus({
          tone: 'success',
          message: toCsvExportSuccessMessage(
            result.writtenCount,
            result.directoryName,
          ),
        });
      }
    } catch (error: unknown) {
      if (isDirectoryPickerAbortError(error)) {
        return;
      }

      setAppStatus({
        tone: 'error',
        message: toCsvExportErrorMessage(error),
      });
    }
  };

  const handleImportJson = async (file: File): Promise<void> => {
    const imported = await persistenceController.handleImportJson(file);

    if (imported) {
      await workspaceFileLink.clearLink();
    }
  };

  const handleLoadWorkspace = async (): Promise<void> => {
    setAppStatus(null);

    try {
      await workspaceFileLink.openWithFilePicker();
    } catch (error: unknown) {
      if (isFilePickerAbortError(error)) {
        return;
      }

      setAppStatus({
        tone: 'error',
        message: toJsonImportErrorMessage(error),
      });
    }
  };

  const handleStartFresh = (): void => {
    void (async () => {
      await persistenceController.handleStartFresh();
      await workspaceFileLink.clearLink();
    })();
  };

  const handleRestoreDialogLoadFromFile = async (file: File): Promise<void> => {
    const imported =
      await persistenceController.handleRestoreDialogFileLoad(file);

    if (imported) {
      await workspaceFileLink.clearLink();
    }
  };

  const handleRestoreLinkedWorkspace = async (): Promise<void> => {
    setAppStatus(null);

    try {
      const imported = await workspaceFileLink.loadLatestFromLinkedFile();

      if (imported && bootstrapResult?.kind === 'conflict') {
        setAppStatus({
          tone: 'success',
          message: toJsonImportSuccessMessage(bootstrapResult.linkedFileName),
        });
      }
    } catch (error: unknown) {
      setAppStatus({
        tone: 'error',
        message: toJsonImportErrorMessage(error),
      });
    }
  };

  const handleConfirmOverwriteConflict = async (): Promise<void> => {
    setAppStatus(null);
    setIsFileConflictDialogBusy(true);

    try {
      const handle = await workspaceFileLink.confirmOverwrite();

      if (handle !== null) {
        setAppStatus({
          tone: 'success',
          message: toJsonExportSuccessMessage(handle.name),
        });
      }
    } catch (error: unknown) {
      setAppStatus({
        tone: 'error',
        message: toJsonExportErrorMessage(error),
      });
    } finally {
      setIsFileConflictDialogBusy(false);
    }
  };

  const handleLoadLatestLinkedFileConflict = async (): Promise<void> => {
    setAppStatus(null);
    setIsFileConflictDialogBusy(true);

    try {
      const imported = await workspaceFileLink.loadLatestFromLinkedFile();

      if (imported && workspaceFileLink.linkedFileName !== null) {
        setAppStatus({
          tone: 'success',
          message: toJsonImportSuccessMessage(workspaceFileLink.linkedFileName),
        });
      }
    } catch (error: unknown) {
      setAppStatus({
        tone: 'error',
        message: toJsonImportErrorMessage(error),
      });
    } finally {
      setIsFileConflictDialogBusy(false);
    }
  };

  let appStatusBanner: ReactElement | null = null;
  if (appStatus !== null) {
    const commonStatusContent = (
      <>
        <span>{appStatus.message}</span>
        <button
          type="button"
          onClick={() => {
            setAppStatus(null);
          }}
          aria-label="dismiss app status"
        >
          閉じる
        </button>
      </>
    );

    appStatusBanner =
      appStatus.tone === 'error' ? (
        <div
          className={`app-status app-status-${appStatus.tone}`}
          role="alert"
          aria-live="assertive"
        >
          {commonStatusContent}
        </div>
      ) : (
        <div
          className={`app-status app-status-${appStatus.tone}`}
          aria-live="polite"
        >
          {commonStatusContent}
        </div>
      );
  }

  return (
    <div className="app-shell">
      <Toolbar
        csvTarget={csvTarget}
        csvStep={csvStep}
        isFileSystemAccessSupported={workspaceFileLink.isSupported}
        linkedFileName={workspaceFileLink.linkedFileName}
        onCsvTargetChange={setCsvTarget}
        onCsvStepChange={setCsvStep}
        onLoadWorkspace={handleLoadWorkspace}
        onNewWorkspace={async () => {
          await persistenceController.handleNewWorkspace();
          await workspaceFileLink.clearLink();
        }}
        onSaveWorkspace={handleSaveWorkspace}
        onSaveWorkspaceAs={handleSaveWorkspaceAs}
        onImportJson={handleImportJson}
        onExportCsv={() => {
          void handleExportCsv();
        }}
      />

      <PwaUpdateBanner
        isVisible={pwaController.isUpdateBannerVisible}
        onDismiss={pwaController.dismissUpdate}
        onUpdate={() => {
          void pwaController.applyUpdate();
        }}
      />

      {appStatusBanner}

      {persistenceController.workspaceRecoveryNotice === null ? null : (
        <div className="app-status app-status-info" aria-live="polite">
          <span>{persistenceController.workspaceRecoveryNotice}</span>
          <button
            type="button"
            onClick={() => {
              persistenceController.clearWorkspaceRecoveryNotice();
            }}
            aria-label="dismiss workspace recovery notice"
          >
            閉じる
          </button>
        </div>
      )}

      {persistenceController.workspaceError === null ? null : (
        <div
          className="app-status app-status-error"
          role="alert"
          aria-live="assertive"
        >
          <span>{persistenceController.workspaceError}</span>
          <button
            type="button"
            onClick={() => {
              persistenceController.clearWorkspaceError();
            }}
            aria-label="dismiss import error"
          >
            閉じる
          </button>
        </div>
      )}

      <div className="app-body">
        <Sidebar />
        <PathCanvas />
        <PathDetailsPanel />
        <FloatingInspector />
      </div>

      <WorkspaceRestoreDialog
        result={persistenceController.restoreCandidate}
        isBusy={persistenceController.isRestoreDialogBusy}
        errorMessage={persistenceController.workspaceError}
        onStartFresh={handleStartFresh}
        onRestoreLastEdit={() => {
          void persistenceController.handleRestoreLastEdit();
        }}
        onRestoreLinkedFile={() => {
          void handleRestoreLinkedWorkspace();
        }}
        onLoadFromFile={handleRestoreDialogLoadFromFile}
      />

      <WorkspaceFileConflictDialog
        conflict={workspaceFileLink.pendingSaveConflict}
        isBusy={isFileConflictDialogBusy}
        onCancel={workspaceFileLink.cancelSaveConflict}
        onConfirmOverwrite={() => {
          void handleConfirmOverwriteConflict();
        }}
        onLoadLatestFromFile={() => {
          void handleLoadLatestLinkedFileConflict();
        }}
      />
    </div>
  );
};

const App = (): ReactElement => {
  return <EditorApp />;
};

export default App;
