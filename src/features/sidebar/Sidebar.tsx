import { type ReactElement } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { useWorkspaceActions } from '../../store/workspaceStore';
import { useActivePathId, usePaths } from '../../store/workspaceSelectors';
import { PointLibraryPanel } from '../pointLibrary/PointLibraryPanel';
import styles from './Sidebar.module.css';

export const Sidebar = (): ReactElement => {
  const {
    addPath,
    deletePath,
    duplicatePath,
    recolorPath,
    renamePath,
    setActivePath,
    togglePathVisible,
  } = useWorkspaceActions();
  const paths = usePaths();
  const activePathId = useActivePathId();

  return (
    <aside className={styles.sidebar} aria-label="editor sidebar">
      <section
        className={`${styles.section} ${styles.pathsSection}`}
        aria-label="path management"
      >
        <div className={styles.sectionHeader}>
          <h2>Paths</h2>
          <button
            type="button"
            className="icon-button icon-button--small"
            onClick={() => {
              addPath();
            }}
            aria-label="create new path"
          >
            <Plus size={16} /> New
          </button>
        </div>

        <ul className={`${styles.list} ${styles.pathsList}`}>
          {paths.map((path) => {
            const isActive = activePathId === path.id;
            return (
              <li
                key={path.id}
                className={`${styles.item} ${isActive ? styles.isActive : ''}`}
              >
                <button
                  type="button"
                  className={styles.itemActivation}
                  onClick={() => {
                    setActivePath(path.id);
                  }}
                  aria-label={`set ${path.name} active`}
                >
                  {isActive ? (
                    <CheckCircle2 size={18} color="#3b82f6" />
                  ) : (
                    <Circle size={18} color="#cbd5e1" />
                  )}
                </button>

                <div className={styles.itemContent}>
                  <div className={styles.itemMain}>
                    <label className={styles.colorPickerWrapper}>
                      <input
                        type="color"
                        value={path.color}
                        onChange={(event) => {
                          recolorPath(path.id, event.target.value);
                        }}
                        aria-label={`change color ${path.name}`}
                      />
                      <div
                        className={styles.colorSwatch}
                        style={{ backgroundColor: path.color }}
                      />
                    </label>

                    <input
                      type="text"
                      className={styles.inputSeamless}
                      value={path.name}
                      onChange={(event) => {
                        renamePath(path.id, event.target.value);
                      }}
                      aria-label={`rename ${path.name}`}
                    />
                  </div>

                  <div className={styles.itemActions}>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => {
                        togglePathVisible(path.id);
                      }}
                      aria-label={`toggle visibility ${path.name}`}
                      title={path.visible ? 'Hide Path' : 'Show Path'}
                    >
                      {path.visible ? (
                        <Eye size={16} />
                      ) : (
                        <EyeOff size={16} color="#94a3b8" />
                      )}
                    </button>

                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => {
                        duplicatePath(path.id);
                      }}
                      aria-label={`duplicate ${path.name}`}
                      title="Duplicate"
                    >
                      <Copy size={16} />
                    </button>

                    <button
                      type="button"
                      className={`${styles.actionBtn} btn-danger-text`}
                      disabled={paths.length <= 1}
                      onClick={() => {
                        deletePath(path.id);
                      }}
                      aria-label={`delete ${path.name}`}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={`${styles.section} ${styles.librarySection}`}>
        <PointLibraryPanel />
      </section>
    </aside>
  );
};
