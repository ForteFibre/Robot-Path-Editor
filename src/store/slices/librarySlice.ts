import type { Point } from '../../domain/models';
import {
  addLibraryPoint as addLibraryPointMutation,
  addLibraryPointFromSelection as addLibraryPointFromSelectionMutation,
  deleteLibraryPoint as deleteLibraryPointMutation,
  insertLibraryWaypoint as insertLibraryWaypointMutation,
  insertLibraryWaypointAtEndOfPath as insertLibraryWaypointAtEndOfPathMutation,
  toggleLibraryPointLock as toggleLibraryPointLockMutation,
  updateLibraryPoint as updateLibraryPointMutation,
  updateLibraryPointRobotHeading as updateLibraryPointRobotHeadingMutation,
} from '../domain';
import type { DomainState, UiState, WorkspaceSetState } from '../types';
import { normalizeUiState } from './uiSlice';

export type LibraryActions = {
  addLibraryPoint: (
    input?: Partial<Omit<Point, 'id' | 'isLibrary'>>,
  ) => string | null;
  addLibraryPointFromSelection: () => string | null;
  deleteLibraryPoint: (pointId: string) => void;
  updateLibraryPoint: (
    pointId: string,
    patch: Partial<Omit<Point, 'id' | 'isLibrary'>>,
  ) => void;
  updateLibraryPointRobotHeading: (
    pointId: string,
    robotHeading: number | null,
  ) => void;
  toggleLibraryPointLock: (pointId: string) => void;
  insertLibraryWaypoint: (input: {
    pathId: string;
    x: number;
    y: number;
    pointId?: string;
    waypointId?: string;
    libraryPointId?: string;
    linkToLibrary?: boolean;
    coordinateSource?: 'input' | 'library';
    afterWaypointId?: string | null;
  }) => string | null;
  insertLibraryWaypointAtEndOfPath: (
    libraryPointId: string,
    pathId: string,
  ) => string | null;
};

type LibraryActionDeps = {
  setState: WorkspaceSetState;
};

export const createLibraryActions = ({
  setState,
}: LibraryActionDeps): LibraryActions => {
  const updateDomain = (
    updater: (domain: DomainState, ui: UiState) => DomainState,
    uiUpdater?: (ui: UiState, nextDomain: DomainState) => UiState,
  ): void => {
    setState((state) => {
      const nextDomain = updater(state.domain, state.ui);
      const nextUi = uiUpdater ? uiUpdater(state.ui, nextDomain) : state.ui;

      return {
        domain: nextDomain,
        ui: normalizeUiState(nextDomain, nextUi),
      };
    });
  };

  return {
    addLibraryPoint: (input) => {
      let insertedPointId: string | null = null;

      setState((state) => {
        const result = addLibraryPointMutation(state.domain, input);
        insertedPointId = result.pointId;

        return {
          domain: result.domain,
          ui: normalizeUiState(result.domain, state.ui),
        };
      });

      return insertedPointId;
    },

    addLibraryPointFromSelection: () => {
      let insertedPointId: string | null = null;

      setState((state) => {
        const result = addLibraryPointFromSelectionMutation(
          state.domain,
          state.ui.selection,
        );
        insertedPointId = result.pointId;

        return {
          domain: result.domain,
          ui: normalizeUiState(result.domain, state.ui),
        };
      });

      return insertedPointId;
    },

    deleteLibraryPoint: (pointId) => {
      updateDomain((domain) => deleteLibraryPointMutation(domain, pointId));
    },

    updateLibraryPoint: (pointId, patch) => {
      updateDomain((domain) =>
        updateLibraryPointMutation(domain, pointId, patch),
      );
    },

    updateLibraryPointRobotHeading: (pointId, robotHeading) => {
      updateDomain((domain) =>
        updateLibraryPointRobotHeadingMutation(domain, pointId, robotHeading),
      );
    },

    toggleLibraryPointLock: (pointId) => {
      updateDomain((domain) => toggleLibraryPointLockMutation(domain, pointId));
    },

    insertLibraryWaypoint: (input) => {
      let insertedWaypointId: string | null = null;

      setState((state) => {
        const result = insertLibraryWaypointMutation(state.domain, input);
        insertedWaypointId = result.waypointId;

        if (result.waypointId === null) {
          return {};
        }

        return {
          domain: result.domain,
          ui: normalizeUiState(result.domain, {
            ...state.ui,
            selection: {
              pathId: input.pathId,
              waypointId: result.waypointId,
              headingKeyframeId: null,
              sectionIndex: null,
            },
          }),
        };
      });

      return insertedWaypointId;
    },

    insertLibraryWaypointAtEndOfPath: (libraryPointId, pathId) => {
      let insertedWaypointId: string | null = null;

      setState((state) => {
        const result = insertLibraryWaypointAtEndOfPathMutation(
          state.domain,
          libraryPointId,
          pathId,
        );
        insertedWaypointId = result.waypointId;

        if (result.waypointId === null) {
          return {};
        }

        return {
          domain: result.domain,
          ui: normalizeUiState(result.domain, {
            ...state.ui,
            selection: {
              pathId,
              waypointId: result.waypointId,
              headingKeyframeId: null,
              sectionIndex: null,
            },
          }),
        };
      });

      return insertedWaypointId;
    },
  };
};
