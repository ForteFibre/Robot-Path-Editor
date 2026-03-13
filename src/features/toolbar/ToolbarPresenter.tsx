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
import type { CanvasTool, EditorMode } from '../../domain/models';
import styles from './Toolbar.module.css';

export type ToolbarPresenterProps = {
  mode: EditorMode;
  tool: CanvasTool;
  canUndo: boolean;
  canRedo: boolean;
  onSelectPathMode: () => void;
  onSelectHeadingMode: () => void;
  onSelectTool: (tool: CanvasTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  fileMenu: ReactElement;
  settingsMenu: ReactElement;
};

export const ToolbarPresenter = ({
  mode,
  tool,
  canUndo,
  canRedo,
  onSelectPathMode,
  onSelectHeadingMode,
  onSelectTool,
  onUndo,
  onRedo,
  fileMenu,
  settingsMenu,
}: ToolbarPresenterProps): ReactElement => {
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
          {fileMenu}
          {settingsMenu}
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
            onClick={onSelectPathMode}
            aria-pressed={mode === 'path'}
          >
            <Route size={16} />
            <span>Path</span>
          </button>
          <button
            type="button"
            className={`${styles.modeSegmentButton} ${mode === 'heading' ? styles.isActive : ''}`}
            onClick={onSelectHeadingMode}
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
              onSelectTool('select');
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
              onSelectTool('add-point');
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
              onUndo();
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
              onRedo();
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
