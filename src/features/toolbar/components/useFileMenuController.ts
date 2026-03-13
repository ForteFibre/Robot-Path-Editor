import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { useAppConfirmation } from '../../app-shell/AppConfirmationContext';
import type { WorkspaceToolbarCommands } from '../../workspace-file/types';

type UseFileMenuControllerOptions = {
  workspaceCommands: WorkspaceToolbarCommands;
};

export const useFileMenuController = ({
  workspaceCommands,
}: UseFileMenuControllerOptions) => {
  const { openConfirmation } = useAppConfirmation();
  const [isOpen, setIsOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const runCommand = useCallback((command: () => Promise<void>): void => {
    command().catch(() => undefined);
  }, []);

  const closeMenu = useCallback((): void => {
    setIsOpen(false);
  }, []);

  const toggleMenu = useCallback((): void => {
    setIsOpen((current) => !current);
  }, []);

  const openCsvModal = useCallback((): void => {
    setIsCsvModalOpen(true);
    setIsOpen(false);
  }, []);

  const closeCsvModal = useCallback((): void => {
    setIsCsvModalOpen(false);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target;
      if (
        !(target instanceof Node) ||
        !isOpen ||
        containerRef.current === null
      ) {
        return;
      }

      if (!containerRef.current.contains(target)) {
        closeMenu();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [closeMenu, isOpen]);

  const handleImport = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      const file = event.target.files?.[0];
      if (file === undefined) {
        return;
      }

      runCommand(() => workspaceCommands.importJson(file));
      event.target.value = '';
      closeMenu();
    },
    [closeMenu, runCommand, workspaceCommands],
  );

  const handleNewWorkspace = useCallback((): void => {
    closeMenu();
    openConfirmation({
      title: '現在のワークスペースを破棄して新規作成しますか？',
      message:
        '未保存の変更がある場合は失われます。新しいワークスペースを開始してもよければ続行してください。',
      confirmLabel: '破棄して新規作成',
      cancelLabel: 'キャンセル',
      tone: 'danger',
      onConfirm: async () => {
        await workspaceCommands.newWorkspace();
      },
    });
  }, [closeMenu, openConfirmation, workspaceCommands]);

  const handleOpenWorkspace = useCallback((): void => {
    if (workspaceCommands.isFileSystemAccessSupported) {
      runCommand(workspaceCommands.openWorkspace);
      closeMenu();
      return;
    }

    importInputRef.current?.click();
  }, [closeMenu, runCommand, workspaceCommands]);

  const handleSave = useCallback((): void => {
    runCommand(workspaceCommands.save);
    closeMenu();
  }, [closeMenu, runCommand, workspaceCommands]);

  const handleSaveAs = useCallback((): void => {
    runCommand(workspaceCommands.saveAs);
    closeMenu();
  }, [closeMenu, runCommand, workspaceCommands]);

  const handleExportCsv = useCallback((): void => {
    runCommand(workspaceCommands.exportCsv);
    closeCsvModal();
  }, [closeCsvModal, runCommand, workspaceCommands]);

  return {
    closeCsvModal,
    closeMenu,
    containerRef,
    handleExportCsv,
    handleImport,
    handleNewWorkspace,
    handleOpenWorkspace,
    handleSave,
    handleSaveAs,
    importInputRef,
    isCsvModalOpen,
    isOpen,
    openCsvModal,
    toggleMenu,
  };
};
