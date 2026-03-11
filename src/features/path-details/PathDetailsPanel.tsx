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
import { useMemo, type CSSProperties, type ReactElement } from 'react';
import { GripVertical, Route, MapPin, Navigation, Info } from 'lucide-react';

import {
  computePathTiming,
  type WaypointTiming,
} from '../../domain/pathTiming';
import {
  useActivePath,
  usePoints,
  useRobotSettings,
  useSelection,
} from '../../store/workspaceSelectors';
import { useWorkspaceActions } from '../../store/workspaceStore';
import {
  createPointIndex,
  resolvePathModel,
} from '../../domain/pointResolution';
import styles from './PathDetailsPanel.module.css';

// ----------------------------------------------------------------------
// Types & Helpers
// ----------------------------------------------------------------------
type PathItem =
  | {
      type: 'waypoint';
      id: string; // waypointId (for dnd-kit)
      index: number;
      data: ReturnType<typeof resolvePathModel>['waypoints'][0];
      timing: WaypointTiming | null;
    }
  | {
      type: 'headingKeyframe';
      id: string; // headingKeyframeId (for dnd-kit)
      index: number;
      data: ReturnType<typeof resolvePathModel>['headingKeyframes'][0];
    };

const formatSeconds = (seconds: number): string => {
  return `${seconds.toFixed(2).replace(/\.0+$|(?<=\.\d)0+$/, '')} s`;
};

const buildSequentialItems = (
  path: ReturnType<typeof resolvePathModel>,
  waypointTimingsById: Map<string, WaypointTiming>,
): PathItem[] => {
  const items: PathItem[] = [];
  const waypoints = path.waypoints;
  const hks = path.headingKeyframes;

  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    if (wp) {
      items.push({
        type: 'waypoint',
        id: wp.id,
        index: i,
        data: wp,
        timing: waypointTimingsById.get(wp.id) ?? null,
      });
    }

    const sectionHks = hks.filter((hk) => hk.sectionIndex === i);
    sectionHks.sort((a, b) => a.sectionRatio - b.sectionRatio);

    for (const hk of sectionHks) {
      items.push({
        type: 'headingKeyframe',
        id: hk.id,
        index: hks.findIndex((origHk) => origHk.id === hk.id),
        data: hk,
      });
    }
  }

  return items;
};

const getItemLabel = (item: PathItem): string => {
  return (
    item.data.name ||
    (item.type === 'waypoint'
      ? `Waypoint ${item.index + 1}`
      : `Heading ${item.index + 1}`)
  );
};

const getItemSubtitle = (item: PathItem): string => {
  return item.type === 'waypoint'
    ? `WP ${item.index + 1}`
    : `HK ${item.index + 1} (Sect ${item.data.sectionIndex + 1})`;
};

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
    <li
      ref={setNodeRef}
      style={style}
      className={`${styles.itemCard} ${isActive ? styles.itemCardActive : ''}`}
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
    </li>
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
    <li
      className={`${styles.itemCard} ${isActive ? styles.itemCardActive : ''}`}
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
    </li>
  );
};

// ----------------------------------------------------------------------
// Main Panel Component
// ----------------------------------------------------------------------
export const PathDetailsPanel = (): ReactElement | null => {
  const activePathRaw = useActivePath();
  const points = usePoints();
  const robotSettings = useRobotSettings();
  const selection = useSelection();
  const { setSelection, reorderWaypoint } = useWorkspaceActions();

  const pointsById = useMemo(() => createPointIndex(points), [points]);

  const activePath = useMemo(() => {
    if (!activePathRaw) {
      return null;
    }

    return resolvePathModel(activePathRaw, pointsById);
  }, [activePathRaw, pointsById]);

  const pathTiming = useMemo(() => {
    if (activePathRaw === null) {
      return null;
    }

    return computePathTiming(activePathRaw, points, robotSettings);
  }, [activePathRaw, points, robotSettings]);

  const waypointTimingsById = useMemo(() => {
    return new Map(
      (pathTiming?.waypointTimings ?? []).map((timing) => [
        timing.waypointId,
        timing,
      ]),
    );
  }, [pathTiming]);

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

  if (!activePath) {
    return null;
  }

  const sequentialItems = buildSequentialItems(activePath, waypointTimingsById);
  const waypointIds = activePath.waypoints.map((waypoint) => waypoint.id);

  const handleDragEnd = ({ active, over }: DragEndEvent): void => {
    if (over === null || active.id === over.id) {
      return;
    }

    const oldIndex = waypointIds.indexOf(String(active.id));
    const newIndex = waypointIds.indexOf(String(over.id));

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    reorderWaypoint(activePath.id, String(active.id), newIndex);
    setSelection({
      pathId: activePath.id,
      waypointId: String(active.id),
      headingKeyframeId: null,
      sectionIndex: null,
    });
  };

  return (
    <aside className={styles.sidebar} aria-label="path details sidebar">
      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <Route size={18} />
        </div>
        <div className={styles.headerInfo}>
          <h2>Path Elements</h2>
          <p>{activePath.name}</p>
          <span className={styles.totalTimeBadge}>
            Total {formatSeconds(pathTiming?.totalTime ?? 0)}
          </span>
        </div>
      </div>

      <div className={styles.content}>
        {sequentialItems.length === 0 ? (
          <div className={styles.emptyState}>
            <Info size={32} className={styles.emptyStateIcon} />
            <p>
              このパスにはポイントがありません。
              <br />
              キャンバスをクリックして追加してください。
            </p>
          </div>
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
              <ol className={styles.pathItemsList} aria-label="Path elements">
                {sequentialItems.map((item) => {
                  const isActive =
                    (item.type === 'waypoint' &&
                      selection.waypointId === item.id) ||
                    (item.type === 'headingKeyframe' &&
                      selection.headingKeyframeId === item.id);

                  const handleSelect = (): void => {
                    setSelection({
                      pathId: activePath.id,
                      waypointId: item.type === 'waypoint' ? item.id : null,
                      headingKeyframeId:
                        item.type === 'headingKeyframe' ? item.id : null,
                      sectionIndex: null,
                    });
                  };

                  return item.type === 'waypoint' ? (
                    <SortableWaypointRow
                      key={item.id}
                      item={item}
                      isActive={isActive}
                      onSelect={handleSelect}
                    />
                  ) : (
                    <StaticPathItemRow
                      key={item.id}
                      item={item}
                      isActive={isActive}
                      onSelect={handleSelect}
                    />
                  );
                })}
              </ol>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </aside>
  );
};
