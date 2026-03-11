import { initialWorkspace } from '../../domain/models';
import type { HeadingKeyframe, Point, Waypoint } from '../../domain/models';
import {
  addHeadingKeyframe,
  addLibraryPoint,
  addLibraryPointFromSelection,
  addPath,
  addWaypoint,
  createAndAddHeadingKeyframe,
  deleteHeadingKeyframe,
  deleteLibraryPoint,
  deletePath,
  deleteWaypoint,
  duplicatePath,
  insertLibraryWaypoint,
  insertLibraryWaypointAtEndOfPath,
  recolorPath,
  renamePath,
  reorderWaypoint,
  setActivePath,
  setSectionRMin,
  toggleLibraryPointLock,
  togglePathVisible,
  unlinkWaypointPoint,
  updateHeadingKeyframe,
  updateLibraryPoint,
  updateLibraryPointRobotHeading,
  updateWaypoint,
} from '../domain';
import type {
  DomainState,
  HeadingKeyframeUpdatePatch,
  UiState,
  WaypointUpdatePatch,
  WorkspacePersistedState,
  WorkspaceSetState,
} from '../types';
import {
  createImportedUiState,
  createInitialUiState,
  normalizeUiState,
} from './uiSlice';

export type DomainActions = {
  setActivePath: (pathId: string) => void;
  setSectionRMin: (
    pathId: string,
    sectionIndex: number,
    rMin: number | null,
  ) => void;
  addPath: () => void;
  duplicatePath: (pathId: string) => void;
  deletePath: (pathId: string) => void;
  renamePath: (pathId: string, name: string) => void;
  recolorPath: (pathId: string, color: string) => void;
  togglePathVisible: (pathId: string) => void;
  addWaypoint: (pathId: string, waypoint: Waypoint) => void;
  addHeadingKeyframe: (pathId: string, keyframe: HeadingKeyframe) => void;
  createHeadingKeyframe: (input: {
    pathId: string;
    sectionIndex: number;
    sectionRatio: number;
    robotHeading: number;
  }) => string | null;
  updateWaypoint: (
    pathId: string,
    waypointId: string,
    patch: WaypointUpdatePatch,
  ) => void;
  updateHeadingKeyframe: (
    pathId: string,
    headingKeyframeId: string,
    patch: HeadingKeyframeUpdatePatch,
  ) => void;
  unlinkWaypointPoint: (pathId: string, waypointId: string) => void;
  deleteWaypoint: (pathId: string, waypointId: string) => void;
  deleteHeadingKeyframe: (pathId: string, headingKeyframeId: string) => void;
  reorderWaypoint: (
    pathId: string,
    waypointId: string,
    newIndex: number,
  ) => void;
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
    libraryPointId?: string;
    linkToLibrary?: boolean;
    coordinateSource?: 'input' | 'library';
    afterWaypointId?: string | null | undefined;
  }) => string | null;
  insertLibraryWaypointAtEndOfPath: (
    libraryPointId: string,
    pathId: string,
  ) => string | null;
  importWorkspace: (workspace: WorkspacePersistedState) => void;
  resetWorkspace: () => void;
};

