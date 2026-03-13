import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Check, Lock, LockOpen, Pencil, Plus, Trash2, X } from 'lucide-react';
import styles from './PointLibraryPanel.module.css';
import { Button } from '../../components/common/Button';
import { PointLibraryForm } from './PointLibraryForm';
import { type LibraryPointDraft } from './usePointLibrary';

const formatLibraryValue = (value: number): string => {
  return value.toFixed(1).replace(/\.0$/, '');
};

type PointLibraryItemProps = {
  frameClassName?: string;
  item: {
    id: string;
    name: string;
    x: number;
    y: number;
    robotHeading: number | null;
    usageCount: number;
    isLocked: boolean;
  };
  isSelected: boolean;
  isHighlighted: boolean;
  onSelect: (pointId: string) => void;
  onSave: (
    pointId: string,
    patch: Partial<{
      name: string;
      x: number;
      y: number;
      robotHeading: number | null;
    }>,
  ) => void;
  onInsert: (pointId: string) => void;
  onDelete: (pointId: string) => void;
  onToggleLock: (pointId: string) => void;
};

export const PointLibraryItem = ({
  frameClassName,
  item,
  isSelected,
  isHighlighted,
  onSelect,
  onSave,
  onInsert,
  onDelete,
  onToggleLock,
}: PointLibraryItemProps): ReactElement => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<LibraryPointDraft>({
    name: item.name,
    x: item.x,
    y: item.y,
    robotHeading: item.robotHeading,
  });
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isEditing) {
      return;
    }

    setDraft({
      name: item.name,
      x: item.x,
      y: item.y,
      robotHeading: item.robotHeading,
    });
  }, [isEditing, item.name, item.x, item.y, item.robotHeading]);

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, [isEditing]);

  const handleSave = (): void => {
    onSave(item.id, {
      name: draft.name,
      x: draft.x ?? item.x,
      y: draft.y ?? item.y,
      robotHeading: draft.robotHeading,
    });
    setIsEditing(false);
  };

  const usageText = item.usageCount > 0 ? `${item.usageCount}` : '0';
  const displayName =
    item.name.trim().length > 0 ? item.name : 'Untitled Point';

  return (
    <li
      className={[
        frameClassName ?? styles.item,
        isSelected ? styles.itemSelected : '',
        isHighlighted ? styles.itemHighlighted : '',
        isEditing ? styles.itemEditing : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-highlighted={isHighlighted ? 'true' : 'false'}
      aria-label={`library point ${displayName}`}
    >
      <div className={styles.itemRow}>
        <div className={styles.itemHeader}>
          <button
            type="button"
            className={styles.titleButton}
            onClick={() => {
              onSelect(item.id);
            }}
            aria-label={`select library point ${displayName}`}
          >
            <span className={styles.itemName}>{displayName}</span>
            <div className={styles.statusGroup}>
              {item.isLocked ? (
                <span
                  className={styles.lockBadge}
                  aria-label="locked library point"
                >
                  <Lock size={12} aria-hidden="true" />
                </span>
              ) : null}
              {item.usageCount > 0 && (
                <span className={styles.usageCount} data-testid="usage-count">
                  {usageText}
                </span>
              )}
            </div>
          </button>
          <button
            type="button"
            className={styles.addButton}
            onClick={() => {
              onSelect(item.id);
              onInsert(item.id);
            }}
            aria-label={`insert ${displayName} into path`}
            title="Add to Canvas"
          >
            <Plus size={16} /> Add
          </button>
        </div>

        <div className={styles.itemFooter}>
          <button
            type="button"
            className={styles.coordButton}
            onClick={() => {
              onSelect(item.id);
            }}
            aria-label={`select library point ${displayName}`}
          >
            <span className={styles.coord}>
              <span className={styles.coordLabel}>X</span>{' '}
              {formatLibraryValue(item.x)}
            </span>
            <span className={styles.coord}>
              <span className={styles.coordLabel}>Y</span>{' '}
              {formatLibraryValue(item.y)}
            </span>
            {item.robotHeading !== null && (
              <span className={styles.coord}>
                <span className={styles.coordLabel}>H</span>{' '}
                {formatLibraryValue(item.robotHeading)}°
              </span>
            )}
          </button>

          <div className={[styles.hoverActions].filter(Boolean).join(' ')}>
            <button
              type="button"
              className={styles.iconActionButton}
              onClick={() => {
                onSelect(item.id);
                setIsEditing(true);
              }}
              aria-label={`edit ${displayName}`}
              title="Edit"
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              className={styles.iconActionButton}
              onClick={() => {
                onToggleLock(item.id);
              }}
              aria-label={
                item.isLocked
                  ? `unlock library point ${displayName}`
                  : `lock library point ${displayName}`
              }
              title={item.isLocked ? 'Unlock' : 'Lock'}
            >
              {item.isLocked ? <Lock size={16} /> : <LockOpen size={16} />}
            </button>
            <button
              type="button"
              className={`${styles.iconActionButton} ${styles.dangerActionButton}`}
              onClick={() => {
                onDelete(item.id);
              }}
              aria-label={`delete ${displayName}`}
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {isEditing ? (
        <form
          className={styles.editor}
          onSubmit={(event) => {
            event.preventDefault();
            handleSave();
          }}
        >
          <PointLibraryForm
            draft={draft}
            nameInputRef={nameInputRef}
            disabledCoordinates={item.isLocked}
            disabledRobotHeading={item.isLocked}
            onChange={(patch) => {
              setDraft((current) => ({
                ...current,
                ...patch,
              }));
            }}
            nameAriaLabel="library point name"
            xAriaLabel="library point x"
            yAriaLabel="library point y"
            headingAriaLabel="library point heading"
            actions={
              <>
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  aria-label="save library point"
                >
                  <Check size={14} /> Save
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    setDraft({
                      name: item.name,
                      x: item.x,
                      y: item.y,
                      robotHeading: item.robotHeading,
                    });
                  }}
                  aria-label="cancel library point edit"
                >
                  <X size={14} /> Cancel
                </Button>
              </>
            }
          />
        </form>
      ) : null}
    </li>
  );
};
