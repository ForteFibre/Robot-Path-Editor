import {
  initialWorkspace,
  normalizeRobotMotionSettings,
  type BackgroundImage,
  type RobotMotionSettings,
} from '../../domain/models';
import { zoomCanvasTransformAtPoint } from '../../domain/canvas';
import {
  DEFAULT_SNAP_SETTINGS,
  type SnapToggleKey,
} from '../../domain/snapping';
import type {
  DomainState,
  UiState,
  WorkspacePersistedUiState,
  WorkspaceSetState,
} from '../types';

export type UiActions = {
  setMode: (mode: UiState['mode']) => void;
  setTool: (tool: UiState['tool']) => void;
  setSelection: (selection: UiState['selection']) => void;
  setSelectedLibraryPointId: (pointId: string | null) => void;
  clearSelection: () => void;
  setDragging: (isDragging: boolean) => void;
  setCanvasTransform: (transform: UiState['canvasTransform']) => void;
  zoomCanvas: (centerX: number, centerY: number, delta: number) => void;
  toggleSnapSetting: (key: SnapToggleKey) => void;
  setSnapPanelOpen: (isOpen: boolean) => void;
  setBackgroundImage: (image: BackgroundImage | null) => void;
  updateBackgroundImage: (updates: Partial<BackgroundImage>) => void;
  setRobotPreviewEnabled: (enabled: boolean) => void;
  setRobotSettings: (updates: Partial<RobotMotionSettings>) => void;
};

type UiActionDeps = {
  setState: WorkspaceSetState;
};

export const createInitialUiState = (): UiState => {
  const workspace = initialWorkspace();
  const firstLibraryPointId =
    workspace.points.find((point) => point.isLibrary)?.id ?? null;

  return {
    mode: workspace.mode,
    tool: workspace.tool,
    selection: workspace.selection,
    selectedLibraryPointId: firstLibraryPointId,
    canvasTransform: workspace.canvasTransform,
    isDragging: false,
    snapSettings: DEFAULT_SNAP_SETTINGS,
    snapPanelOpen: workspace.snapPanelOpen,
    backgroundImage: workspace.backgroundImage,
    robotPreviewEnabled: workspace.robotPreviewEnabled,
    robotSettings: workspace.robotSettings,
  };
};

const resolveValidSelectedLibraryPointId = (
  domain: DomainState,
  pointId: string | null,
): string | null => {
  if (
    pointId !== null &&
    domain.points.some((point) => point.id === pointId && point.isLibrary)
  ) {
    return pointId;
  }

  return domain.points.find((point) => point.isLibrary)?.id ?? null;
};

const resolveValidSelection = (
  domain: DomainState,
  selection: UiState['selection'],
): UiState['selection'] => {
  if (selection.pathId === null) {
    return {
      pathId: null,
      waypointId: null,
      headingKeyframeId: null,
      sectionIndex: null,
    };
  }

  const selectedPath = domain.paths.find(
    (path) => path.id === selection.pathId,
  );
  if (selectedPath === undefined) {
    return {
      pathId: domain.activePathId,
      waypointId: null,
      headingKeyframeId: null,
      sectionIndex: null,
    };
  }

  const headingKeyframeId =
    selection.headingKeyframeId === null ||
    selectedPath.headingKeyframes.some(
      (keyframe) => keyframe.id === selection.headingKeyframeId,
    )
      ? selection.headingKeyframeId
      : null;

  const waypointId =
    selection.waypointId === null ||
    selectedPath.waypoints.some(
      (waypoint) => waypoint.id === selection.waypointId,
    )
      ? selection.waypointId
      : null;

  const sectionIndex =
    selection.sectionIndex !== null &&
    selection.sectionIndex >= 0 &&
    selection.sectionIndex < selectedPath.waypoints.length - 1 &&
    waypointId === null &&
    headingKeyframeId === null
      ? selection.sectionIndex
      : null;

  return {
    pathId: selectedPath.id,
    waypointId,
    headingKeyframeId,
    sectionIndex,
  };
};

