import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useLinkedFileConflict } from '../../features/persistence/useLinkedFileConflict';
import type { LinkedFileRecord } from '../../features/persistence/useLinkedFileRecord';

const createLinkedFileRecord = (options?: {
  fileName?: string;
  fileLastModified?: number;
  lastKnownModifiedAt?: number | null;
}): LinkedFileRecord => {
  const {
    fileName = 'workspace.json',
    fileLastModified = 1_762_000_000_000,
    lastKnownModifiedAt = fileLastModified,
  } = options ?? {};

  return {
    handle: {
      getFile: vi.fn(() =>
        Promise.resolve(
          new File(['{}'], fileName, {
            type: 'application/json',
            lastModified: fileLastModified,
          }),
        ),
      ),
      kind: 'file',
      name: fileName,
    } as unknown as FileSystemFileHandle,
    lastKnownModifiedAt,
  };
};

describe('useLinkedFileConflict', () => {
  it('captures save conflicts when the linked file changed externally', async () => {
    const { result } = renderHook(() => useLinkedFileConflict());

    await act(async () => {
      const hasConflict = await result.current.detectSaveConflict(
        createLinkedFileRecord({
          fileName: 'linked-workspace.json',
          fileLastModified: 1_762_000_000_900,
          lastKnownModifiedAt: 1_762_000_000_500,
        }),
      );

      expect(hasConflict).toBe(true);
    });

    expect(result.current.pendingSaveConflict).toEqual({
      fileName: 'linked-workspace.json',
      lastKnownModifiedAt: 1_762_000_000_500,
      linkedFileModifiedAt: 1_762_000_000_900,
    });
  });

  it('clears pending conflict state when asked or when the file is unchanged', async () => {
    const { result } = renderHook(() => useLinkedFileConflict());

    await act(async () => {
      await result.current.detectSaveConflict(
        createLinkedFileRecord({
          fileName: 'linked-workspace.json',
          fileLastModified: 1_762_000_000_900,
          lastKnownModifiedAt: 1_762_000_000_500,
        }),
      );
    });

    act(() => {
      result.current.cancelSaveConflict();
    });

    expect(result.current.pendingSaveConflict).toBeNull();

    await act(async () => {
      const hasConflict = await result.current.detectSaveConflict(
        createLinkedFileRecord({
          fileName: 'linked-workspace.json',
          fileLastModified: 1_762_000_001_000,
          lastKnownModifiedAt: 1_762_000_001_000,
        }),
      );

      expect(hasConflict).toBe(false);
    });

    expect(result.current.pendingSaveConflict).toBeNull();
  });
});
