import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useLinkedFileRecord } from '../../features/persistence/useLinkedFileRecord';

const createFileHandle = (options?: {
  fileName?: string;
  lastModified?: number;
}) => {
  const { fileName = 'workspace.json', lastModified = 1_762_000_000_000 } =
    options ?? {};

  return {
    handle: {
      getFile: vi.fn(() =>
        Promise.resolve(
          new File(['{}'], fileName, {
            type: 'application/json',
            lastModified,
          }),
        ),
      ),
      kind: 'file',
      name: fileName,
    } as unknown as FileSystemFileHandle,
  };
};

describe('useLinkedFileRecord', () => {
  it('restores a linked file handle from persistence on mount', async () => {
    const restoredFile = createFileHandle({
      fileName: 'restored-workspace.json',
      lastModified: 1_762_000_000_100,
    });

    const { result } = renderHook(() =>
      useLinkedFileRecord({
        isSupported: true,
        loadLinkedFileHandleFn: vi.fn(() =>
          Promise.resolve({
            handle: restoredFile.handle,
            lastKnownModifiedAt: 1_762_000_000_100,
          }),
        ),
      }),
    );

    await waitFor(() => {
      expect(result.current.linkedFileHandle).toBe(restoredFile.handle);
      expect(result.current.linkedFileName).toBe('restored-workspace.json');
    });
  });

  it('persists and clears the linked file record state', async () => {
    const linkedFile = createFileHandle({
      fileName: 'picked-workspace.json',
      lastModified: 1_762_000_000_200,
    });
    const saveLinkedFileHandleFn = vi.fn(() => Promise.resolve());
    const deleteLinkedFileHandleFn = vi.fn(() => Promise.resolve());

    const { result } = renderHook(() =>
      useLinkedFileRecord({
        isSupported: true,
        deleteLinkedFileHandleFn,
        loadLinkedFileHandleFn: vi.fn(() => Promise.resolve(null)),
        saveLinkedFileHandleFn,
      }),
    );

    await act(async () => {
      await result.current.persistLinkedFileRecord({
        handle: linkedFile.handle,
        lastKnownModifiedAt: 1_762_000_000_200,
      });
    });

    expect(saveLinkedFileHandleFn).toHaveBeenCalledWith({
      handle: linkedFile.handle,
      lastKnownModifiedAt: 1_762_000_000_200,
    });
    expect(result.current.linkedFileHandle).toBe(linkedFile.handle);
    expect(result.current.linkedFileName).toBe('picked-workspace.json');

    await act(async () => {
      await result.current.clearLinkedFileRecord();
    });

    expect(deleteLinkedFileHandleFn).toHaveBeenCalledTimes(1);
    expect(result.current.linkedFileHandle).toBeNull();
    expect(result.current.linkedFileName).toBeNull();
  });
});
