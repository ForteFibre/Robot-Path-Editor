import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { temporal } from 'zundo';
import {
  createInitialDomainState,
  createPathActions,
  type PathActions,
} from './slices/pathSlice';
import {
  createWaypointActions,
  type WaypointActions,
} from './slices/waypointSlice';
import {
  createHeadingKeyframeActions,
  type HeadingKeyframeActions,
} from './slices/headingKeyframeSlice';
import {
  createLibraryActions,
  type LibraryActions,
} from './slices/librarySlice';
import {
  createWorkspaceActions,
  type WorkspaceActions,
} from './slices/workspaceSlice';
import {
  createInitialUiState,
  createUiActions,
  type UiActions,
} from './slices/uiSlice';
import type {
  DomainState,
  UiState,
  WorkspaceSetState,
  WorkspaceState,
} from './types';
import { normalizeUiState } from './slices/uiSlice';

const createInitialSelection = (pathId: string): UiState['selection'] => {
  return {
    pathId,
    waypointId: null,
    headingKeyframeId: null,
    sectionIndex: null,
  };
};

const createInitialWorkspaceState = (): WorkspaceState => {
  const domain = createInitialDomainState();
  const ui = normalizeUiState(domain, {
    ...createInitialUiState(),
    selection: createInitialSelection(domain.activePathId),
  });

  return {
    domain,
    ui,
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
  PathActions &
  WaypointActions &
  HeadingKeyframeActions &
  LibraryActions &
  WorkspaceActions &
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

      const pathActions = createPathActions({
        setState: setWorkspaceState,
      });

      const waypointActions = createWaypointActions({
        setState: setWorkspaceState,
      });

      const headingKeyframeActions = createHeadingKeyframeActions({
        setState: setWorkspaceState,
      });

      const libraryActions = createLibraryActions({
        setState: setWorkspaceState,
      });

      const workspaceActions = createWorkspaceActions({
        setState: setWorkspaceState,
        clearHistory: () => {
          history().clear();
          bumpHistoryRevision();
        },
        createInitialState: createInitialWorkspaceState,
      });

      return {
        ...createInitialWorkspaceState(),
        historyRevision: 0,
        ...uiActions,
        ...pathActions,
        ...waypointActions,
        ...headingKeyframeActions,
        ...libraryActions,
        ...workspaceActions,

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
      importWorkspaceDocument: state.importWorkspaceDocument,
      restoreWorkspaceAutosave: state.restoreWorkspaceAutosave,
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

export const resetWorkspaceStore = (): void => {
  useWorkspaceStore.setState(createInitialWorkspaceState());
  useWorkspaceStore.temporal.getState().clear();
};
