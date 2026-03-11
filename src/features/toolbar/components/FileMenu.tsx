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
import { useWorkspaceActions } from '../../../store/workspaceStore';
import styles from './FileMenu.module.css';

type FileMenuProps = {
  csvTarget: CsvTarget;
  csvStep: number;
  onCsvTargetChange: (target: CsvTarget) => void;
  onCsvStepChange: (step: number) => void;
  onExportJson: () => void;
  onImportJson: (file: File) => Promise<void>;
  onExportCsv: () => void;
};

export const FileMenu = ({
  csvTarget,
  csvStep,
  onCsvTargetChange,
  onCsvStepChange,
  onExportJson,
  onImportJson,
  onExportCsv,
}: FileMenuProps): ReactElement => {
  const { resetWorkspace } = useWorkspaceActions();
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
                resetWorkspace();
                setIsOpen(false);
              }
            }}
            aria-label="new workspace"
          >
            <FilePlus size={16} />
            <span>New</span>
          </button>

          <div className={styles.divider} />

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

          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              onExportJson();
              setIsOpen(false);
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
