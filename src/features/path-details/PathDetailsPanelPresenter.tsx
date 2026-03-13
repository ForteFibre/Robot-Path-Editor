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
import { type CSSProperties, type ReactElement } from 'react';
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
  onSelect: () => void;
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
        onClick={onSelect}
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

type SortableWaypointRowProps = {
  item: Extract<PathItem, { type: 'waypoint' }>;
  isActive: boolean;
  onSelect: () => void;
};

const SortableWaypointRow = ({
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 2 : 1,
  } satisfies CSSProperties;

  return (
    <SidePanelCard
      ref={setNodeRef}
      style={style}
      active={isActive}
      className={[styles.itemCard, isActive ? styles.itemCardActive : '']
        .filter(Boolean)
        .join(' ')}
    >
      <PathItemCard
        item={item}
        isActive={isActive}
        onSelect={onSelect}
        dragHandle={
          <button
            type="button"
            className={styles.dragHandle}
            {...attributes}
            {...listeners}
            aria-label={`Reorder waypoint ${itemLabel}`}
            title={`Reorder waypoint ${itemLabel}`}
          >
            <GripVertical size={16} />
          </button>
        }
      />
    </SidePanelCard>
  );
};

type StaticPathItemRowProps = {
  item: Extract<PathItem, { type: 'headingKeyframe' }>;
  isActive: boolean;
  onSelect: () => void;
};

const StaticPathItemRow = ({
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
      <PathItemCard
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

export type PathDetailsPanelPresenterProps = {
  pathName: string;
  totalTime: number;
  sequentialItems: PathItem[];
  selectionWaypointId: string | null;
  selectionHeadingKeyframeId: string | null;
  onSelectItem: (item: PathItem) => void;
  onDragEnd: (activeId: string, overId: string) => void;
};

export const PathDetailsPanelPresenter = ({
  pathName,
  totalTime,
  sequentialItems,
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

  const waypointIds = sequentialItems
    .filter((item) => item.type === 'waypoint')
    .map((item) => item.id);

  const handleDragEnd = ({ active, over }: DragEndEvent): void => {
    if (over === null || active.id === over.id) {
      return;
    }

    onDragEnd(String(active.id), String(over.id));
  };

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
                getKey={(item) => item.id}
                className={styles.pathItemsList}
                aria-label="Path elements"
                renderItem={(item) => {
                  const isActive =
                    (item.type === 'waypoint' &&
                      selectionWaypointId === item.id) ||
                    (item.type === 'headingKeyframe' &&
                      selectionHeadingKeyframeId === item.id);

                  const handleSelect = (): void => {
                    onSelectItem(item);
                  };

                  return item.type === 'waypoint' ? (
                    <SortableWaypointRow
                      item={item}
                      isActive={isActive}
                      onSelect={handleSelect}
                    />
                  ) : (
                    <StaticPathItemRow
                      item={item}
                      isActive={isActive}
                      onSelect={handleSelect}
                    />
                  );
                }}
              />
            </SortableContext>
          </DndContext>
        )}
      </div>
    </SidePanel>
  );
};
