import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as pathSetExportModule from '../../io/pathSetExport';
import type * as workspaceFileAccessModule from '../../io/workspaceFileAccess';
import type * as workspaceIOModule from '../../io/workspaceIO';
import { usePathSetExportCommand } from '../../features/workspace-file/usePathSetExportCommand';
import { generatePathSetV1 } from '../../io/pathSetExport';
import {
  isFileSystemAccessSupported,
  saveJsonFileAs,
} from '../../io/workspaceFileAccess';
import { downloadText } from '../../io/workspaceIO';

vi.mock('../../io/pathSetExport', async () => {
  const actual = await vi.importActual<typeof pathSetExportModule>(
    '../../io/pathSetExport',
  );

  return {
    ...actual,
    generatePathSetV1: vi.fn(),
  };
});

vi.mock('../../io/workspaceFileAccess', async () => {
  const actual = await vi.importActual<typeof workspaceFileAccessModule>(
    '../../io/workspaceFileAccess',
  );

  return {
    ...actual,
    isFileSystemAccessSupported: vi.fn(),
    saveJsonFileAs: vi.fn(),
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

describe('usePathSetExportCommand', () => {
  const mockedGeneratePathSetV1 = vi.mocked(generatePathSetV1);
  const mockedIsFileSystemAccessSupported = vi.mocked(
    isFileSystemAccessSupported,
  );
  const mockedSaveJsonFileAs = vi.mocked(saveJsonFileAs);
  const mockedDownloadText = vi.mocked(downloadText);

  beforeEach(() => {
    vi.clearAllMocks();
    mockedGeneratePathSetV1.mockReturnValue({
      $schema:
        'https://fibril-path-editor.fortefibre.net/schemas/path-set-v1.schema.json',
      schema_version: 1,
      units: {
        angle: 'rad',
        length: 'm',
      },
      paths: {},
      points: {},
    });
    mockedIsFileSystemAccessSupported.mockReturnValue(true);
    mockedSaveJsonFileAs.mockResolvedValue({
      handle: {
        kind: 'file',
        name: 'picked-path-set.json',
      } as FileSystemFileHandle,
      lastModified: 1,
    });
  });

  it('saves the path set through the save file picker when supported', async () => {
    const setNotification = vi.fn();

    const { result } = renderHook(() =>
      usePathSetExportCommand({
        setNotification,
      }),
    );

    await act(async () => {
      await result.current.exportPathSetV1();
    });

    expect(mockedSaveJsonFileAs).toHaveBeenCalledWith(
      expect.stringContaining('"schema_version": 1'),
      {
        description: 'Path Set JSON',
        suggestedName: 'path-set.json',
      },
    );
    expect(mockedDownloadText).not.toHaveBeenCalled();
    expect(setNotification).toHaveBeenLastCalledWith({
      kind: 'success',
      message: 'JSONを「picked-path-set.json」に保存しました。',
    });
  });

  it('falls back to download when file system access is unsupported', async () => {
    const setNotification = vi.fn();
    mockedIsFileSystemAccessSupported.mockReturnValue(false);

    const { result } = renderHook(() =>
      usePathSetExportCommand({
        setNotification,
      }),
    );

    await act(async () => {
      await result.current.exportPathSetV1();
    });

    expect(mockedDownloadText).toHaveBeenCalledWith(
      'path-set.json',
      expect.stringContaining('"schema_version": 1'),
      'application/json',
    );
    expect(mockedSaveJsonFileAs).not.toHaveBeenCalled();
    expect(setNotification).toHaveBeenLastCalledWith({
      kind: 'success',
      message: 'path-set.json をダウンロードしました。',
    });
  });

  it('ignores save picker cancellation', async () => {
    const setNotification = vi.fn();
    mockedSaveJsonFileAs.mockRejectedValue(
      new DOMException('The user aborted a request.', 'AbortError'),
    );

    const { result } = renderHook(() =>
      usePathSetExportCommand({
        setNotification,
      }),
    );

    await act(async () => {
      await result.current.exportPathSetV1();
    });

    expect(setNotification).toHaveBeenCalledTimes(1);
    expect(setNotification).toHaveBeenCalledWith(null);
  });
});
