import {
  deleteIndexedDbRecord,
  getIndexedDbRecord,
  putIndexedDbRecord,
} from './indexedDb';

export const LINKED_WORKSPACE_FILE_KEY = 'linked-workspace-file';

export type LinkedWorkspaceFileRecord = {
  key: string;
  handle: FileSystemFileHandle;
  lastKnownModifiedAt: number;
};

const isFileHandleLike = (value: unknown): value is FileSystemFileHandle => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return (
    'name' in value &&
    typeof (value as { name?: unknown }).name === 'string' &&
    'kind' in value &&
    (value as { kind?: unknown }).kind === 'file'
  );
};

const isLinkedWorkspaceFileRecord = (
  value: unknown,
): value is LinkedWorkspaceFileRecord => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<LinkedWorkspaceFileRecord>;

  return (
    candidate.key === LINKED_WORKSPACE_FILE_KEY &&
    isFileHandleLike(candidate.handle) &&
    typeof candidate.lastKnownModifiedAt === 'number' &&
    Number.isFinite(candidate.lastKnownModifiedAt)
  );
};

export const saveLinkedFileHandle = async (
  record: Omit<LinkedWorkspaceFileRecord, 'key'>,
): Promise<void> => {
  await putIndexedDbRecord({
    key: LINKED_WORKSPACE_FILE_KEY,
    handle: record.handle,
    lastKnownModifiedAt: record.lastKnownModifiedAt,
  });
};

export const loadLinkedFileHandle = async (): Promise<Omit<
  LinkedWorkspaceFileRecord,
  'key'
> | null> => {
  const record = await getIndexedDbRecord(LINKED_WORKSPACE_FILE_KEY);

  if (record === undefined) {
    return null;
  }

  if (!isLinkedWorkspaceFileRecord(record)) {
    await deleteLinkedFileHandle();
    return null;
  }

  return {
    handle: record.handle,
    lastKnownModifiedAt: record.lastKnownModifiedAt,
  };
};

export const deleteLinkedFileHandle = async (): Promise<void> => {
  await deleteIndexedDbRecord(LINKED_WORKSPACE_FILE_KEY);
};
