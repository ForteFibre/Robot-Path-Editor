import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteLinkedFileHandle,
  loadLinkedFileHandle,
  saveLinkedFileHandle,
} from '../../io/workspaceFileLinkPersistence';

export type LinkedFileRecord = {
  handle: FileSystemFileHandle;
  lastKnownModifiedAt: number | null;
};

type PersistedLinkedFileRecord = {
  handle: FileSystemFileHandle;
  lastKnownModifiedAt: number;
};

type UseLinkedFileRecordOptions = {
  deleteLinkedFileHandleFn?: typeof deleteLinkedFileHandle;
  isSupported: boolean;
  loadLinkedFileHandleFn?: typeof loadLinkedFileHandle;
  saveLinkedFileHandleFn?: typeof saveLinkedFileHandle;
};

type UseLinkedFileRecordResult = {
  clearLinkedFileRecord: () => Promise<void>;
  linkedFileHandle: FileSystemFileHandle | null;
  linkedFileName: string | null;
  persistLinkedFileRecord: (record: PersistedLinkedFileRecord) => Promise<void>;
  resolveLinkedFileRecord: () => Promise<LinkedFileRecord | null>;
};

export const useLinkedFileRecord = ({
  deleteLinkedFileHandleFn = deleteLinkedFileHandle,
  isSupported,
  loadLinkedFileHandleFn = loadLinkedFileHandle,
  saveLinkedFileHandleFn = saveLinkedFileHandle,
}: UseLinkedFileRecordOptions): UseLinkedFileRecordResult => {
  const [linkedFileHandle, setLinkedFileHandle] =
    useState<FileSystemFileHandle | null>(null);
  const [linkedFileName, setLinkedFileName] = useState<string | null>(null);
  const [lastKnownModifiedAt, setLastKnownModifiedAt] = useState<number | null>(
    null,
  );
  const latestMutationIdRef = useRef(0);
  const initialLoadMutationIdRef = useRef(latestMutationIdRef.current);

  const applyLinkedFileRecord = useCallback(
    (record: Awaited<ReturnType<typeof loadLinkedFileHandleFn>>): void => {
      setLinkedFileHandle(record?.handle ?? null);
      setLinkedFileName(record?.handle.name ?? null);
      setLastKnownModifiedAt(record?.lastKnownModifiedAt ?? null);
    },
    [],
  );

  const setLinkedFileRecord = useCallback(
    (record: Awaited<ReturnType<typeof loadLinkedFileHandleFn>>): void => {
      latestMutationIdRef.current += 1;
      applyLinkedFileRecord(record);
    },
    [applyLinkedFileRecord],
  );

  useEffect(() => {
    if (!isSupported) {
      setLinkedFileRecord(null);
      return;
    }

    let isCancelled = false;

    void loadLinkedFileHandleFn()
      .then((record) => {
        if (
          isCancelled ||
          latestMutationIdRef.current !== initialLoadMutationIdRef.current
        ) {
          return;
        }

        applyLinkedFileRecord(record);
      })
      .catch(() => {
        if (
          isCancelled ||
          latestMutationIdRef.current !== initialLoadMutationIdRef.current
        ) {
          return;
        }

        applyLinkedFileRecord(null);
      });

    return () => {
      isCancelled = true;
    };
  }, [
    applyLinkedFileRecord,
    isSupported,
    loadLinkedFileHandleFn,
    setLinkedFileRecord,
  ]);

  const persistLinkedFileRecord = useCallback(
    async (record: PersistedLinkedFileRecord): Promise<void> => {
      setLinkedFileRecord(record);
      await saveLinkedFileHandleFn(record);
    },
    [saveLinkedFileHandleFn, setLinkedFileRecord],
  );

  const clearLinkedFileRecord = useCallback(async (): Promise<void> => {
    setLinkedFileRecord(null);
    await deleteLinkedFileHandleFn();
  }, [deleteLinkedFileHandleFn, setLinkedFileRecord]);

  const resolveLinkedFileRecord =
    useCallback(async (): Promise<LinkedFileRecord | null> => {
      if (linkedFileHandle !== null) {
        return {
          handle: linkedFileHandle,
          lastKnownModifiedAt,
        };
      }

      const restoredRecord = await loadLinkedFileHandleFn();

      if (restoredRecord !== null) {
        setLinkedFileRecord(restoredRecord);
      }

      return restoredRecord;
    }, [
      lastKnownModifiedAt,
      linkedFileHandle,
      loadLinkedFileHandleFn,
      setLinkedFileRecord,
    ]);

  return {
    clearLinkedFileRecord,
    linkedFileHandle,
    linkedFileName,
    persistLinkedFileRecord,
    resolveLinkedFileRecord,
  };
};
