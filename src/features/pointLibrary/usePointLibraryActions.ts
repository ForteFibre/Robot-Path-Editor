import { useMemo } from 'react';
import { useWorkspaceActions } from '../../store/workspaceStore';

type PointLibraryActions = Pick<
  ReturnType<typeof useWorkspaceActions>,
  | 'addLibraryPoint'
  | 'deleteLibraryPoint'
  | 'insertLibraryWaypointAtEndOfPath'
  | 'setSelectedLibraryPointId'
  | 'toggleLibraryPointLock'
  | 'updateLibraryPoint'
>;

export const usePointLibraryActions = (): PointLibraryActions => {
  const actions = useWorkspaceActions();
  const {
    addLibraryPoint,
    deleteLibraryPoint,
    insertLibraryWaypointAtEndOfPath,
    setSelectedLibraryPointId,
    toggleLibraryPointLock,
    updateLibraryPoint,
  } = actions;

  return useMemo(
    () => ({
      addLibraryPoint,
      deleteLibraryPoint,
      insertLibraryWaypointAtEndOfPath,
      setSelectedLibraryPointId,
      toggleLibraryPointLock,
      updateLibraryPoint,
    }),
    [
      addLibraryPoint,
      deleteLibraryPoint,
      insertLibraryWaypointAtEndOfPath,
      setSelectedLibraryPointId,
      toggleLibraryPointLock,
      updateLibraryPoint,
    ],
  );
};
