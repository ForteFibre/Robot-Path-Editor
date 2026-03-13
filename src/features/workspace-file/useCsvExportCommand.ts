import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_CSV_EXPORT_STEP,
  MIN_CSV_EXPORT_STEP,
} from '../../domain/metricScale';
import type { AppNotification } from '../../errors';
import { generateWorkspaceCsvFiles } from '../../io/csv';
import {
  isDirectoryExportSupported,
  isDirectoryPickerAbortError,
  type FileToWrite,
  writeFilesToDirectory,
} from '../../io/fileSystemAccess';
import { downloadText } from '../../io/workspaceIO';
import { cloneDomainState } from '../../store/slices/pathSlice';
import { selectDomainState } from '../../store/workspaceSelectors';
import { useWorkspaceStore } from '../../store/workspaceStore';
import {
  notifyFileOperationError,
  toCsvDirectoryExportSuccessNotification,
  toCsvDownloadExportSuccessNotification,
} from './fileOperationNotifications';
import type { CsvExportCommands } from './types';

type NotificationSetter = (notification: AppNotification | null) => void;

type UseCsvExportCommandOptions = {
  setNotification: NotificationSetter;
};

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

export const useCsvExportCommand = ({
  setNotification,
}: UseCsvExportCommandOptions): CsvExportCommands => {
  const [csvTarget, setCsvTarget] =
    useState<CsvExportCommands['csvExport']['target']>('all');
  const [csvStep, setCsvStep] = useState(DEFAULT_CSV_EXPORT_STEP);
  const domain = useWorkspaceStore(selectDomainState);
  const domainRef = useRef(domain);

  useEffect(() => {
    domainRef.current = domain;
  }, [domain]);

  const csvExport = useMemo<CsvExportCommands['csvExport']>(() => {
    return {
      step: csvStep,
      target: csvTarget,
      setStep: (step: number) => {
        setCsvStep(Math.max(MIN_CSV_EXPORT_STEP, step));
      },
      setTarget: (target) => {
        setCsvTarget(target);
      },
    };
  }, [csvStep, csvTarget]);

  const exportCsv = useCallback(async (): Promise<void> => {
    setNotification(null);

    try {
      const files = generateWorkspaceCsvFiles(
        cloneDomainState(domainRef.current),
        {
          step: csvStep,
          target: csvTarget,
        },
      ).map((file) => ({
        filename: file.filename,
        content: file.content,
        mimeType: 'text/csv;charset=utf-8',
      }));

      const result = await exportFilesWithFallback(files);

      if (result === null) {
        setNotification(toCsvDownloadExportSuccessNotification(files.length));
        return;
      }

      setNotification(
        toCsvDirectoryExportSuccessNotification({
          writtenCount: result.writtenCount,
          directoryName: result.directoryName,
        }),
      );
    } catch (error: unknown) {
      if (isDirectoryPickerAbortError(error)) {
        return;
      }

      notifyFileOperationError(
        error,
        {
          kind: 'error',
          error: { kind: 'csv-export', reason: 'write-failed' },
        },
        setNotification,
      );
    }
  }, [csvStep, csvTarget, setNotification]);

  return useMemo<CsvExportCommands>(() => {
    return {
      csvExport,
      exportCsv,
    };
  }, [csvExport, exportCsv]);
};
