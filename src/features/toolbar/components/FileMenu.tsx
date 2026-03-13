import { type ReactElement } from 'react';
import {
  ChevronDown,
  FolderOpen,
  FilePlus,
  FileSpreadsheet,
  Save,
} from 'lucide-react';
import { NumberInput } from '../../../components/common/NumberInput';
import { Modal } from '../../../components/common/Modal';
import {
  DEFAULT_CSV_EXPORT_STEP,
  MIN_CSV_EXPORT_STEP,
  formatMetricValue,
} from '../../../domain/metricScale';
import type { WorkspaceToolbarCommands } from '../../workspace-file/types';
import styles from './FileMenu.module.css';
import { useFileMenuController } from './useFileMenuController';

type FileMenuProps = {
  workspaceCommands: WorkspaceToolbarCommands;
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
          <button
            type="button"
            className={styles.menuItem}
            onClick={handleNewWorkspace}
            aria-label="new workspace"
          >
            <FilePlus size={16} />
            <span>New</span>
          </button>

          <div className={styles.divider} />

          {workspaceCommands.isFileSystemAccessSupported ? (
            <button
              type="button"
              className={styles.menuItem}
              onClick={handleOpenWorkspace}
              aria-label="Load Workspace"
            >
              <FolderOpen size={16} />
              <span>Load Workspace</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                className={styles.menuItem}
                onClick={handleOpenWorkspace}
                aria-label="load workspace json"
              >
                <FolderOpen size={16} />
                <span>Load Workspace</span>
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                onChange={handleImport}
                className="visually-hidden"
                aria-label="load workspace file"
              />
            </>
          )}

          <button
            type="button"
            className={styles.menuItem}
            onClick={handleSave}
            aria-label="Save Workspace"
          >
            <Save size={16} />
            <span>Save Workspace</span>
          </button>

          <button
            type="button"
            className={styles.menuItem}
            onClick={handleSaveAs}
            aria-label="Save Workspace As"
          >
            <Save size={16} />
            <span>Save Workspace As...</span>
          </button>

          {workspaceCommands.linkedFileName === null ? null : (
            <div className={styles.linkedFileName} aria-live="polite">
              linked: {workspaceCommands.linkedFileName}
            </div>
          )}

          <button
            type="button"
            className={styles.menuItem}
            onClick={openCsvModal}
            aria-label="Export CSV"
          >
            <FileSpreadsheet size={16} />
            <span>Export CSV...</span>
          </button>
        </div>
      ) : null}

      <Modal isOpen={isCsvModalOpen} onClose={closeCsvModal} title="Export CSV">
        <div className={styles.csvModalContent}>
          <label className={styles.modalLabel}>
            <span>Target</span>
            <select
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
          </label>
          <label className={styles.modalLabel} htmlFor="export-step-modal">
            <span>Step Interval (m)</span>
            <div className={styles.numberInputWrapper}>
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
            </div>
          </label>
          <p className={styles.modalHint}>
            Default: {formatMetricValue(DEFAULT_CSV_EXPORT_STEP)} m
          </p>
          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={closeCsvModal}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleExportCsv}
            >
              <FileSpreadsheet size={16} />
              Export
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
