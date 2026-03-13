import type { Waypoint } from '../../domain/models';
import {
  addWaypoint as addWaypointMutation,
  deleteWaypoint as deleteWaypointMutation,
  reorderWaypoint as reorderWaypointMutation,
  setSectionRMin as setSectionRMinMutation,
  unlinkWaypointPoint as unlinkWaypointPointMutation,
  updateWaypoint as updateWaypointMutation,
} from '../domain';
import type {
  DomainState,
  UiState,
  WaypointUpdatePatch,
  WorkspaceSetState,
} from '../types';
import { normalizeUiState } from './uiSlice';

export type WaypointActions = {
  setSectionRMin: (
    pathId: string,
    sectionIndex: number,
    rMin: number | null,
  ) => void;
  addWaypoint: (pathId: string, waypoint: Waypoint) => void;
  updateWaypoint: (
    pathId: string,
    waypointId: string,
    patch: WaypointUpdatePatch,
  ) => void;
  unlinkWaypointPoint: (pathId: string, waypointId: string) => void;
  deleteWaypoint: (pathId: string, waypointId: string) => void;
  reorderWaypoint: (
    pathId: string,
    waypointId: string,
    newIndex: number,
  ) => void;
};

type WaypointActionDeps = {
  setState: WorkspaceSetState;
};

export const createWaypointActions = ({
  setState,
}: WaypointActionDeps): WaypointActions => {
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
    setSectionRMin: (pathId, sectionIndex, rMin) => {
      updateDomain((domain, ui) => {
        if (ui.mode !== 'path') {
          return domain;
        }

        return setSectionRMinMutation(domain, pathId, sectionIndex, rMin);
      });
    },

    addWaypoint: (pathId, waypoint) => {
      updateDomain((domain) => addWaypointMutation(domain, pathId, waypoint));
    },

    updateWaypoint: (pathId, waypointId, patch) => {
      updateDomain((domain, ui) =>
        updateWaypointMutation(domain, pathId, waypointId, patch, ui.mode),
      );
    },

    unlinkWaypointPoint: (pathId, waypointId) => {
      updateDomain((domain) =>
        unlinkWaypointPointMutation(domain, pathId, waypointId),
      );
    },

    deleteWaypoint: (pathId, waypointId) => {
      updateDomain(
        (domain) => deleteWaypointMutation(domain, pathId, waypointId),
        (ui) => {
          if (ui.selection.waypointId !== waypointId) {
            return ui;
          }

          return {
            ...ui,
            selection: {
              ...ui.selection,
              waypointId: null,
              headingKeyframeId: null,
              sectionIndex: null,
            },
          };
        },
      );
    },

    reorderWaypoint: (pathId, waypointId, newIndex) => {
      updateDomain((domain) =>
        reorderWaypointMutation(domain, pathId, waypointId, newIndex),
      );
    },
  };
};
