import { type ReactElement, type Ref } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import type { PathModel } from '../../domain/models';
import {
  SidePanel,
  SidePanelSection,
  SidePanelCard,
} from '../../components/common/SidePanel';
import styles from './Sidebar.module.css';
import { Button } from '../../components/common/Button';
import {
  InteractiveList,
  interactiveListClasses,
} from '../../components/common/InteractiveList';

export type SidebarPresenterProps = {
  hostRef?: Ref<HTMLElement> | undefined;
  paths: PathModel[];
  activePathId: string;
  onAddPath: () => void;
  onDeletePath: (pathId: string) => void;
  onDuplicatePath: (pathId: string) => void;
  onRenamePath: (pathId: string, name: string) => void;
  onRecolorPath: (pathId: string, color: string) => void;
  onSetActivePath: (pathId: string) => void;
  onTogglePathVisible: (pathId: string) => void;
  libraryPanel: ReactElement;
};

export const SidebarPresenter = ({
  hostRef,
  paths,
  activePathId,
  onAddPath,
  onDeletePath,
  onDuplicatePath,
  onRenamePath,
  onRecolorPath,
  onSetActivePath,
  onTogglePathVisible,
  libraryPanel,
}: SidebarPresenterProps): ReactElement => {
  return (
    <SidePanel side="left" ref={hostRef} aria-label="editor sidebar">
      <SidePanelSection
        title="Paths"
        headerActions={
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddPath}
            aria-label="create new path"
          >
            <Plus size={16} /> New
          </Button>
        }
        className={styles.pathsSection}
        aria-label="path management"
      >
        <InteractiveList
          items={paths}
          getKey={(path) => path.id}
          className={styles.pathsList}
          emptyState="パスがありません。New ボタンから追加してください。"
          renderItem={(path) => {
            const isActive = activePathId === path.id;
            return (
              <SidePanelCard
                active={isActive}
                className={[styles.pathCard, interactiveListClasses.item]
                  .filter(Boolean)
                  .join(' ')}
              >
                <button
                  type="button"
                  className={styles.itemActivation}
                  data-ui-focus="primary"
                  onClick={() => {
                    onSetActivePath(path.id);
                  }}
                  aria-label={`set ${path.name} active`}
                >
                  {isActive ? (
                    <CheckCircle2
                      size={18}
                      className={styles.itemActivationIconActive}
                    />
                  ) : (
                    <Circle
                      size={18}
                      className={styles.itemActivationIconInactive}
                    />
                  )}
                </button>

                <div className={styles.itemContent}>
                  <div className={styles.itemMain}>
                    <label className={styles.colorPickerWrapper}>
                      <input
                        type="color"
                        value={path.color}
                        onChange={(event) => {
                          onRecolorPath(path.id, event.target.value);
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
                      data-ui-focus="input-accent"
                      value={path.name}
                      onChange={(event) => {
                        onRenamePath(path.id, event.target.value);
                      }}
                      aria-label={`rename ${path.name}`}
                    />
                  </div>

                  <div
                    className={[
                      styles.itemActions,
                      interactiveListClasses.hoverActions,
                      interactiveListClasses.dimUntilHover,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <button
                      type="button"
                      className={styles.actionBtn}
                      data-ui-focus="primary"
                      onClick={() => {
                        onTogglePathVisible(path.id);
                      }}
                      aria-label={`toggle visibility ${path.name}`}
                      title={path.visible ? 'Hide Path' : 'Show Path'}
                    >
                      {path.visible ? (
                        <Eye size={16} />
                      ) : (
                        <EyeOff size={16} className={styles.hiddenPathIcon} />
                      )}
                    </button>

                    <button
                      type="button"
                      className={styles.actionBtn}
                      data-ui-focus="primary"
                      onClick={() => {
                        onDuplicatePath(path.id);
                      }}
                      aria-label={`duplicate ${path.name}`}
                      title="Duplicate"
                    >
                      <Copy size={16} />
                    </button>

                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                      data-ui-focus="primary"
                      disabled={paths.length <= 1}
                      onClick={() => {
                        onDeletePath(path.id);
                      }}
                      aria-label={`delete ${path.name}`}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </SidePanelCard>
            );
          }}
        />
      </SidePanelSection>

      <SidePanelSection className={styles.librarySection}>
        {libraryPanel}
      </SidePanelSection>
    </SidePanel>
  );
};
