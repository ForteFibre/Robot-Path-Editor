import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { temporal } from 'zundo';
import {
  cloneDomainState,
  createDomainActions,
  createInitialDomainState,
  type DomainActions,
} from './slices/domainSlice';
import {
  createInitialUiState,
  createUiActions,
  type UiActions,
} from './slices/uiSlice';
import type {
  DomainState,
  UiState,
  WorkspacePersistedState,
  WorkspaceSetState,
  WorkspaceSnapshot,
  WorkspaceState,
} from './types';

const toWorkspaceSnapshot = (
  domain: DomainState,
  ui: UiState,
): WorkspaceSnapshot => {
  return {
    mode: ui.mode,
    tool: ui.tool,
    paths: domain.paths,
    points: domain.points,
    lockedPointIds: domain.lockedPointIds,
    activePathId: domain.activePathId,
    canvasTransform: ui.canvasTransform,
    selection: ui.selection,
    isDragging: ui.isDragging,
    snapSettings: ui.snapSettings,
    snapPanelOpen: ui.snapPanelOpen,
    backgroundImage: ui.backgroundImage,
    robotPreviewEnabled: ui.robotPreviewEnabled,
    robotSettings: ui.robotSettings,
  };
};

type WorkspaceHistoryState = {
  undo: (steps?: number) => void;
  redo: (steps?: number) => void;
  clear: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  pause: () => void;
  resume: () => void;
};

export type WorkspaceStoreState = WorkspaceState &
  UiActions &
  DomainActions &
  WorkspaceHistoryState & {
    historyRevision: number;
  };

export const useWorkspaceStore = create<WorkspaceStoreState>()(
  temporal<WorkspaceStoreState, [], [], { domain: DomainState }>(
    (set, get, store) => {
      type TemporalApiState = {
        pastStates: { domain: DomainState }[];
        futureStates: { domain: DomainState }[];
        isTracking: boolean;
        undo: (steps?: number) => void;
        redo: (steps?: number) => void;
        clear: () => void;
        pause: () => void;
        resume: () => void;
      };

      type TemporalApiStore = {
        getState: () => TemporalApiState;
        setState: (
          partial:
            | Partial<TemporalApiState>
            | ((state: TemporalApiState) => Partial<TemporalApiState>),
          replace?: boolean,
        ) => void;
      };

      const historyStore = (): TemporalApiStore => {
        return (
          store as unknown as {
            temporal: TemporalApiStore;
          }
        ).temporal;
      };

      const history = (): TemporalApiState => {
        return historyStore().getState();
      };

      const bumpHistoryRevision = (): void => {
        set((state) => ({
          historyRevision: state.historyRevision + 1,
        }));
      };

      let pausedDomainBase: DomainState | null = null;

      const setWorkspaceState: WorkspaceSetState = (partial) => {
        set((state) => {
          const workspaceState: WorkspaceState = {
            domain: state.domain,
            ui: state.ui,
          };

          if (typeof partial === 'function') {
            return partial(workspaceState);
          }

          return partial;
        });
      };

      const uiActions = createUiActions({
        setState: setWorkspaceState,
      });

      const domainActions = createDomainActions({
        setState: setWorkspaceState,
        clearHistory: () => {
          history().clear();
          bumpHistoryRevision();
        },
      });

      return {
        domain: createInitialDomainState(),
        ui: createInitialUiState(),
        historyRevision: 0,
        ...uiActions,
        ...domainActions,

        undo: (steps) => {
          history().undo(steps);
          bumpHistoryRevision();
        },

        redo: (steps) => {
          history().redo(steps);
          bumpHistoryRevision();
        },

        clear: () => {
          history().clear();
          bumpHistoryRevision();
        },

        canUndo: () => {
          return history().pastStates.length > 0;
        },

        canRedo: () => {
          return history().futureStates.length > 0;
        },

        pause: () => {
          pausedDomainBase ??= get().domain;

          history().pause();
        },

        resume: () => {
          const baseDomain = pausedDomainBase;
          pausedDomainBase = null;

          if (baseDomain !== null && get().domain !== baseDomain) {
            historyStore().setState((temporalState) => ({
              pastStates: [...temporalState.pastStates, { domain: baseDomain }],
              futureStates: [],
            }));
          }

          history().resume();
          bumpHistoryRevision();
        },
      };
    },
    {
      partialize: (state) => ({
        domain: state.domain,
      }),
      equality: (past, current) => {
        return past.domain === current.domain;
      },
    },
  ),
);

