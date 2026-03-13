import { useCallback, useState } from 'react';
import { useAppConfirmation } from '../app-shell/AppConfirmationContext';
import { type LibraryPointDraft, usePointLibrary } from './usePointLibrary';

export const usePointLibraryPanelController = () => {
  const { openConfirmation } = useAppConfirmation();
  const {
    createPoint,
    defaultDraft,
    deletePoint: deleteLibraryPoint,
    highlightedLibraryPointId,
    insertPointIntoPath,
    items,
    selectPoint: selectLibraryPoint,
    selectedLibraryPointId,
    togglePointLock: toggleLibraryPointLock,
    updatePointItem,
  } = usePointLibrary();
  const [createDraft, setCreateDraft] = useState<LibraryPointDraft | null>(
    null,
  );

  const startCreate = useCallback((): void => {
    setCreateDraft((current) => current ?? { ...defaultDraft });
  }, [defaultDraft]);

  const cancelCreate = useCallback((): void => {
    setCreateDraft(null);
  }, []);

  const changeCreateDraft = useCallback(
    (patch: Partial<LibraryPointDraft>): void => {
      setCreateDraft((current) => {
        if (current === null) {
          return current;
        }

        return {
          ...current,
          ...patch,
        };
      });
    },
    [],
  );

  const saveCreateDraft = useCallback((): void => {
    if (createDraft === null) {
      return;
    }

    const createdId = createPoint(createDraft);
    if (createdId !== null) {
      setCreateDraft(null);
    }
  }, [createDraft, createPoint]);

  const selectPoint = useCallback(
    (pointId: string): void => {
      setCreateDraft(null);
      selectLibraryPoint(pointId);
    },
    [selectLibraryPoint],
  );

  const savePoint = useCallback(
    (
      pointId: string,
      patch: Partial<
        Pick<
          ReturnType<typeof usePointLibrary>['items'][number],
          'name' | 'x' | 'y' | 'robotHeading'
        >
      >,
    ): void => {
      updatePointItem(pointId, patch);
    },
    [updatePointItem],
  );

  const insertPoint = useCallback(
    (pointId: string): void => {
      insertPointIntoPath(pointId);
    },
    [insertPointIntoPath],
  );

  const deletePoint = useCallback(
    (pointId: string): void => {
      const result = deleteLibraryPoint(pointId);

      if (result.kind !== 'confirmation-required') {
        return;
      }

      openConfirmation({
        title: 'ライブラリポイントを削除しますか？',
        message: `${result.pointName} を削除すると ${result.usageCount} 個の linked waypoint が Library から外れます。続行しますか？`,
        confirmLabel: '削除する',
        cancelLabel: 'キャンセル',
        tone: 'danger',
        onConfirm: () => {
          deleteLibraryPoint(result.pointId, { force: true });
        },
      });
    },
    [deleteLibraryPoint, openConfirmation],
  );

  const togglePointLock = useCallback(
    (pointId: string): void => {
      toggleLibraryPointLock(pointId);
    },
    [toggleLibraryPointLock],
  );

  return {
    cancelCreate,
    changeCreateDraft,
    createDraft,
    deletePoint,
    highlightedLibraryPointId,
    insertPoint,
    items,
    saveCreateDraft,
    savePoint,
    selectPoint,
    selectedLibraryPointId,
    startCreate,
    togglePointLock,
  };
};
