import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useWorkspaceFileLink } from '../../features/persistence/useWorkspaceFileLink';

const createFileHandle = (options?: {
  fileName?: string;
  fileText?: string;
  lastModified?: number;
}) => {
  const {
    fileName = 'workspace.json',
    fileText = '{"workspace":true}',
    lastModified = 1_762_000_000_000,
  } = options ?? {};
  let currentText = fileText;
  let currentLastModified = lastModified;
  const getFile = vi.fn(() =>
    Promise.resolve(
      new File([currentText], fileName, {
        type: 'application/json',
        lastModified: currentLastModified,
      }),
    ),
  );

  return {
    handle: {
      getFile,
      kind: 'file',
      name: fileName,
    } as unknown as FileSystemFileHandle,
    setFile: (next: { fileText?: string; lastModified?: number }) => {
      currentText = next.fileText ?? currentText;
      currentLastModified = next.lastModified ?? currentLastModified;
    },
  };
};

describe('useWorkspaceFileLink', () => {
  it('restores a linked file handle from persistence on mount', async () => {
    const restoredFile = createFileHandle({
      fileName: 'restored-workspace.json',
      lastModified: 1_762_000_000_100,
    });

    const { result } = renderHook(() =>
      useWorkspaceFileLink({
        importWorkspaceJsonSource: vi.fn(() => Promise.resolve(true)),
        isFileSystemAccessSupportedFn: () => true,
        loadLinkedFileHandleFn: vi.fn(() =>
          Promise.resolve({
            handle: restoredFile.handle,
            lastKnownModifiedAt: 1_762_000_000_100,
          }),
        ),
      }),
    );

    await waitFor(() => {
      expect(result.current.linkedFileName).toBe('restored-workspace.json');
      expect(result.current.linkedFileHandle).toBe(restoredFile.handle);
    });
  });

  it('imports a picked workspace and persists its linked handle metadata', async () => {
    const linkedFile = createFileHandle({
      fileName: 'picked-workspace.json',
      lastModified: 1_762_000_000_200,
    });
    const importWorkspaceJsonSource = vi.fn(() => Promise.resolve(true));
    const saveLinkedFileHandleFn = vi.fn(() => Promise.resolve());

    const { result } = renderHook(() =>
      useWorkspaceFileLink({
        importWorkspaceJsonSource,
        isFileSystemAccessSupportedFn: () => true,
        loadLinkedFileHandleFn: vi.fn(() => Promise.resolve(null)),
        openWorkspaceFileFn: vi.fn(() =>
          Promise.resolve({
            handle: linkedFile.handle,
            lastModified: 1_762_000_000_200,
            text: '{"workspace":true}',
          }),
        ),
        saveLinkedFileHandleFn,
      }),
    );

    await act(async () => {
      await result.current.openWithFilePicker();
    });

    expect(importWorkspaceJsonSource).toHaveBeenCalledWith(
      '{"workspace":true}',
    );
    expect(saveLinkedFileHandleFn).toHaveBeenCalledWith({
      handle: linkedFile.handle,
      lastKnownModifiedAt: 1_762_000_000_200,
    });

    await waitFor(() => {
      expect(result.current.linkedFileName).toBe('picked-workspace.json');
    });
  });

  it('does not link a picked file when import fails', async () => {
    const linkedFile = createFileHandle({
      fileName: 'invalid-workspace.json',
      fileText: '{"workspace":false}',
    });
    const saveLinkedFileHandleFn = vi.fn(() => Promise.resolve());

    const { result } = renderHook(() =>
      useWorkspaceFileLink({
        importWorkspaceJsonSource: vi.fn(() => Promise.resolve(false)),
        isFileSystemAccessSupportedFn: () => true,
        loadLinkedFileHandleFn: vi.fn(() => Promise.resolve(null)),
        openWorkspaceFileFn: vi.fn(() =>
          Promise.resolve({
            handle: linkedFile.handle,
            lastModified: 1_762_000_000_000,
            text: '{"workspace":false}',
          }),
        ),
        saveLinkedFileHandleFn,
      }),
    );

    await act(async () => {
      await result.current.openWithFilePicker();
    });

    expect(saveLinkedFileHandleFn).not.toHaveBeenCalled();
    expect(result.current.linkedFileHandle).toBeNull();
  });

  it('overwrites the linked file when saving with an existing handle', async () => {
    const linkedFile = createFileHandle({
      fileName: 'linked-workspace.json',
      lastModified: 1_762_000_000_300,
    });
    const overwriteWorkspaceFileFn = vi.fn(() =>
      Promise.resolve({
        handle: linkedFile.handle,
        lastModified: 1_762_000_000_301,
      }),
    );
    const saveLinkedFileHandleFn = vi.fn(() => Promise.resolve());

    const { result } = renderHook(() =>
      useWorkspaceFileLink({
        importWorkspaceJsonSource: vi.fn(() => Promise.resolve(true)),
        isFileSystemAccessSupportedFn: () => true,
        loadLinkedFileHandleFn: vi.fn(() =>
          Promise.resolve({
            handle: linkedFile.handle,
            lastKnownModifiedAt: 1_762_000_000_300,
          }),
        ),
        overwriteWorkspaceFileFn,
        saveLinkedFileHandleFn,
        serializeWorkspaceFn: vi.fn(() => '{"workspace":true}'),
      }),
    );

    await waitFor(() => {
      expect(result.current.linkedFileHandle).toBe(linkedFile.handle);
    });

    await act(async () => {
      await result.current.save();
    });

    expect(overwriteWorkspaceFileFn).toHaveBeenCalledWith(
      linkedFile.handle,
      '{"workspace":true}',
    );
    expect(saveLinkedFileHandleFn).toHaveBeenCalledWith({
      handle: linkedFile.handle,
      lastKnownModifiedAt: 1_762_000_000_301,
    });
  });

  it('falls back to Save As when no linked handle exists', async () => {
    const saveAsFile = createFileHandle({
      fileName: 'save-as-workspace.json',
    });
    const saveWorkspaceFileAsFn = vi.fn(() =>
      Promise.resolve({
        handle: saveAsFile.handle,
        lastModified: 1_762_000_000_400,
      }),
    );
    const saveLinkedFileHandleFn = vi.fn(() => Promise.resolve());

    const { result } = renderHook(() =>
      useWorkspaceFileLink({
        importWorkspaceJsonSource: vi.fn(() => Promise.resolve(true)),
        isFileSystemAccessSupportedFn: () => true,
        loadLinkedFileHandleFn: vi.fn(() => Promise.resolve(null)),
        saveLinkedFileHandleFn,
        saveWorkspaceFileAsFn,
        serializeWorkspaceFn: vi.fn(() => '{"workspace":true}'),
      }),
    );

    await act(async () => {
      await result.current.save();
    });

    expect(saveWorkspaceFileAsFn).toHaveBeenCalledWith('{"workspace":true}');
    expect(saveLinkedFileHandleFn).toHaveBeenCalledWith({
      handle: saveAsFile.handle,
      lastKnownModifiedAt: 1_762_000_000_400,
    });

    await waitFor(() => {
      expect(result.current.linkedFileName).toBe('save-as-workspace.json');
    });
  });

  it('detects an externally modified linked file before saving', async () => {
    const linkedFile = createFileHandle({
      fileName: 'linked-workspace.json',
      lastModified: 1_762_000_000_500,
    });
    linkedFile.setFile({ lastModified: 1_762_000_000_900 });
    const overwriteWorkspaceFileFn = vi.fn(() =>
      Promise.resolve({
        handle: linkedFile.handle,
        lastModified: 1_762_000_000_901,
      }),
    );
    const saveLinkedFileHandleFn = vi.fn(() => Promise.resolve());

    const { result } = renderHook(() =>
      useWorkspaceFileLink({
        importWorkspaceJsonSource: vi.fn(() => Promise.resolve(true)),
        isFileSystemAccessSupportedFn: () => true,
        loadLinkedFileHandleFn: vi.fn(() =>
          Promise.resolve({
            handle: linkedFile.handle,
            lastKnownModifiedAt: 1_762_000_000_500,
          }),
        ),
        overwriteWorkspaceFileFn,
        saveLinkedFileHandleFn,
        serializeWorkspaceFn: vi.fn(() => '{"workspace":true}'),
      }),
    );

    await waitFor(() => {
      expect(result.current.linkedFileHandle).toBe(linkedFile.handle);
    });

    await act(async () => {
      await result.current.save();
    });

    expect(overwriteWorkspaceFileFn).not.toHaveBeenCalled();
    expect(result.current.pendingSaveConflict).toEqual({
      fileName: 'linked-workspace.json',
      lastKnownModifiedAt: 1_762_000_000_500,
      linkedFileModifiedAt: 1_762_000_000_900,
    });

    await act(async () => {
      await result.current.confirmOverwrite();
    });

    expect(overwriteWorkspaceFileFn).toHaveBeenCalledWith(
      linkedFile.handle,
      '{"workspace":true}',
    );
    expect(saveLinkedFileHandleFn).toHaveBeenLastCalledWith({
      handle: linkedFile.handle,
      lastKnownModifiedAt: 1_762_000_000_901,
    });
    expect(result.current.pendingSaveConflict).toBeNull();
  });

  it('loads the latest content from the linked file and updates the known timestamp', async () => {
    const linkedFile = createFileHandle({
      fileName: 'linked-workspace.json',
      fileText: '{"workspace":"latest"}',
      lastModified: 1_762_000_001_000,
    });
    const importWorkspaceJsonSource = vi.fn(() => Promise.resolve(true));
    const saveLinkedFileHandleFn = vi.fn(() => Promise.resolve());

    const { result } = renderHook(() =>
      useWorkspaceFileLink({
        importWorkspaceJsonSource,
        isFileSystemAccessSupportedFn: () => true,
        loadLinkedFileHandleFn: vi.fn(() =>
          Promise.resolve({
            handle: linkedFile.handle,
            lastKnownModifiedAt: 1_762_000_000_500,
          }),
        ),
        saveLinkedFileHandleFn,
      }),
    );

    await act(async () => {
      await result.current.loadLatestFromLinkedFile();
    });

    expect(importWorkspaceJsonSource).toHaveBeenCalledWith(
      '{"workspace":"latest"}',
      { closeRestoreDialog: true },
    );
    expect(saveLinkedFileHandleFn).toHaveBeenCalledWith({
      handle: linkedFile.handle,
      lastKnownModifiedAt: 1_762_000_001_000,
    });
  });

  it('clears the linked handle and persistence record', async () => {
    const linkedFile = createFileHandle({
      fileName: 'linked-workspace.json',
      lastModified: 1_762_000_000_700,
    });
    const deleteLinkedFileHandleFn = vi.fn(() => Promise.resolve());

    const { result } = renderHook(() =>
      useWorkspaceFileLink({
        deleteLinkedFileHandleFn,
        importWorkspaceJsonSource: vi.fn(() => Promise.resolve(true)),
        isFileSystemAccessSupportedFn: () => true,
        loadLinkedFileHandleFn: vi.fn(() =>
          Promise.resolve({
            handle: linkedFile.handle,
            lastKnownModifiedAt: 1_762_000_000_700,
          }),
        ),
      }),
    );

    await waitFor(() => {
      expect(result.current.linkedFileName).toBe('linked-workspace.json');
    });

    await act(async () => {
      await result.current.clearLink();
    });

    expect(deleteLinkedFileHandleFn).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(result.current.linkedFileHandle).toBeNull();
      expect(result.current.linkedFileName).toBeNull();
    });
  });
});