export const useWorkspaceActions = () => {
  return useWorkspaceStore(
    useShallow((state: WorkspaceStoreState) => ({
      setMode: state.setMode,
      setTool: state.setTool,
      setActivePath: state.setActivePath,
      setSelection: state.setSelection,
      setSelectedLibraryPointId: state.setSelectedLibraryPointId,
      clearSelection: state.clearSelection,
      setSectionRMin: state.setSectionRMin,
      setDragging: state.setDragging,
      setCanvasTransform: state.setCanvasTransform,
      zoomCanvas: state.zoomCanvas,
      addPath: state.addPath,
      duplicatePath: state.duplicatePath,
      deletePath: state.deletePath,
      renamePath: state.renamePath,
      recolorPath: state.recolorPath,
      togglePathVisible: state.togglePathVisible,
      addWaypoint: state.addWaypoint,
      addHeadingKeyframe: state.addHeadingKeyframe,
      createHeadingKeyframe: state.createHeadingKeyframe,
      updateWaypoint: state.updateWaypoint,
      updateHeadingKeyframe: state.updateHeadingKeyframe,
      unlinkWaypointPoint: state.unlinkWaypointPoint,
      deleteWaypoint: state.deleteWaypoint,
      deleteHeadingKeyframe: state.deleteHeadingKeyframe,
      reorderWaypoint: state.reorderWaypoint,
      addLibraryPoint: state.addLibraryPoint,
      addLibraryPointFromSelection: state.addLibraryPointFromSelection,
      deleteLibraryPoint: state.deleteLibraryPoint,
      updateLibraryPoint: state.updateLibraryPoint,
      updateLibraryPointRobotHeading: state.updateLibraryPointRobotHeading,
      toggleLibraryPointLock: state.toggleLibraryPointLock,
      toggleSnapSetting: state.toggleSnapSetting,
      setSnapPanelOpen: state.setSnapPanelOpen,
      setBackgroundImage: state.setBackgroundImage,
      updateBackgroundImage: state.updateBackgroundImage,
      setRobotPreviewEnabled: state.setRobotPreviewEnabled,
      setRobotSettings: state.setRobotSettings,
      insertLibraryWaypoint: state.insertLibraryWaypoint,
      insertLibraryWaypointAtEndOfPath: state.insertLibraryWaypointAtEndOfPath,
      importWorkspace: state.importWorkspace,
      resetWorkspace: state.resetWorkspace,
      undo: state.undo,
      redo: state.redo,
      clear: state.clear,
      canUndo: state.canUndo,
      canRedo: state.canRedo,
      pause: state.pause,
      resume: state.resume,
    })),
  );
};

export const getWorkspaceSnapshot = (): WorkspaceSnapshot => {
  const state = useWorkspaceStore.getState();
  return toWorkspaceSnapshot(state.domain, state.ui);
};

export const getWorkspacePersistedState = (): WorkspacePersistedState => {
  const state = useWorkspaceStore.getState();

  return {
    domain: cloneDomainState(state.domain),
    ui: {
      mode: state.ui.mode,
      tool: state.ui.tool,
      selection: state.ui.selection,
      canvasTransform: state.ui.canvasTransform,
      backgroundImage: state.ui.backgroundImage,
      robotPreviewEnabled: state.ui.robotPreviewEnabled,
      robotSettings: state.ui.robotSettings,
    },
  };
};

export const getDomainSnapshot = (): DomainState => {
  return cloneDomainState(useWorkspaceStore.getState().domain);
};

export const resetWorkspaceStore = (): void => {
  useWorkspaceStore.setState({
    domain: createInitialDomainState(),
    ui: createInitialUiState(),
  });
  useWorkspaceStore.temporal.getState().clear();
};
