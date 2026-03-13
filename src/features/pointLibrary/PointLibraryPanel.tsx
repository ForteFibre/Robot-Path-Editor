import { Check, Plus, X } from 'lucide-react';
import { useEffect, useRef, type ReactElement } from 'react';
import styles from './PointLibraryPanel.module.css';
import { Button } from '../../components/common/Button';
import { PanelHeader } from '../../components/common/PanelHeader';
import { PointLibraryForm } from './PointLibraryForm';
import { PointLibraryItem } from './PointLibraryItem';
import { type LibraryPointDraft } from './usePointLibrary';
import { usePointLibraryPanelController } from './usePointLibraryPanelController';

type CreateLibraryPointRowProps = {
  frameClassName: string;
  draft: LibraryPointDraft;
  onChange: (patch: Partial<LibraryPointDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
};

const CreateLibraryPointRow = ({
  frameClassName,
  draft,
  onChange,
  onSave,
  onCancel,
}: CreateLibraryPointRowProps): ReactElement => {
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const itemRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
    nameInputRef.current?.select();

    if (typeof itemRef.current?.scrollIntoView === 'function') {
      itemRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, []);

  return (
    <div
      ref={itemRef}
      className={[frameClassName, styles.itemEditing].join(' ')}
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
              <Button
                type="submit"
                variant="primary"
                size="sm"
                aria-label="save library point"
              >
                <Check size={14} /> Add Pattern
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                aria-label="cancel library point creation"
              >
                <X size={14} /> Cancel
              </Button>
            </>
          }
        />
      </form>
    </div>
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
      <PanelHeader
        title="Library"
        compact
        divider
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={startCreate}
            aria-label="new library point"
            title="New library point"
          >
            <Plus size={16} />
          </Button>
        }
      />

      {createDraft !== null && (
        <CreateLibraryPointRow
          frameClassName={styles.item ?? ''}
          draft={createDraft}
          onChange={changeCreateDraft}
          onSave={saveCreateDraft}
          onCancel={cancelCreate}
        />
      )}

      {items.length === 0 ? (
        <div className={styles.emptyState}>
          ライブラリポイントがまだありません。右上の＋ボタンから追加してください。
        </div>
      ) : (
        <ul className={styles.list} aria-label="library point list">
          {items.map((item) => (
            <PointLibraryItem
              key={item.id}
              frameClassName={styles.item ?? ''}
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
        </ul>
      )}
    </section>
  );
};
