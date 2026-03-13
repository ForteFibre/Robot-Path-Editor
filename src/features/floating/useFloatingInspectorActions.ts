import { useMemo } from 'react';
import { useWorkspaceActions } from '../../store/workspaceStore';

type FloatingInspectorActions = Pick<
  ReturnType<typeof useWorkspaceActions>,
  | 'addLibraryPointFromSelection'
  | 'deleteHeadingKeyframe'
  | 'deleteWaypoint'
  | 'pause'
  | 'resume'
  | 'setSelectedLibraryPointId'
  | 'setSectionRMin'
  | 'unlinkWaypointPoint'
  | 'updateHeadingKeyframe'
  | 'updateWaypoint'
>;

export const useFloatingInspectorActions = (): FloatingInspectorActions => {
  const actions = useWorkspaceActions();
  const {
    addLibraryPointFromSelection,
    deleteHeadingKeyframe,
    deleteWaypoint,
    pause,
    resume,
    setSelectedLibraryPointId,
    setSectionRMin,
    unlinkWaypointPoint,
    updateHeadingKeyframe,
    updateWaypoint,
  } = actions;

  return useMemo(
    () => ({
      addLibraryPointFromSelection,
      deleteHeadingKeyframe,
      deleteWaypoint,
      pause,
      resume,
      setSelectedLibraryPointId,
      setSectionRMin,
      unlinkWaypointPoint,
      updateHeadingKeyframe,
      updateWaypoint,
    }),
    [
      addLibraryPointFromSelection,
      deleteHeadingKeyframe,
      deleteWaypoint,
      pause,
      resume,
      setSelectedLibraryPointId,
      setSectionRMin,
      unlinkWaypointPoint,
      updateHeadingKeyframe,
      updateWaypoint,
    ],
  );
};
