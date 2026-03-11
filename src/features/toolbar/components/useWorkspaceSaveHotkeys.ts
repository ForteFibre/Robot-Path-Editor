import { useEffect } from 'react';

type UseWorkspaceSaveHotkeysOptions = {
  onSave: () => void;
  onSaveAs: () => void;
};

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

export const useWorkspaceSaveHotkeys = ({
  onSave,
  onSaveAs,
}: UseWorkspaceSaveHotkeysOptions): void => {
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
      if (key !== 's') {
        return;
      }

      event.preventDefault();

      if (event.shiftKey) {
        onSaveAs();
        return;
      }

      onSave();
    };

    globalThis.addEventListener('keydown', onKeyDown);

    return () => {
      globalThis.removeEventListener('keydown', onKeyDown);
    };
  }, [onSave, onSaveAs]);
};
