import { useCallback, useMemo, type ReactElement } from 'react';
import { useWorkspaceEditorDerived } from '../app-shell/WorkspaceEditorContext';
import { useSelection } from '../../store/workspaceSelectors';
import { buildSequentialItems } from './pathDetailsModel';
import { PathDetailsPanelPresenter } from './PathDetailsPanelPresenter';
import type { PathItem } from './pathDetailsModel';
import { usePathDetailsActions } from './usePathDetailsActions';

export const PathDetailsPanel = (): ReactElement | null => {
  const { activeResolvedPath: activePath, activePathTiming: pathTiming } =
    useWorkspaceEditorDerived();
  const selection = useSelection();
  const { setSelection, reorderWaypoint } = usePathDetailsActions();

  const waypointTimingsById = useMemo(() => {
    return new Map(
      (pathTiming?.waypointTimings ?? []).map((timing) => [
        timing.waypointId,
        timing,
      ]),
    );
  }, [pathTiming]);

  if (!activePath) {
    return null;
  }

  const sequentialItems = useMemo(() => {
    return buildSequentialItems(activePath, waypointTimingsById);
  }, [activePath, waypointTimingsById]);

  const handleSelectItem = useCallback(
    (item: PathItem): void => {
      setSelection({
        pathId: activePath.id,
        waypointId: item.type === 'waypoint' ? item.id : null,
        headingKeyframeId: item.type === 'headingKeyframe' ? item.id : null,
        sectionIndex: null,
      });
    },
    [activePath.id, setSelection],
  );

  const waypointIds = useMemo(() => {
    return activePath.waypoints.map((waypoint) => waypoint.id);
  }, [activePath.waypoints]);

  const handleDragEnd = useCallback(
    (activeId: string, overId: string): void => {
      const oldIndex = waypointIds.indexOf(activeId);
      const newIndex = waypointIds.indexOf(overId);

      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      reorderWaypoint(activePath.id, activeId, newIndex);
      setSelection({
        pathId: activePath.id,
        waypointId: activeId,
        headingKeyframeId: null,
        sectionIndex: null,
      });
    },
    [activePath.id, reorderWaypoint, setSelection, waypointIds],
  );

  return (
    <PathDetailsPanelPresenter
      pathName={activePath.name}
      totalTime={pathTiming?.totalTime ?? 0}
      sequentialItems={sequentialItems}
      waypointIds={waypointIds}
      selectionWaypointId={selection.waypointId}
      selectionHeadingKeyframeId={selection.headingKeyframeId}
      onSelectItem={handleSelectItem}
      onDragEnd={handleDragEnd}
    />
  );
};
