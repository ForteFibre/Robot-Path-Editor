import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isFileSystemAccessSupported,
  openWorkspaceFile,
  overwriteWorkspaceFile,
  saveWorkspaceFileAs,
} from '../../io/workspaceFileAccess';
import {
  deleteLinkedFileHandle,
  loadLinkedFileHandle,
  saveLinkedFileHandle,
} from '../../io/workspaceFileLinkPersistence';
import { serializeWorkspace } from '../../io/workspaceIO';
import { getWorkspacePersistedState } from '../../store/workspaceStore';
import type { ConflictState } from './types';

type ImportWorkspaceJsonSource = (
  source: string,
  options?: {
    closeRestoreDialog?: boolean;
  },
) => Promise<boolean>;

type UseWorkspaceFileLinkOptions = {
  importWorkspaceJsonSource: ImportWorkspaceJsonSource;
  deleteLinkedFileHandleFn?: typeof deleteLinkedFileHandle;
  isFileSystemAccessSupportedFn?: typeof isFileSystemAccessSupported;
  loadLinkedFileHandleFn?: typeof loadLinkedFileHandle;
  openWorkspaceFileFn?: typeof openWorkspaceFile;
  overwriteWorkspaceFileFn?: typeof overwriteWorkspaceFile;
  saveLinkedFileHandleFn?: typeof saveLinkedFileHandle;
  saveWorkspaceFileAsFn?: typeof saveWorkspaceFileAs;
  serializeWorkspaceFn?: () => string;
};

type UseWorkspaceFileLinkResult = {
  clearLink: () => Promise<void>;
  confirmOverwrite: () => Promise<FileSystemFileHandle | null>;
  isSupported: boolean;
  linkedFileHandle: FileSystemFileHandle | null;
  linkedFileName: string | null;
  loadLatestFromLinkedFile: () => Promise<boolean>;
  openWithFilePicker: () => Promise<FileSystemFileHandle | null>;
  pendingSaveConflict: ConflictState | null;
  cancelSaveConflict: () => void;
  save: () => Promise<FileSystemFileHandle | null>;
  saveAs: () => Promise<FileSystemFileHandle | null>;
};

const defaultSerializeWorkspace = (): string => {
  return serializeWorkspace(getWorkspacePersistedState());
};

