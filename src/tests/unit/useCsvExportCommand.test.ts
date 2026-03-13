import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as csvModule from '../../io/csv';
import type * as fileSystemAccessModule from '../../io/fileSystemAccess';
import type * as workspaceIOModule from '../../io/workspaceIO';
import { generateWorkspaceCsvFiles } from '../../io/csv';
import {
  isDirectoryExportSupported,
  writeFilesToDirectory,
} from '../../io/fileSystemAccess';
import { downloadText } from '../../io/workspaceIO';
import { useCsvExportCommand } from '../../features/workspace-file/useCsvExportCommand';

vi.mock('../../io/csv', async () => {
  const actual = await vi.importActual<typeof csvModule>('../../io/csv');

  return {
    ...actual,
    generateWorkspaceCsvFiles: vi.fn(),
  };
});

vi.mock('../../io/fileSystemAccess', async () => {
  const actual = await vi.importActual<typeof fileSystemAccessModule>(
    '../../io/fileSystemAccess',
  );

  return {
    ...actual,
    isDirectoryExportSupported: vi.fn(),
    writeFilesToDirectory: vi.fn(),
  };
});

vi.mock('../../io/workspaceIO', async () => {
  const actual = await vi.importActual<typeof workspaceIOModule>(
    '../../io/workspaceIO',
  );

  return {
    ...actual,
    downloadText: vi.fn(),
  };
});

describe('useCsvExportCommand', () => {
  const mockedGenerateWorkspaceCsvFiles = vi.mocked(generateWorkspaceCsvFiles);
  const mockedIsDirectoryExportSupported = vi.mocked(
    isDirectoryExportSupported,
  );
  const mockedWriteFilesToDirectory = vi.mocked(writeFilesToDirectory);
  const mockedDownloadText = vi.mocked(downloadText);

  beforeEach(() => {
    vi.clearAllMocks();
    mockedGenerateWorkspaceCsvFiles.mockReturnValue([]);
    mockedIsDirectoryExportSupported.mockReturnValue(true);
    mockedWriteFilesToDirectory.mockResolvedValue({
      writtenCount: 0,
      filenames: [],
      directoryName: 'exports',
    });
  });

  it('exports CSV with the hook-owned state and reports the directory result', async () => {
    const setNotification = vi.fn();
    mockedGenerateWorkspaceCsvFiles.mockReturnValue([
      {
        pathId: 'path-1',
        pathName: 'Path 1',
        filename: 'path-1.csv',
        content: 'x,y,theta\n0,0,0\n',
      },
    ]);
    mockedWriteFilesToDirectory.mockResolvedValue({
      writtenCount: 1,
      filenames: ['path-1.csv'],
      directoryName: 'robot-csv',
    });

    const { result } = renderHook(() =>
      useCsvExportCommand({
        setNotification,
      }),
    );

    act(() => {
      result.current.csvExport.setTarget('active');
      result.current.csvExport.setStep(0.25);
    });

    await act(async () => {
      await result.current.exportCsv();
    });

    expect(mockedGenerateWorkspaceCsvFiles).toHaveBeenCalledWith(
      expect.anything(),
      {
        step: 0.25,
        target: 'active',
      },
    );
    expect(mockedWriteFilesToDirectory).toHaveBeenCalledTimes(1);
    expect(setNotification).toHaveBeenLastCalledWith({
      kind: 'success',
      message: 'CSVを 1 ファイル、フォルダ「robot-csv」に出力しました。',
    });
  });

  it('falls back to downloads for CSV export when directory export is unavailable', async () => {
    const setNotification = vi.fn();
    mockedIsDirectoryExportSupported.mockReturnValue(false);
    mockedGenerateWorkspaceCsvFiles.mockReturnValue([
      {
        pathId: 'path-1',
        pathName: 'Path 1',
        filename: 'path-1.csv',
        content: 'x,y,theta\n0,0,0\n',
      },
    ]);

    const { result } = renderHook(() =>
      useCsvExportCommand({
        setNotification,
      }),
    );

    await act(async () => {
      await result.current.exportCsv();
    });

    expect(mockedDownloadText).toHaveBeenCalledWith(
      'path-1.csv',
      'x,y,theta\n0,0,0\n',
      'text/csv;charset=utf-8',
    );
    expect(setNotification).toHaveBeenLastCalledWith({
      kind: 'success',
      message: 'CSVを 1 ファイル出力しました。',
    });
  });
});