export const normalizeUiState = (domain: DomainState, ui: UiState): UiState => {
  return {
    ...ui,
    selection: resolveValidSelection(domain, ui.selection),
    selectedLibraryPointId: resolveValidSelectedLibraryPointId(
      domain,
      ui.selectedLibraryPointId,
    ),
    snapSettings: {
      ...DEFAULT_SNAP_SETTINGS,
      ...ui.snapSettings,
    },
    snapPanelOpen: ui.snapPanelOpen,
    backgroundImage: ui.backgroundImage,
    robotPreviewEnabled: ui.robotPreviewEnabled,
    robotSettings: normalizeRobotMotionSettings(ui.robotSettings),
  };
};

export const createImportedUiState = (
  domain: DomainState,
  persisted: WorkspacePersistedUiState,
): UiState => {
  return normalizeUiState(domain, {
    ...persisted,
    selectedLibraryPointId: null,
    isDragging: false,
    snapSettings: DEFAULT_SNAP_SETTINGS,
    snapPanelOpen: true,
    robotPreviewEnabled: persisted.robotPreviewEnabled ?? true,
    robotSettings: normalizeRobotMotionSettings(persisted.robotSettings),
  });
};

export const createUiActions = ({ setState }: UiActionDeps): UiActions => {
  return {
    setMode: (mode) => {
      setState((state) => ({
        ui: {
          ...state.ui,
          mode,
        },
      }));
    },

    setTool: (tool) => {
      setState((state) => ({
        ui: {
          ...state.ui,
          tool,
        },
      }));
    },

    setSelection: (selection) => {
      setState((state) => ({
        ui: normalizeUiState(state.domain, {
          ...state.ui,
          selection,
        }),
      }));
    },

    setSelectedLibraryPointId: (selectedLibraryPointId) => {
      setState((state) => ({
        ui: normalizeUiState(state.domain, {
          ...state.ui,
          selectedLibraryPointId,
        }),
      }));
    },

    clearSelection: () => {
      setState((state) => ({
        ui: {
          ...state.ui,
          selection: {
            pathId: null,
            waypointId: null,
            headingKeyframeId: null,
            sectionIndex: null,
          },
        },
      }));
    },

    setDragging: (isDragging) => {
      setState((state) => ({
        ui: {
          ...state.ui,
          isDragging,
        },
      }));
    },

    setCanvasTransform: (transform) => {
      setState((state) => ({
        ui: {
          ...state.ui,
          canvasTransform: transform,
        },
      }));
    },

    zoomCanvas: (centerX, centerY, delta) => {
      setState((state) => {
        return {
          ui: {
            ...state.ui,
            canvasTransform: zoomCanvasTransformAtPoint(
              state.ui.canvasTransform,
              centerX,
              centerY,
              delta,
            ),
          },
        };
      });
    },

    toggleSnapSetting: (key) => {
      setState((state) => ({
        ui: {
          ...state.ui,
          snapSettings: {
            ...state.ui.snapSettings,
            [key]: !state.ui.snapSettings[key],
          },
        },
      }));
    },

    setSnapPanelOpen: (isOpen) => {
      setState((state) => ({
        ui: {
          ...state.ui,
          snapPanelOpen: isOpen,
        },
      }));
    },

    setBackgroundImage: (image) => {
      setState((state) => {
        const hasImage = image !== null;
        const nextTool =
          !hasImage && state.ui.tool === 'edit-image'
            ? 'select'
            : state.ui.tool;
        const nextSelection = hasImage
          ? {
              pathId: null,
              waypointId: null,
              headingKeyframeId: null,
              sectionIndex: null,
            }
          : state.ui.selection;

        return {
          ui: {
            ...state.ui,
            backgroundImage: image,
            tool: nextTool,
            selection: nextSelection,
          },
        };
      });
    },

    updateBackgroundImage: (updates) => {
      setState((state) => {
        if (state.ui.backgroundImage === null) {
          return state;
        }

        return {
          ui: {
            ...state.ui,
            backgroundImage: {
              ...state.ui.backgroundImage,
              ...updates,
            },
          },
        };
      });
    },

    setRobotPreviewEnabled: (robotPreviewEnabled) => {
      setState((state) => ({
        ui: {
          ...state.ui,
          robotPreviewEnabled,
        },
      }));
    },

    setRobotSettings: (updates) => {
      setState((state) => ({
        ui: {
          ...state.ui,
          robotSettings: normalizeRobotMotionSettings({
            ...state.ui.robotSettings,
            ...updates,
          }),
        },
      }));
    },
  };
};
