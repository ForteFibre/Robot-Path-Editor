import { useState, type ReactElement } from 'react';
import './App.css';
import { DEFAULT_CSV_EXPORT_STEP } from './domain/metricScale';
import { PathCanvas } from './features/canvas/PathCanvas';
import { FloatingInspector } from './features/floating/FloatingInspector';
import { Sidebar } from './features/sidebar/Sidebar';
import { Toolbar } from './features/toolbar/Toolbar';
import { PathDetailsPanel } from './features/path-details/PathDetailsPanel';
import { generateWorkspaceCsvFiles, type CsvTarget } from './io/csv';
import {
  type FileToWrite,
  isDirectoryPickerAbortError,
  isDirectoryExportSupported,
  writeFilesToDirectory,
} from './io/fileSystemAccess';
import {
  deserializeWorkspace,
  downloadText,
  serializeWorkspace,
} from './io/workspaceIO';
import {
  getDomainSnapshot,
  getWorkspacePersistedState,
  useWorkspaceActions,
} from './store/workspaceStore';

const IMPORT_ERROR_PREFIX =
  'JSONの読み込みに失敗しました。現行形式の workspace.json を選択してください。';
const JSON_EXPORT_ERROR_PREFIX = 'JSONの書き込みに失敗しました。';
const CSV_EXPORT_ERROR_PREFIX = 'CSVの書き込みに失敗しました。';

type AppStatus = {
  tone: 'error' | 'info' | 'success';
  message: string;
};

const toImportErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.length > 0) {
    return `${IMPORT_ERROR_PREFIX} (${error.message})`;
  }

  return IMPORT_ERROR_PREFIX;
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

const toJsonExportSuccessMessage = (directoryName: string): string => {
  return `JSONを 1 ファイル、フォルダ「${directoryName}」に出力しました。`;
};

const EditorApp = (): ReactElement => {
  const { importWorkspace } = useWorkspaceActions();
  const [csvTarget, setCsvTarget] = useState<CsvTarget>('all');
  const [csvStep, setCsvStep] = useState(DEFAULT_CSV_EXPORT_STEP);
  const [importError, setImportError] = useState<string | null>(null);
  const [appStatus, setAppStatus] = useState<AppStatus | null>(null);

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

  const handleExportJson = async (): Promise<void> => {
    setAppStatus(null);

    try {
      const json = serializeWorkspace(getWorkspacePersistedState());
      const result = await exportFilesWithFallback([
        {
          filename: 'workspace.json',
          content: json,
          mimeType: 'application/json',
        },
      ]);

      if (result !== null) {
        setAppStatus({
          tone: 'success',
          message: toJsonExportSuccessMessage(result.directoryName),
        });
      }
    } catch (error: unknown) {
      if (isDirectoryPickerAbortError(error)) {
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
    setImportError(null);

    try {
      const content = await file.text();
      const imported = deserializeWorkspace(content);
      importWorkspace(imported);
    } catch (error: unknown) {
      setImportError(toImportErrorMessage(error));
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
        onCsvTargetChange={setCsvTarget}
        onCsvStepChange={setCsvStep}
        onExportJson={() => {
          void handleExportJson();
        }}
        onImportJson={handleImportJson}
        onExportCsv={() => {
          void handleExportCsv();
        }}
      />

      {appStatusBanner}

      {importError === null ? null : (
        <div
          className="app-status app-status-error"
          role="alert"
          aria-live="assertive"
        >
          <span>{importError}</span>
          <button
            type="button"
            onClick={() => {
              setImportError(null);
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
    </div>
  );
};

const App = (): ReactElement => {
  return <EditorApp />;
};

export default App;
