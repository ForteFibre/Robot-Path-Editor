import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from 'react';
import { CheckCircle2, Circle, Copy, Eye, EyeOff, Trash2 } from 'lucide-react';
import type { PathModel } from '../../domain/models';
import { SidePanelCard } from '../../components/common/SidePanel';
import { interactiveListClasses } from '../../components/common/InteractiveList';
import styles from './Sidebar.module.css';

type SidebarPathItemProps = {
  path: PathModel;
  isActive: boolean;
  canDelete: boolean;
  onDeletePath: (pathId: string) => void;
  onDuplicatePath: (pathId: string) => void;
  onRenamePath: (pathId: string, name: string) => void;
  onRecolorPath: (pathId: string, color: string) => void;
  onSetActivePath: (pathId: string) => void;
  onTogglePathVisible: (pathId: string) => void;
};

const SidebarPathItemComponent = ({
  path,
  isActive,
  canDelete,
  onDeletePath,
  onDuplicatePath,
  onRenamePath,
  onRecolorPath,
  onSetActivePath,
  onTogglePathVisible,
}: SidebarPathItemProps): ReactElement => {
  const [draftName, setDraftName] = useState(path.name);
  const skipBlurCommitRef = useRef(false);

  useEffect(() => {
    setDraftName(path.name);
  }, [path.id, path.name]);

  const commitRename = useCallback((): void => {
    if (draftName !== path.name) {
      onRenamePath(path.id, draftName);
    }
  }, [draftName, onRenamePath, path.id, path.name]);

  const handleRenameBlur = useCallback((): void => {
    if (skipBlurCommitRef.current) {
      skipBlurCommitRef.current = false;
      return;
    }

    commitRename();
  }, [commitRename, path.name]);

  const handleRenameKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>): void => {
      if (event.key === 'Enter') {
        event.preventDefault();
        commitRename();
        skipBlurCommitRef.current = true;
        event.currentTarget.blur();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        skipBlurCommitRef.current = true;
        setDraftName(path.name);
        event.currentTarget.blur();
      }
    },
    [commitRename, path.name],
  );

  const cardClassName = [styles.pathCard, interactiveListClasses.item]
    .filter(Boolean)
    .join(' ');
  const actionsClassName = [
    styles.itemActions,
    interactiveListClasses.hoverActions,
    interactiveListClasses.dimUntilHover,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <SidePanelCard active={isActive} className={cardClassName}>
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
          <CheckCircle2 size={18} className={styles.itemActivationIconActive} />
        ) : (
          <Circle size={18} className={styles.itemActivationIconInactive} />
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
            value={draftName}
            onChange={(event) => {
              setDraftName(event.target.value);
            }}
            onBlur={handleRenameBlur}
            onKeyDown={handleRenameKeyDown}
            aria-label={`rename ${path.name}`}
          />
        </div>

        <div className={actionsClassName}>
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
            disabled={!canDelete}
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
};

export const SidebarPathItem = memo(SidebarPathItemComponent);
