import { useCallback, useState } from 'react';
import type { ConflictState } from './types';
import type { LinkedFileRecord } from './useLinkedFileRecord';

type UseLinkedFileConflictResult = {
  cancelSaveConflict: () => void;
  clearSaveConflict: () => void;
  detectSaveConflict: (record: LinkedFileRecord) => Promise<boolean>;
  pendingSaveConflict: ConflictState | null;
};

export const useLinkedFileConflict = (): UseLinkedFileConflictResult => {
  const [pendingSaveConflict, setPendingSaveConflict] =
    useState<ConflictState | null>(null);

  const clearSaveConflict = useCallback((): void => {
    setPendingSaveConflict(null);
  }, []);

  const detectSaveConflict = useCallback(
    async (record: LinkedFileRecord): Promise<boolean> => {
      const currentFile = await record.handle.getFile();
      const knownModifiedAt =
        record.lastKnownModifiedAt ?? currentFile.lastModified;

      if (currentFile.lastModified === knownModifiedAt) {
        setPendingSaveConflict(null);
        return false;
      }

      setPendingSaveConflict({
        fileName: record.handle.name,
        lastKnownModifiedAt: knownModifiedAt,
        linkedFileModifiedAt: currentFile.lastModified,
      });
      return true;
    },
    [],
  );

  return {
    cancelSaveConflict: clearSaveConflict,
    clearSaveConflict,
    detectSaveConflict,
    pendingSaveConflict,
  };
};
