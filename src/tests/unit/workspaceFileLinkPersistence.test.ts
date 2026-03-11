import { describe, expect, it } from 'vitest';
import { putIndexedDbRecord } from '../../io/indexedDb';
import {
  deleteLinkedFileHandle,
  LINKED_WORKSPACE_FILE_KEY,
  loadLinkedFileHandle,
  saveLinkedFileHandle,
} from '../../io/workspaceFileLinkPersistence';

describe('workspaceFileLinkPersistence', () => {
  it('saves and loads a linked file handle', async () => {
    const handle = {
      kind: 'file',
      name: 'linked-workspace.json',
    } as unknown as FileSystemFileHandle;

    await saveLinkedFileHandle({
      handle,
      lastKnownModifiedAt: 1_762_000_000_000,
    });

    await expect(loadLinkedFileHandle()).resolves.toEqual({
      handle,
      lastKnownModifiedAt: 1_762_000_000_000,
    });
  });

  it('deletes a linked file handle record', async () => {
    const handle = {
      kind: 'file',
      name: 'linked-workspace.json',
    } as unknown as FileSystemFileHandle;

    await saveLinkedFileHandle({
      handle,
      lastKnownModifiedAt: 1_762_000_000_000,
    });
    await deleteLinkedFileHandle();

    await expect(loadLinkedFileHandle()).resolves.toBeNull();
  });

  it('clears malformed linked file handle records', async () => {
    await putIndexedDbRecord({
      key: LINKED_WORKSPACE_FILE_KEY,
      handle: 'not-a-handle',
    });

    await expect(loadLinkedFileHandle()).resolves.toBeNull();
    await expect(loadLinkedFileHandle()).resolves.toBeNull();
  });
});
