import { createPath } from '../../domain/factories';
import {
  addPath,
  deletePath,
  duplicatePath,
  recolorPath,
  renamePath,
  setActivePath,
  togglePathVisible,
} from '../domain';
import type { DomainState, UiState, WorkspaceSetState } from '../types';
import { normalizeUiState } from './uiSlice';

export type PathActions = {
  setActivePath: (pathId: string) => void;
  addPath: () => void;
  duplicatePath: (pathId: string) => void;
  deletePath: (pathId: string) => void;
  renamePath: (pathId: string, name: string) => void;
  recolorPath: (pathId: string, color: string) => void;
  togglePathVisible: (pathId: string) => void;
};

type PathActionDeps = {
  setState: WorkspaceSetState;
};

const selectPathOnly = (pathId: string | null): UiState['selection'] => {
  return {
    pathId,
    waypointId: null,
    headingKeyframeId: null,
    sectionIndex: null,
  };
};

export const createInitialDomainState = (): DomainState => {
  const firstPath = createPath(0);

  return {
    paths: [firstPath],
    points: [],
    lockedPointIds: [],
    activePathId: firstPath.id,
  };
};

export const cloneDomainState = (domain: DomainState): DomainState => {
  return {
    ...domain,
    paths: domain.paths.map((path) => ({
      ...path,
      waypoints: path.waypoints.map((waypoint) => ({ ...waypoint })),
      headingKeyframes: path.headingKeyframes.map((keyframe) => ({
        ...keyframe,
      })),
      sectionRMin: [...path.sectionRMin],
    })),
    points: domain.points.map((point) => ({ ...point })),
    lockedPointIds: [...domain.lockedPointIds],
  };
};

export const createPathActions = ({
  setState,
}: PathActionDeps): PathActions => {
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
    setActivePath: (pathId) => {
      updateDomain(
        (domain) => setActivePath(domain, pathId),
        (ui, nextDomain) => ({
          ...ui,
          selection: selectPathOnly(nextDomain.activePathId),
        }),
      );
    },

    addPath: () => {
      updateDomain(
        (domain) => addPath(domain),
        (ui, nextDomain) => ({
          ...ui,
          selection: selectPathOnly(nextDomain.activePathId),
        }),
      );
    },

    duplicatePath: (pathId) => {
      updateDomain(
        (domain) => duplicatePath(domain, pathId),
        (ui, nextDomain) => ({
          ...ui,
          selection: selectPathOnly(nextDomain.activePathId),
        }),
      );
    },

    deletePath: (pathId) => {
      updateDomain(
        (domain) => deletePath(domain, pathId),
        (ui, nextDomain) => {
          if (ui.selection.pathId !== pathId) {
            return ui;
          }

          return {
            ...ui,
            selection: selectPathOnly(nextDomain.activePathId),
          };
        },
      );
    },

    renamePath: (pathId, name) => {
      updateDomain((domain) => renamePath(domain, pathId, name));
    },

    recolorPath: (pathId, color) => {
      updateDomain((domain) => recolorPath(domain, pathId, color));
    },

    togglePathVisible: (pathId) => {
      updateDomain((domain) => togglePathVisible(domain, pathId));
    },
  };
};
