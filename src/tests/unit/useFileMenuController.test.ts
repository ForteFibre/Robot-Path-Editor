import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ChangeEvent, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  AppConfirmationProvider,
  useAppConfirmation,
} from '../../features/app-shell/AppConfirmationContext';
import { useFileMenuController } from '../../features/toolbar/components/useFileMenuController';
import type { WorkspaceToolbarCommands } from '../../features/workspace-file/types';

const createWorkspaceCommands = (): WorkspaceToolbarCommands => ({
  csvExport: {
    step: 0.005,
    target: 'all',
    setStep: vi.fn(),
    setTarget: vi.fn(),
  },
  isFileSystemAccessSupported: true,
  linkedFileName: null,
  exportCsv: vi.fn(() => Promise.resolve()),
  importJson: vi.fn(() => Promise.resolve()),
  newWorkspace: vi.fn(() => Promise.resolve()),
  openWorkspace: vi.fn(() => Promise.resolve()),
  save: vi.fn(() => Promise.resolve()),
  saveAs: vi.fn(() => Promise.resolve()),
});

const wrapper = ({ children }: { children: ReactNode }) => {
  return createElement(AppConfirmationProvider, null, children);
};

describe('useFileMenuController', () => {
  it('opens a confirmation before creating a new workspace', async () => {
    const workspaceCommands = createWorkspaceCommands();
    const { result } = renderHook(
      () => ({
        confirmation: useAppConfirmation(),
        controller: useFileMenuController({ workspaceCommands }),
      }),
      { wrapper },
    );

    act(() => {
      result.current.controller.handleNewWorkspace();
    });

    expect(result.current.confirmation.request?.title).toBe(
      '現在のワークスペースを破棄して新規作成しますか？',
    );

    await act(async () => {
      await result.current.confirmation.request?.onConfirm();
    });

    expect(workspaceCommands.newWorkspace).toHaveBeenCalledTimes(1);
  });

  it('imports a file and closes the menu', async () => {
    const workspaceCommands = createWorkspaceCommands();
    const file = new File(['{}'], 'workspace.json', {
      type: 'application/json',
    });
    const event = {
      target: {
        files: [file],
        value: 'workspace.json',
      },
    } as unknown as ChangeEvent<HTMLInputElement>;
    const { result } = renderHook(
      () => useFileMenuController({ workspaceCommands }),
      { wrapper },
    );

    act(() => {
      result.current.toggleMenu();
    });

    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.handleImport(event);
    });

    await waitFor(() => {
      expect(workspaceCommands.importJson).toHaveBeenCalledWith(file);
    });

    expect(result.current.isOpen).toBe(false);
    expect(event.target.value).toBe('');
  });

  it('controls the CSV modal open and close state', () => {
    const workspaceCommands = createWorkspaceCommands();
    const { result } = renderHook(
      () => useFileMenuController({ workspaceCommands }),
      { wrapper },
    );

    expect(result.current.isCsvModalOpen).toBe(false);

    act(() => {
      result.current.openCsvModal();
    });

    expect(result.current.isCsvModalOpen).toBe(true);

    act(() => {
      result.current.closeCsvModal();
    });

    expect(result.current.isCsvModalOpen).toBe(false);
  });
});
