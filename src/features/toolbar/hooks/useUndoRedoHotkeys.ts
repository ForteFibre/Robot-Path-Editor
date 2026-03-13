import { useEffect } from 'react';
import { useWorkspaceHistoryActions } from '../../workspace-file/useWorkspaceHistoryActions';

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    return true;
  }

  return target.isContentEditable;
};

export const useUndoRedoHotkeys = (): void => {
  const { canRedo, canUndo, redo, undo } = useWorkspaceHistoryActions();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target)) {
        return;
      }

      const isCtrlOrMeta = event.ctrlKey || event.metaKey;
      if (!isCtrlOrMeta || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();

      const wantsUndo = key === 'z' && !event.shiftKey;
      const wantsRedo = key === 'y' || (key === 'z' && event.shiftKey);

      if (wantsUndo) {
        if (!canUndo) {
          return;
        }

        event.preventDefault();
        undo();
        return;
      }

      if (!wantsRedo || !canRedo) {
        return;
      }

      event.preventDefault();
      redo();
    };

    globalThis.addEventListener('keydown', onKeyDown);

    return () => {
      globalThis.removeEventListener('keydown', onKeyDown);
    };
  }, [canRedo, canUndo, redo, undo]);
};
