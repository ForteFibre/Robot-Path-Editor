import { type ReactElement } from 'react';
import {
  Compass,
  MousePointer,
  Plus,
  Redo2,
  Route,
  Undo2,
  Waypoints,
} from 'lucide-react';
import type { CsvTarget } from '../../io/csv';
import { useWorkspaceHistory } from '../../store/workspaceHistory';
import { useWorkspaceActions } from '../../store/workspaceStore';
import { useEditorMode, useEditorTool } from '../../store/workspaceSelectors';
import { FileMenu } from './components/FileMenu';
import { SettingsMenu } from './components/SettingsMenu';
import { useUndoRedoHotkeys } from './hooks/useUndoRedoHotkeys';
import styles from './Toolbar.module.css';

type ToolbarProps = {
  csvTarget: CsvTarget;
  csvStep: number;
  onCsvTargetChange: (target: CsvTarget) => void;
  onCsvStepChange: (step: number) => void;
  onExportJson: () => void;
  onImportJson: (file: File) => Promise<void>;
  onExportCsv: () => void;
};

export const Toolbar = ({
  csvTarget,
  csvStep,
  onCsvTargetChange,
  onCsvStepChange,
  onExportJson,
  onImportJson,
  onExportCsv,
}: ToolbarProps): ReactElement => {
  const { setMode, setTool } = useWorkspaceActions();
  const { canRedo, canUndo, redo, undo } = useWorkspaceHistory();
  const mode = useEditorMode();
  const tool = useEditorTool();

  useUndoRedoHotkeys();
  return (
    <header
      className={styles.toolbar}
      aria-label="top toolbar"
      data-mode={mode}
    >
      <div className={styles.leftSection} aria-label="branding and menus">
        <div className={styles.logo}>
          <Waypoints size={20} color="#3b82f6" />
          <h1>Robot Path Editor</h1>
        </div>

        <div className={styles.menuGroup}>
          <FileMenu
            csvTarget={csvTarget}
            csvStep={csvStep}
            onCsvTargetChange={onCsvTargetChange}
            onCsvStepChange={onCsvStepChange}
            onExportJson={onExportJson}
            onImportJson={onImportJson}
            onExportCsv={onExportCsv}
          />
          <SettingsMenu />
        </div>
      </div>

      <div className={styles.centerSection} aria-label="editor tools">
        <div
          className={styles.modeSegmentControl}
          aria-label="editor mode switch"
        >
          <button
            type="button"
            className={`${styles.modeSegmentButton} ${mode === 'path' ? styles.isActive : ''}`}
            onClick={() => {
              setMode('path');
            }}
            aria-pressed={mode === 'path'}
          >
            <Route size={16} />
            <span>Path</span>
          </button>
          <button
            type="button"
            className={`${styles.modeSegmentButton} ${mode === 'heading' ? styles.isActive : ''}`}
            onClick={() => {
              setMode('heading');
            }}
            aria-pressed={mode === 'heading'}
          >
            <Compass size={16} />
            <span>Heading</span>
          </button>
        </div>

        <div className={styles.toolSwitch} aria-label="canvas tool selection">
          <button
            type="button"
            className={`${styles.toolButton} ${tool === 'select' ? styles.toolActive : ''}`}
            onClick={() => {
              setTool('select');
            }}
            aria-label="tool select"
            aria-pressed={tool === 'select'}
          >
            <MousePointer size={16} />
            <span>Select</span>
          </button>
          <button
            type="button"
            className={`${styles.toolButton} ${tool === 'add-point' ? styles.toolActive : ''}`}
            onClick={() => {
              setTool('add-point');
            }}
            aria-label="tool add point"
            aria-pressed={tool === 'add-point'}
          >
            <Plus size={16} />
            <span>Add Point</span>
          </button>
        </div>
      </div>

      <div className={styles.rightSection} aria-label="workspace actions">
        <div className={styles.historyGroup} aria-label="history actions">
          <button
            type="button"
            className={styles.historyButton}
            onClick={() => {
              undo();
            }}
            disabled={!canUndo}
            aria-label="undo workspace"
            title="Undo (Ctrl/Cmd+Z)"
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            className={styles.historyButton}
            onClick={() => {
              redo();
            }}
            disabled={!canRedo}
            aria-label="redo workspace"
            title="Redo (Ctrl/Cmd+Shift+Z / Ctrl+Y)"
          >
            <Redo2 size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};