export const useWorkspaceFileLink = ({
  importWorkspaceJsonSource,
  deleteLinkedFileHandleFn = deleteLinkedFileHandle,
  isFileSystemAccessSupportedFn = isFileSystemAccessSupported,
  loadLinkedFileHandleFn = loadLinkedFileHandle,
  openWorkspaceFileFn = openWorkspaceFile,
  overwriteWorkspaceFileFn = overwriteWorkspaceFile,
  saveLinkedFileHandleFn = saveLinkedFileHandle,
  saveWorkspaceFileAsFn = saveWorkspaceFileAs,
  serializeWorkspaceFn = defaultSerializeWorkspace,
}: UseWorkspaceFileLinkOptions): UseWorkspaceFileLinkResult => {
  const [linkedFileHandle, setLinkedFileHandle] =
    useState<FileSystemFileHandle | null>(null);
  const [linkedFileName, setLinkedFileName] = useState<string | null>(null);
  const [lastKnownModifiedAt, setLastKnownModifiedAt] = useState<number | null>(
    null,
  );
  const [pendingSaveConflict, setPendingSaveConflict] =
    useState<ConflictState | null>(null);
  const latestMutationIdRef = useRef(0);
  const initialLoadMutationIdRef = useRef(latestMutationIdRef.current);
  const isSupported = isFileSystemAccessSupportedFn();

  const applyLinkedFileState = useCallback(
    (record: Awaited<ReturnType<typeof loadLinkedFileHandleFn>>): void => {
      setLinkedFileHandle(record?.handle ?? null);
      setLinkedFileName(record?.handle.name ?? null);
      setLastKnownModifiedAt(record?.lastKnownModifiedAt ?? null);

      if (record === null) {
        setPendingSaveConflict(null);
      }
    },
    [],
  );

  const setLinkedFileState = useCallback(
    (record: Awaited<ReturnType<typeof loadLinkedFileHandleFn>>): void => {
      latestMutationIdRef.current += 1;
      applyLinkedFileState(record);
    },
    [applyLinkedFileState],
  );

  useEffect(() => {
    if (!isSupported) {
      setLinkedFileState(null);
      return;
    }

    let isCancelled = false;

    void loadLinkedFileHandleFn()
      .then((handle) => {
        if (
          isCancelled ||
          latestMutationIdRef.current !== initialLoadMutationIdRef.current
        ) {
          return;
        }

        applyLinkedFileState(handle);
      })
      .catch(() => {
        if (
          isCancelled ||
          latestMutationIdRef.current !== initialLoadMutationIdRef.current
        ) {
          return;
        }

        applyLinkedFileState(null);
      });

    return () => {
      isCancelled = true;
    };
  }, [
    applyLinkedFileState,
    isSupported,
    loadLinkedFileHandleFn,
    setLinkedFileState,
  ]);

  const persistLinkedHandle = useCallback(
    async (
      record: NonNullable<Awaited<ReturnType<typeof loadLinkedFileHandleFn>>>,
    ): Promise<void> => {
      setPendingSaveConflict(null);
      setLinkedFileState(record);
      await saveLinkedFileHandleFn(record);
    },
    [saveLinkedFileHandleFn, setLinkedFileState],
  );

  const clearLink = useCallback(async (): Promise<void> => {
    setLinkedFileState(null);
    await deleteLinkedFileHandleFn();
  }, [deleteLinkedFileHandleFn, setLinkedFileState]);

  const resolveLinkedRecord = useCallback(async () => {
    if (linkedFileHandle !== null) {
      return {
        handle: linkedFileHandle,
        lastKnownModifiedAt,
      };
    }

    const restoredRecord = await loadLinkedFileHandleFn();

    if (restoredRecord !== null) {
      setLinkedFileState(restoredRecord);
    }

    return restoredRecord;
  }, [
    lastKnownModifiedAt,
    linkedFileHandle,
    loadLinkedFileHandleFn,
    setLinkedFileState,
  ]);

  const saveAs = useCallback(async (): Promise<FileSystemFileHandle | null> => {
    if (!isSupported) {
      return null;
    }

    const savedFile = await saveWorkspaceFileAsFn(serializeWorkspaceFn());
    await persistLinkedHandle({
      handle: savedFile.handle,
      lastKnownModifiedAt: savedFile.lastModified,
    });

    return savedFile.handle;
  }, [
    isSupported,
    persistLinkedHandle,
    saveWorkspaceFileAsFn,
    serializeWorkspaceFn,
  ]);

  const save = useCallback(async (): Promise<FileSystemFileHandle | null> => {
    if (!isSupported) {
      return null;
    }

    const linkedRecord = await resolveLinkedRecord();

    if (linkedRecord === null) {
      return await saveAs();
    }

    const currentFile = await linkedRecord.handle.getFile();
    const knownModifiedAt =
      linkedRecord.lastKnownModifiedAt ?? currentFile.lastModified;

    if (currentFile.lastModified !== knownModifiedAt) {
      setPendingSaveConflict({
        fileName: linkedRecord.handle.name,
        lastKnownModifiedAt: knownModifiedAt,
        linkedFileModifiedAt: currentFile.lastModified,
      });
      return null;
    }

    const savedFile = await overwriteWorkspaceFileFn(
      linkedRecord.handle,
      serializeWorkspaceFn(),
    );
    await persistLinkedHandle({
      handle: savedFile.handle,
      lastKnownModifiedAt: savedFile.lastModified,
    });

    return savedFile.handle;
  }, [
    isSupported,
    overwriteWorkspaceFileFn,
    persistLinkedHandle,
    resolveLinkedRecord,
    saveAs,
    serializeWorkspaceFn,
  ]);

  const confirmOverwrite =
    useCallback(async (): Promise<FileSystemFileHandle | null> => {
      if (!isSupported) {
        return null;
      }

      const linkedRecord = await resolveLinkedRecord();
      if (linkedRecord === null) {
        return null;
      }

      const savedFile = await overwriteWorkspaceFileFn(
        linkedRecord.handle,
        serializeWorkspaceFn(),
      );
      await persistLinkedHandle({
        handle: savedFile.handle,
        lastKnownModifiedAt: savedFile.lastModified,
      });

      return savedFile.handle;
    }, [
      isSupported,
      overwriteWorkspaceFileFn,
      persistLinkedHandle,
      resolveLinkedRecord,
      serializeWorkspaceFn,
    ]);

  const loadLatestFromLinkedFile = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      return false;
    }

    const linkedRecord = await resolveLinkedRecord();
    if (linkedRecord === null) {
      return false;
    }

    const latestFile = await linkedRecord.handle.getFile();
    const imported = await importWorkspaceJsonSource(await latestFile.text(), {
      closeRestoreDialog: true,
    });

    if (!imported) {
      return false;
    }

    await persistLinkedHandle({
      handle: linkedRecord.handle,
      lastKnownModifiedAt: latestFile.lastModified,
    });

    return true;
  }, [
    importWorkspaceJsonSource,
    isSupported,
    persistLinkedHandle,
    resolveLinkedRecord,
  ]);

  const cancelSaveConflict = useCallback((): void => {
    setPendingSaveConflict(null);
  }, []);

  const openWithFilePicker =
    useCallback(async (): Promise<FileSystemFileHandle | null> => {
      if (!isSupported) {
        return null;
      }

      const openedFile = await openWorkspaceFileFn();
      if (openedFile === null) {
        return null;
      }

      const imported = await importWorkspaceJsonSource(openedFile.text);
      if (!imported) {
        return null;
      }

      await persistLinkedHandle({
        handle: openedFile.handle,
        lastKnownModifiedAt: openedFile.lastModified,
      });

      return openedFile.handle;
    }, [
      importWorkspaceJsonSource,
      isSupported,
      openWorkspaceFileFn,
      persistLinkedHandle,
    ]);

  return {
    clearLink,
    confirmOverwrite,
    isSupported,
    linkedFileHandle,
    linkedFileName,
    loadLatestFromLinkedFile,
    openWithFilePicker,
    pendingSaveConflict,
    cancelSaveConflict,
    save,
    saveAs,
  };
};