type DomainActionDeps = {
  setState: WorkspaceSetState;
  clearHistory: () => void;
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
  const workspace = initialWorkspace();

  return {
    paths: workspace.paths,
    points: workspace.points,
    lockedPointIds: workspace.lockedPointIds,
    activePathId: workspace.activePathId,
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

export const createDomainActions = ({
  setState,
  clearHistory,
}: DomainActionDeps): DomainActions => {
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

    setSectionRMin: (pathId, sectionIndex, rMin) => {
      updateDomain((domain, ui) => {
        if (ui.mode !== 'path') {
          return domain;
        }

        return setSectionRMin(domain, pathId, sectionIndex, rMin);
      });
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

    addWaypoint: (pathId, waypoint) => {
      updateDomain((domain) => addWaypoint(domain, pathId, waypoint));
    },

    addHeadingKeyframe: (pathId, keyframe) => {
      updateDomain((domain) => addHeadingKeyframe(domain, pathId, keyframe));
    },

    createHeadingKeyframe: (input) => {
      let insertedId: string | null = null;

      setState((state) => {
        const result = createAndAddHeadingKeyframe(state.domain, input);
        insertedId = result.headingKeyframeId;

        if (result.headingKeyframeId === null) {
          return {};
        }

        return {
          domain: result.domain,
          ui: normalizeUiState(result.domain, {
            ...state.ui,
            selection: {
              pathId: input.pathId,
              waypointId: null,
              headingKeyframeId: result.headingKeyframeId,
              sectionIndex: null,
            },
          }),
        };
      });

      return insertedId;
    },

    updateWaypoint: (pathId, waypointId, patch) => {
      updateDomain((domain, ui) =>
        updateWaypoint(domain, pathId, waypointId, patch, ui.mode),
      );
    },

    updateHeadingKeyframe: (pathId, headingKeyframeId, patch) => {
      updateDomain((domain) =>
        updateHeadingKeyframe(domain, pathId, headingKeyframeId, patch),
      );
    },

    unlinkWaypointPoint: (pathId, waypointId) => {
      updateDomain((domain) => unlinkWaypointPoint(domain, pathId, waypointId));
    },

    deleteWaypoint: (pathId, waypointId) => {
      updateDomain(
        (domain) => deleteWaypoint(domain, pathId, waypointId),
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

    deleteHeadingKeyframe: (pathId, headingKeyframeId) => {
      updateDomain(
        (domain) => deleteHeadingKeyframe(domain, pathId, headingKeyframeId),
        (ui) => {
          if (ui.selection.headingKeyframeId !== headingKeyframeId) {
            return ui;
          }

          return {
            ...ui,
            selection: {
              ...ui.selection,
              headingKeyframeId: null,
              sectionIndex: null,
            },
          };
        },
      );
    },

    reorderWaypoint: (pathId, waypointId, newIndex) => {
      updateDomain((domain) =>
        reorderWaypoint(domain, pathId, waypointId, newIndex),
      );
    },

    addLibraryPoint: (input) => {
      let insertedPointId: string | null = null;

      setState((state) => {
        const result = addLibraryPoint(state.domain, input);
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
        const result = addLibraryPointFromSelection(
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
      updateDomain((domain) => deleteLibraryPoint(domain, pointId));
    },

    updateLibraryPoint: (pointId, patch) => {
      updateDomain((domain) => updateLibraryPoint(domain, pointId, patch));
    },

    updateLibraryPointRobotHeading: (pointId, robotHeading) => {
      updateDomain((domain) =>
        updateLibraryPointRobotHeading(domain, pointId, robotHeading),
      );
    },

    toggleLibraryPointLock: (pointId) => {
      updateDomain((domain) => toggleLibraryPointLock(domain, pointId));
    },

    insertLibraryWaypoint: (input) => {
      let insertedWaypointId: string | null = null;

      setState((state) => {
        const result = insertLibraryWaypoint(state.domain, {
          ...input,
          afterWaypointId: input.afterWaypointId,
        });

        insertedWaypointId = result.waypointId;

        if (result.waypointId === null) {
          return {};
        }

        const nextUi = normalizeUiState(result.domain, {
          ...state.ui,
          selection: {
            pathId: input.pathId,
            waypointId: result.waypointId,
            headingKeyframeId: null,
            sectionIndex: null,
          },
        });

        return {
          domain: result.domain,
          ui: nextUi,
        };
      });

      return insertedWaypointId;
    },

    insertLibraryWaypointAtEndOfPath: (libraryPointId, pathId) => {
      let insertedWaypointId: string | null = null;

      setState((state) => {
        const result = insertLibraryWaypointAtEndOfPath(
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

    importWorkspace: (workspace) => {
      const domain = cloneDomainState(workspace.domain);
      const ui = createImportedUiState(domain, workspace.ui);

      setState({ domain, ui });
      clearHistory();
    },

    resetWorkspace: () => {
      setState({
        domain: createInitialDomainState(),
        ui: createInitialUiState(),
      });
      clearHistory();
    },
  };
};
