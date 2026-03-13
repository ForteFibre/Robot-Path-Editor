import { useCallback, useEffect } from 'react';
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
import type { ConflictState } from './types';
import { useLinkedFileConflict } from './useLinkedFileConflict';
import { useLinkedFileRecord } from './useLinkedFileRecord';

type ImportWorkspaceJsonSource = (
  source: string,
  options?: {
    closeRestoreDialog?: boolean;
  },
) => Promise<void>;

type UseWorkspaceFileLinkOptions = {
  getSerializedWorkspace: () => string;
  importWorkspaceJsonSource: ImportWorkspaceJsonSource;
  deleteLinkedFileHandleFn?: typeof deleteLinkedFileHandle;
  isFileSystemAccessSupportedFn?: typeof isFileSystemAccessSupported;
  loadLinkedFileHandleFn?: typeof loadLinkedFileHandle;
  openWorkspaceFileFn?: typeof openWorkspaceFile;
  overwriteWorkspaceFileFn?: typeof overwriteWorkspaceFile;
  saveLinkedFileHandleFn?: typeof saveLinkedFileHandle;
  saveWorkspaceFileAsFn?: typeof saveWorkspaceFileAs;
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

export const useWorkspaceFileLink = ({
  getSerializedWorkspace,
  importWorkspaceJsonSource,
  deleteLinkedFileHandleFn = deleteLinkedFileHandle,
  isFileSystemAccessSupportedFn = isFileSystemAccessSupported,
  loadLinkedFileHandleFn = loadLinkedFileHandle,
  openWorkspaceFileFn = openWorkspaceFile,
  overwriteWorkspaceFileFn = overwriteWorkspaceFile,
  saveLinkedFileHandleFn = saveLinkedFileHandle,
  saveWorkspaceFileAsFn = saveWorkspaceFileAs,
}: UseWorkspaceFileLinkOptions): UseWorkspaceFileLinkResult => {
  const isSupported = isFileSystemAccessSupportedFn();
  const {
    clearLinkedFileRecord,
    linkedFileHandle,
    linkedFileName,
    persistLinkedFileRecord,
    resolveLinkedFileRecord,
  } = useLinkedFileRecord({
    isSupported,
    deleteLinkedFileHandleFn,
    loadLinkedFileHandleFn,
    saveLinkedFileHandleFn,
  });
  const {
    cancelSaveConflict,
    clearSaveConflict,
    detectSaveConflict,
    pendingSaveConflict,
  } = useLinkedFileConflict();

  useEffect(() => {
    if (linkedFileHandle !== null) {
      return;
    }

    clearSaveConflict();
  }, [clearSaveConflict, linkedFileHandle]);

  const saveAs = useCallback(async (): Promise<FileSystemFileHandle | null> => {
    if (!isSupported) {
      return null;
    }

    const savedFile = await saveWorkspaceFileAsFn(getSerializedWorkspace());
    clearSaveConflict();
    await persistLinkedFileRecord({
      handle: savedFile.handle,
      lastKnownModifiedAt: savedFile.lastModified,
    });

    return savedFile.handle;
  }, [
    getSerializedWorkspace,
    isSupported,
    clearSaveConflict,
    persistLinkedFileRecord,
    saveWorkspaceFileAsFn,
  ]);

  const save = useCallback(async (): Promise<FileSystemFileHandle | null> => {
    if (!isSupported) {
      return null;
    }

    const linkedRecord = await resolveLinkedFileRecord();

    if (linkedRecord === null) {
      return await saveAs();
    }

    if (await detectSaveConflict(linkedRecord)) {
      return null;
    }

    const savedFile = await overwriteWorkspaceFileFn(
      linkedRecord.handle,
      getSerializedWorkspace(),
    );
    clearSaveConflict();
    await persistLinkedFileRecord({
      handle: savedFile.handle,
      lastKnownModifiedAt: savedFile.lastModified,
    });

    return savedFile.handle;
  }, [
    clearSaveConflict,
    detectSaveConflict,
    getSerializedWorkspace,
    isSupported,
    overwriteWorkspaceFileFn,
    persistLinkedFileRecord,
    resolveLinkedFileRecord,
    saveAs,
  ]);

  const confirmOverwrite =
    useCallback(async (): Promise<FileSystemFileHandle | null> => {
      if (!isSupported) {
        return null;
      }

      const linkedRecord = await resolveLinkedFileRecord();
      if (linkedRecord === null) {
        return null;
      }

      const savedFile = await overwriteWorkspaceFileFn(
        linkedRecord.handle,
        getSerializedWorkspace(),
      );
      clearSaveConflict();
      await persistLinkedFileRecord({
        handle: savedFile.handle,
        lastKnownModifiedAt: savedFile.lastModified,
      });

      return savedFile.handle;
    }, [
      getSerializedWorkspace,
      isSupported,
      overwriteWorkspaceFileFn,
      persistLinkedFileRecord,
      resolveLinkedFileRecord,
      clearSaveConflict,
    ]);

  const loadLatestFromLinkedFile = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      return false;
    }

    const linkedRecord = await resolveLinkedFileRecord();
    if (linkedRecord === null) {
      return false;
    }

    const latestFile = await linkedRecord.handle.getFile();
    await importWorkspaceJsonSource(await latestFile.text(), {
      closeRestoreDialog: true,
    });

    clearSaveConflict();
    await persistLinkedFileRecord({
      handle: linkedRecord.handle,
      lastKnownModifiedAt: latestFile.lastModified,
    });

    return true;
  }, [
    importWorkspaceJsonSource,
    isSupported,
    persistLinkedFileRecord,
    resolveLinkedFileRecord,
    clearSaveConflict,
  ]);

  const openWithFilePicker =
    useCallback(async (): Promise<FileSystemFileHandle | null> => {
      if (!isSupported) {
        return null;
      }

      const openedFile = await openWorkspaceFileFn();
      if (openedFile === null) {
        return null;
      }

      await importWorkspaceJsonSource(openedFile.text);

      clearSaveConflict();
      await persistLinkedFileRecord({
        handle: openedFile.handle,
        lastKnownModifiedAt: openedFile.lastModified,
      });

      return openedFile.handle;
    }, [
      importWorkspaceJsonSource,
      isSupported,
      openWorkspaceFileFn,
      persistLinkedFileRecord,
      clearSaveConflict,
    ]);

  const clearLink = useCallback(async (): Promise<void> => {
    clearSaveConflict();
    await clearLinkedFileRecord();
  }, [clearLinkedFileRecord, clearSaveConflict]);

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
