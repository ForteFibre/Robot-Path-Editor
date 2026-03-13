import { type ReactElement, type ReactNode } from 'react';
import {
  ChevronDown,
  FolderOpen,
  FilePlus,
  FileSpreadsheet,
  Save,
  type LucideIcon,
} from 'lucide-react';
import { NumberInput } from '../../../components/common/NumberInput';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import {
  DEFAULT_CSV_EXPORT_STEP,
  MIN_CSV_EXPORT_STEP,
  formatMetricValue,
} from '../../../domain/metricScale';
import { FormField } from '../../../components/common/FormField';
import type { WorkspaceToolbarCommands } from '../../workspace-file/types';
import styles from './FileMenu.module.css';
import { useFileMenuController } from './useFileMenuController';

type FileMenuProps = {
  workspaceCommands: WorkspaceToolbarCommands;
};

type FileMenuActionRow = {
  kind: 'action';
  key: string;
  ariaLabel: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
};

type FileMenuDividerRow = {
  kind: 'divider';
  key: string;
};

type FileMenuLinkedFileRow = {
  kind: 'linked-file';
  key: string;
  fileName: string;
};

type FileMenuRow =
  | FileMenuActionRow
  | FileMenuDividerRow
  | FileMenuLinkedFileRow;

const renderFileMenuRow = (row: FileMenuRow): ReactNode => {
  if (row.kind === 'divider') {
    return <div key={row.key} className={styles.divider} />;
  }

  if (row.kind === 'linked-file') {
    return (
      <div key={row.key} className={styles.linkedFileName} aria-live="polite">
        linked: {row.fileName}
      </div>
    );
  }

  const Icon = row.icon;

  return (
    <button
      key={row.key}
      type="button"
      className={styles.menuItem}
      onClick={row.onClick}
      aria-label={row.ariaLabel}
    >
      <Icon size={16} />
      <span>{row.label}</span>
    </button>
  );
};

export const FileMenu = ({
  workspaceCommands,
}: FileMenuProps): ReactElement => {
  const {
    closeCsvModal,
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
  } = useFileMenuController({ workspaceCommands });

  const openWorkspaceAriaLabel = workspaceCommands.isFileSystemAccessSupported
    ? 'Load Workspace'
    : 'load workspace json';

  const menuRows: FileMenuRow[] = [
    {
      kind: 'action',
      key: 'new-workspace',
      ariaLabel: 'new workspace',
      label: 'New',
      icon: FilePlus,
      onClick: handleNewWorkspace,
    },
    { kind: 'divider', key: 'file-divider-primary' },
    {
      kind: 'action',
      key: 'open-workspace',
      ariaLabel: openWorkspaceAriaLabel,
      label: 'Load Workspace',
      icon: FolderOpen,
      onClick: handleOpenWorkspace,
    },
    {
      kind: 'action',
      key: 'save-workspace',
      ariaLabel: 'Save Workspace',
      label: 'Save Workspace',
      icon: Save,
      onClick: handleSave,
    },
    {
      kind: 'action',
      key: 'save-workspace-as',
      ariaLabel: 'Save Workspace As',
      label: 'Save Workspace As...',
      icon: Save,
      onClick: handleSaveAs,
    },
    ...(workspaceCommands.linkedFileName === null
      ? []
      : [
          {
            kind: 'linked-file' as const,
            key: 'linked-workspace-file',
            fileName: workspaceCommands.linkedFileName,
          },
        ]),
    {
      kind: 'action',
      key: 'export-csv',
      ariaLabel: 'Export CSV',
      label: 'Export CSV...',
      icon: FileSpreadsheet,
      onClick: openCsvModal,
    },
  ];

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        type="button"
        className={`${styles.trigger} ${isOpen ? styles.isOpen : ''}`}
        onClick={toggleMenu}
        aria-expanded={isOpen}
        aria-label="file menu"
      >
        File
        <ChevronDown size={14} />
      </button>

      {isOpen ? (
        <div className={styles.dropdown}>
          {menuRows.map((row) => renderFileMenuRow(row))}

          {workspaceCommands.isFileSystemAccessSupported ? null : (
            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              onChange={handleImport}
              className="visually-hidden"
              aria-label="load workspace file"
            />
          )}
        </div>
      ) : null}

      <Modal isOpen={isCsvModalOpen} onClose={closeCsvModal} title="Export CSV">
        <div className={styles.csvModalContent}>
          <FormField label="Target" htmlFor="export-target-modal">
            <select
              id="export-target-modal"
              className={styles.modalSelect}
              value={workspaceCommands.csvExport.target}
              onChange={(event) => {
                workspaceCommands.csvExport.setTarget(
                  event.target
                    .value as WorkspaceToolbarCommands['csvExport']['target'],
                );
              }}
            >
              <option value="active">Active Path</option>
              <option value="all">All Paths</option>
            </select>
          </FormField>
          <FormField label="Step Interval (m)" htmlFor="export-step-modal">
            <NumberInput
              id="export-step-modal"
              min={MIN_CSV_EXPORT_STEP}
              step={MIN_CSV_EXPORT_STEP}
              value={workspaceCommands.csvExport.step}
              onChange={(value) => {
                if (value !== null) {
                  workspaceCommands.csvExport.setStep(value);
                }
              }}
            />
          </FormField>
          <p className={styles.modalHint}>
            Default: {formatMetricValue(DEFAULT_CSV_EXPORT_STEP)} m
          </p>
          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={closeCsvModal}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleExportCsv}>
              <FileSpreadsheet size={16} />
              Export
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
