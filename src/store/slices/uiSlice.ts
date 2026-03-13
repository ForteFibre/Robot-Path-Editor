import {
  type BackgroundImage,
  type RobotMotionSettings,
} from '../../domain/models';
import {
  DEFAULT_ROBOT_MOTION_SETTINGS,
  normalizeRobotMotionSettings,
} from '../../domain/modelNormalization';
import { normalizeWorkspaceSession } from '../../domain/workspaceNormalization';
import { zoomCanvasTransformAtPoint } from '../../domain/canvas';
import { DEFAULT_CANVAS_SCALE } from '../../domain/metricScale';
import {
  DEFAULT_SNAP_SETTINGS,
  type SnapToggleKey,
} from '../../domain/snapSettings';
import type { DomainState, UiState, WorkspaceSetState } from '../types';

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
  return {
    mode: 'path',
    tool: 'select',
    selection: {
      pathId: null,
      waypointId: null,
      headingKeyframeId: null,
      sectionIndex: null,
    },
    selectedLibraryPointId: null,
    canvasTransform: {
      x: 200,
      y: 100,
      k: DEFAULT_CANVAS_SCALE,
    },
    isDragging: false,
    snapSettings: DEFAULT_SNAP_SETTINGS,
    snapPanelOpen: false,
    backgroundImage: null,
    robotPreviewEnabled: true,
    robotSettings: DEFAULT_ROBOT_MOTION_SETTINGS,
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

export const normalizeUiState = (domain: DomainState, ui: UiState): UiState => {
  const session = normalizeWorkspaceSession(domain, {
    mode: ui.mode,
    tool: ui.tool,
    selection: ui.selection,
    canvasTransform: ui.canvasTransform,
    robotPreviewEnabled: ui.robotPreviewEnabled,
  });

  return {
    ...ui,
    ...session,
    robotSettings: normalizeRobotMotionSettings(ui.robotSettings),
    selectedLibraryPointId: resolveValidSelectedLibraryPointId(
      domain,
      ui.selectedLibraryPointId,
    ),
    snapSettings: {
      ...DEFAULT_SNAP_SETTINGS,
      ...ui.snapSettings,
    },
    snapPanelOpen: ui.snapPanelOpen,
  };
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
