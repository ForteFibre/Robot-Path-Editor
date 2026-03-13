import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MIN_CSV_EXPORT_STEP } from '../../domain/metricScale';
import { AppConfirmationDialog } from '../../features/app-shell/AppConfirmationDialog';
import { AppConfirmationProvider } from '../../features/app-shell/AppConfirmationContext';
import { FileMenu } from '../../features/toolbar/components/FileMenu';
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

const renderFileMenu = (workspaceCommands: WorkspaceToolbarCommands): void => {
  render(
    <AppConfirmationProvider>
      <FileMenu workspaceCommands={workspaceCommands} />
      <AppConfirmationDialog />
    </AppConfirmationProvider>,
  );
};

describe('FileMenu', () => {
  it('dropdown row を定義に基づいて描画し、aria-label を維持する', () => {
    const workspaceCommands = createWorkspaceCommands();
    workspaceCommands.linkedFileName = 'demo.path';

    renderFileMenu(workspaceCommands);

    fireEvent.click(screen.getByRole('button', { name: 'file menu' }));

    expect(
      screen.getByRole('button', { name: 'new workspace' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Load Workspace' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Save Workspace' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Save Workspace As' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Export CSV' }),
    ).toBeInTheDocument();
    expect(screen.getByText('linked: demo.path')).toBeInTheDocument();
  });

  it('File System Access 非対応時は json import row と hidden input を描画する', () => {
    const workspaceCommands = createWorkspaceCommands();
    workspaceCommands.isFileSystemAccessSupported = false;
    const inputClickSpy = vi
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(() => undefined);

    renderFileMenu(workspaceCommands);

    fireEvent.click(screen.getByRole('button', { name: 'file menu' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'load workspace json' }),
    );

    expect(screen.getByLabelText('load workspace file')).toBeInTheDocument();
    expect(inputClickSpy).toHaveBeenCalledTimes(1);

    inputClickSpy.mockRestore();
  });

  it('uses the domain CSV minimum step for the export step input', () => {
    renderFileMenu(createWorkspaceCommands());

    fireEvent.click(screen.getByRole('button', { name: 'file menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    const stepInput = screen.getByRole('spinbutton', {
      name: 'Step Interval (m)',
    });

    expect(stepInput).toHaveAttribute('min', String(MIN_CSV_EXPORT_STEP));
    expect(stepInput).toHaveAttribute('step', String(MIN_CSV_EXPORT_STEP));
  });

  it('asks for confirmation before starting a new workspace', () => {
    const workspaceCommands = createWorkspaceCommands();

    renderFileMenu(workspaceCommands);

    fireEvent.click(screen.getByRole('button', { name: 'file menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'new workspace' }));

    expect(workspaceCommands.newWorkspace).not.toHaveBeenCalled();
    expect(
      screen.getByRole('heading', {
        name: '現在のワークスペースを破棄して新規作成しますか？',
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '破棄して新規作成' }));

    expect(workspaceCommands.newWorkspace).toHaveBeenCalledTimes(1);
  });
});
