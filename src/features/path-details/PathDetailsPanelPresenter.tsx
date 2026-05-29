import { SidePanel, SidePanelCard } from '../../components/common/SidePanel';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  memo,
  useCallback,
  useMemo,
  type CSSProperties,
  type ReactElement,
} from 'react';
import { GripVertical, Route, MapPin, Navigation, Info } from 'lucide-react';
import {
  formatSeconds,
  getItemLabel,
  getItemSubtitle,
  type PathItem,
} from './pathDetailsModel';
import { PanelHeader } from '../../components/common/PanelHeader';
import styles from './PathDetailsPanel.module.css';
import { InteractiveList } from '../../components/common/InteractiveList';

type PathItemCardProps = {
  item: PathItem;
  isActive: boolean;
  onSelect: (item: PathItem) => void;
  dragHandle: ReactElement;
};

const PathItemCard = ({
  item,
  isActive,
  onSelect,
  dragHandle,
}: PathItemCardProps) => {
  const isWaypoint = item.type === 'waypoint';
  const itemLabel = getItemLabel(item);
  const itemSubtitle = getItemSubtitle(item);

  return (
    <>
      <button
        type="button"
        className={styles.itemButton}
        data-ui-focus="input-accent"
        onClick={() => {
          onSelect(item);
        }}
        aria-pressed={isActive}
        aria-label={`Select ${isWaypoint ? 'waypoint' : 'heading keyframe'} ${itemLabel}`}
      >
        <div className={styles.itemIconWrapper}>
          {isWaypoint ? (
            <div className={styles.waypointIcon}>
              <MapPin size={14} />
            </div>
          ) : (
            <div className={styles.headingIcon}>
              <Navigation size={14} />
            </div>
          )}
        </div>

        <div className={styles.itemInfo}>
          <span className={styles.itemTitle}>{itemLabel}</span>
          <span className={styles.itemSubtitle}>{itemSubtitle}</span>
          {isWaypoint && item.timing !== null ? (
            <span className={styles.itemMeta}>
              通過 {formatSeconds(item.timing.time)}
            </span>
          ) : null}
        </div>
      </button>

      {dragHandle}
    </>
  );
};

const MemoizedPathItemCard = memo(PathItemCard);

type SortableWaypointRowProps = {
  item: Extract<PathItem, { type: 'waypoint' }>;
  isActive: boolean;
  onSelect: (item: PathItem) => void;
};

const SortableWaypointRowComponent = ({
  item,
  isActive,
  onSelect,
}: SortableWaypointRowProps): ReactElement => {
  const itemLabel = getItemLabel(item);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
  });

  const style = useMemo(() => {
    return {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.45 : 1,
      zIndex: isDragging ? 2 : 1,
    } satisfies CSSProperties;
  }, [isDragging, transform, transition]);

  const dragHandle = useMemo(() => {
    return (
      <button
        type="button"
        className={styles.dragHandle}
        data-ui-focus="input-accent"
        data-ui-hover="drag-handle"
        {...attributes}
        {...listeners}
        aria-label={`Reorder waypoint ${itemLabel}`}
        title={`Reorder waypoint ${itemLabel}`}
      >
        <GripVertical size={16} />
      </button>
    );
  }, [attributes, itemLabel, listeners]);

  return (
    <SidePanelCard
      ref={setNodeRef}
      style={style}
      active={isActive}
      className={[styles.itemCard, isActive ? styles.itemCardActive : '']
        .filter(Boolean)
        .join(' ')}
    >
      <MemoizedPathItemCard
        item={item}
        isActive={isActive}
        onSelect={onSelect}
        dragHandle={dragHandle}
      />
    </SidePanelCard>
  );
};

const SortableWaypointRow = memo(SortableWaypointRowComponent);

type StaticPathItemRowProps = {
  item: Extract<PathItem, { type: 'headingKeyframe' }>;
  isActive: boolean;
  onSelect: (item: PathItem) => void;
};

const StaticPathItemRowComponent = ({
  item,
  isActive,
  onSelect,
}: StaticPathItemRowProps): ReactElement => {
  return (
    <SidePanelCard
      active={isActive}
      className={[styles.itemCard, isActive ? styles.itemCardActive : '']
        .filter(Boolean)
        .join(' ')}
    >
      <MemoizedPathItemCard
        item={item}
        isActive={isActive}
        onSelect={onSelect}
        dragHandle={
          <span
            className={`${styles.dragHandle} ${styles.dragHandleDisabled}`}
            aria-hidden="true"
          />
        }
      />
    </SidePanelCard>
  );
};

const StaticPathItemRow = memo(StaticPathItemRowComponent);

export type PathDetailsPanelPresenterProps = {
  pathName: string;
  totalTime: number;
  sequentialItems: PathItem[];
  waypointIds: string[];
  selectionWaypointId: string | null;
  selectionHeadingKeyframeId: string | null;
  onSelectItem: (item: PathItem) => void;
  onDragEnd: (activeId: string, overId: string) => void;
};

export const PathDetailsPanelPresenter = ({
  pathName,
  totalTime,
  sequentialItems,
  waypointIds,
  selectionWaypointId,
  selectionHeadingKeyframeId,
  onSelectItem,
  onDragEnd,
}: PathDetailsPanelPresenterProps): ReactElement => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent): void => {
      if (over === null || active.id === over.id) {
        return;
      }

      onDragEnd(String(active.id), String(over.id));
    },
    [onDragEnd],
  );

  const getKey = useCallback((item: PathItem): string => item.id, []);
  const renderItem = useCallback(
    (item: PathItem): ReactElement => {
      const isActive =
        (item.type === 'waypoint' && selectionWaypointId === item.id) ||
        (item.type === 'headingKeyframe' &&
          selectionHeadingKeyframeId === item.id);

      return item.type === 'waypoint' ? (
        <SortableWaypointRow
          item={item}
          isActive={isActive}
          onSelect={onSelectItem}
        />
      ) : (
        <StaticPathItemRow
          item={item}
          isActive={isActive}
          onSelect={onSelectItem}
        />
      );
    },
    [onSelectItem, selectionHeadingKeyframeId, selectionWaypointId],
  );

  return (
    <SidePanel side="right" aria-label="path details sidebar">
      <PanelHeader
        icon={<Route size={18} />}
        title="Path Elements"
        subtitle={pathName}
        iconTone="accent"
        divider
      >
        <span className={styles.totalTimeBadge}>
          Total {formatSeconds(totalTime)}
        </span>
      </PanelHeader>

      <div className={styles.content}>
        {sequentialItems.length === 0 ? (
          <InteractiveList<PathItem>
            items={[]}
            getKey={() => 'empty-path-item-list'}
            renderItem={() => null}
            emptyState={
              <>
                <Info size={32} className={styles.emptyStateIcon} />
                <p className={styles.emptyStateMessage}>
                  このパスにはポイントがありません。
                  <br />
                  キャンバスをクリックして追加してください。
                </p>
              </>
            }
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={waypointIds}
              strategy={verticalListSortingStrategy}
            >
              <InteractiveList
                as="ol"
                items={sequentialItems}
                getKey={getKey}
                className={styles.pathItemsList}
                aria-label="Path elements"
                renderItem={renderItem}
              />
            </SortableContext>
          </DndContext>
        )}
      </div>
    </SidePanel>
  );
};
