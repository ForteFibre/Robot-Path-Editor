import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactElement,
} from 'react';
import {
  ChevronDown,
  FolderOpen,
  Save,
  FileSpreadsheet,
  FilePlus,
} from 'lucide-react';
import { NumberInput } from '../../../components/common/NumberInput';
import { Modal } from '../../../components/common/Modal';
import {
  DEFAULT_CSV_EXPORT_STEP,
  MIN_CSV_EXPORT_STEP,
  formatMetricValue,
} from '../../../domain/metricScale';
import type { CsvTarget } from '../../../io/csv';
import styles from './FileMenu.module.css';

type FileMenuProps = {
  csvTarget: CsvTarget;
  csvStep: number;
  isFileSystemAccessSupported: boolean;
  linkedFileName: string | null;
  onCsvTargetChange: (target: CsvTarget) => void;
  onCsvStepChange: (step: number) => void;
  onLoadWorkspace: () => Promise<void>;
  onNewWorkspace: () => Promise<void>;
  onSaveWorkspace: () => Promise<void>;
  onSaveWorkspaceAs: () => Promise<void>;
  onImportJson: (file: File) => Promise<void>;
  onExportCsv: () => void;
};

export const FileMenu = ({
  csvTarget,
  csvStep,
  isFileSystemAccessSupported,
  linkedFileName,
  onCsvTargetChange,
  onCsvStepChange,
  onLoadWorkspace,
  onNewWorkspace,
  onSaveWorkspace,
  onSaveWorkspaceAs,
  onImportJson,
  onExportCsv,
}: FileMenuProps): ReactElement => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

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
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleImport = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file === undefined) {
      return;
    }

    void onImportJson(file);
    event.target.value = '';
    setIsOpen(false);
  };

  const closeMenu = (): void => {
    setIsOpen(false);
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        type="button"
        className={`${styles.trigger} ${isOpen ? styles.isOpen : ''}`}
        onClick={() => {
          setIsOpen(!isOpen);
        }}
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
            onClick={() => {
              const confirmed =
                typeof globalThis.confirm === 'function'
                  ? globalThis.confirm(
                      '現在のワークスペースを破棄して新規作成しますか？',
                    )
                  : true;
              if (confirmed) {
                void onNewWorkspace();
                setIsOpen(false);
              }
            }}
            aria-label="new workspace"
          >
            <FilePlus size={16} />
            <span>New</span>
          </button>

          <div className={styles.divider} />

          {isFileSystemAccessSupported ? (
            <button
              type="button"
              className={styles.menuItem}
              onClick={() => {
                void onLoadWorkspace();
                closeMenu();
              }}
              aria-label="Load Workspace"
            >
              <FolderOpen size={16} />
              <span>Load Workspace</span>
            </button>
          ) : (
            <label className={styles.menuItem} aria-label="load workspace json">
              <FolderOpen size={16} />
              <span>Load Workspace</span>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                onChange={handleImport}
                className="visually-hidden"
                aria-label="load workspace file"
              />
            </label>
          )}

          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              void onSaveWorkspace();
              closeMenu();
            }}
            aria-label="Save Workspace"
          >
            <Save size={16} />
            <span>Save Workspace</span>
          </button>

          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              void onSaveWorkspaceAs();
              closeMenu();
            }}
            aria-label="Save Workspace As"
          >
            <Save size={16} />
            <span>Save Workspace As...</span>
          </button>

          {linkedFileName === null ? null : (
            <div className={styles.linkedFileName} aria-live="polite">
              linked: {linkedFileName}
            </div>
          )}

          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              setIsCsvModalOpen(true);
              setIsOpen(false);
            }}
            aria-label="Export CSV"
          >
            <FileSpreadsheet size={16} />
            <span>Export CSV...</span>
          </button>
        </div>
      ) : null}

      <Modal
        isOpen={isCsvModalOpen}
        onClose={() => {
          setIsCsvModalOpen(false);
        }}
        title="Export CSV"
      >
        <div className={styles.csvModalContent}>
          <label className={styles.modalLabel}>
            <span>Target</span>
            <select
              className={styles.modalSelect}
              value={csvTarget}
              onChange={(event) => {
                onCsvTargetChange(event.target.value as CsvTarget);
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
                value={csvStep}
                onChange={(value) => {
                  if (value !== null) {
                    onCsvStepChange(Math.max(MIN_CSV_EXPORT_STEP, value));
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
              onClick={() => {
                setIsCsvModalOpen(false);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                onExportCsv();
                setIsCsvModalOpen(false);
              }}
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
