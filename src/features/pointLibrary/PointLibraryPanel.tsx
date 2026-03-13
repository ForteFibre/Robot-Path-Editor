import { Check, Plus, X } from 'lucide-react';
import { useEffect, useRef, type ReactElement } from 'react';
import styles from './PointLibraryPanel.module.css';
import { PointLibraryForm } from './PointLibraryForm';
import { PointLibraryItem } from './PointLibraryItem';
import { type LibraryPointDraft } from './usePointLibrary';
import { usePointLibraryPanelController } from './usePointLibraryPanelController';

type CreateLibraryPointRowProps = {
  draft: LibraryPointDraft;
  onChange: (patch: Partial<LibraryPointDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
};

const CreateLibraryPointRow = ({
  draft,
  onChange,
  onSave,
  onCancel,
}: CreateLibraryPointRowProps): ReactElement => {
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const itemRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
    nameInputRef.current?.select();

    if (typeof itemRef.current?.scrollIntoView === 'function') {
      itemRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, []);

  return (
    <li
      ref={itemRef}
      className={[styles.item, styles.itemEditing].join(' ')}
      aria-label="new library point draft"
    >
      <form
        className={styles.editor}
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <PointLibraryForm
          draft={draft}
          nameInputRef={nameInputRef}
          onChange={onChange}
          nameAriaLabel="library point name"
          xAriaLabel="library point x"
          yAriaLabel="library point y"
          headingAriaLabel="library point heading"
          actions={
            <>
              <button
                type="submit"
                className={styles.primaryActionButton}
                aria-label="save library point"
              >
                <Check size={14} /> Add Pattern
              </button>
              <button
                type="button"
                className={styles.ghostActionButton}
                onClick={onCancel}
                aria-label="cancel library point creation"
              >
                <X size={14} /> Cancel
              </button>
            </>
          }
        />
      </form>
    </li>
  );
};

export const PointLibraryPanel = (): ReactElement => {
  const {
    cancelCreate,
    changeCreateDraft,
    createDraft,
    deletePoint,
    highlightedLibraryPointId,
    items,
    insertPoint,
    saveCreateDraft,
    savePoint,
    selectPoint,
    selectedLibraryPointId,
    startCreate,
    togglePointLock,
  } = usePointLibraryPanelController();

  return (
    <section className={styles.panel} aria-label="point library management">
      <div className={styles.header}>
        <h2>Library</h2>
        <button
          type="button"
          className="icon-button icon-button--small"
          onClick={startCreate}
          aria-label="new library point"
          title="New library point"
        >
          <Plus size={16} />
        </button>
      </div>

      {items.length === 0 && createDraft === null ? (
        <div className={styles.emptyState}>
          ライブラリポイントがまだありません。右上の＋ボタンから追加してください。
        </div>
      ) : (
        <ul className={styles.list} aria-label="library point list">
          {items.map((item) => (
            <PointLibraryItem
              key={item.id}
              item={item}
              isSelected={selectedLibraryPointId === item.id}
              isHighlighted={highlightedLibraryPointId === item.id}
              onSelect={selectPoint}
              onSave={savePoint}
              onInsert={insertPoint}
              onDelete={deletePoint}
              onToggleLock={togglePointLock}
            />
          ))}

          {createDraft === null ? null : (
            <CreateLibraryPointRow
              draft={createDraft}
              onChange={changeCreateDraft}
              onSave={saveCreateDraft}
              onCancel={cancelCreate}
            />
          )}
        </ul>
      )}
    </section>
  );
};
