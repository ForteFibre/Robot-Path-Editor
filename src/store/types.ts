import type {
  BackgroundImage,
  CanvasTool,
  CanvasTransform,
  EditorMode,
  HeadingKeyframe,
  PathModel,
  Point,
  RobotMotionSettings,
  SelectionState,
  Workspace,
  Waypoint,
} from '../domain/models';
import type { SnapSettings, SnapToggleKey } from '../domain/snapping';

export type DomainState = {
  paths: PathModel[];
  points: Point[];
  lockedPointIds: string[];
  activePathId: string;
};

export type UiState = {
  mode: EditorMode;
  tool: CanvasTool;
  selection: SelectionState;
  selectedLibraryPointId: string | null;
  canvasTransform: CanvasTransform;
  isDragging: boolean;
  snapSettings: SnapSettings;
  snapPanelOpen: boolean;
  backgroundImage: BackgroundImage | null;
  robotPreviewEnabled: boolean;
  robotSettings: RobotMotionSettings;
};

export type WorkspaceState = {
  domain: DomainState;
  ui: UiState;
};

export type WorkspaceSetState = (
  partial:
    | Partial<WorkspaceState>
    | ((state: WorkspaceState) => Partial<WorkspaceState>),
) => void;

export type WorkspaceSnapshot = Workspace;

export type WorkspacePersistedUiState = Pick<
  UiState,
  | 'mode'
  | 'tool'
  | 'selection'
  | 'canvasTransform'
  | 'backgroundImage'
  | 'robotSettings'
> & {
  robotPreviewEnabled?: boolean;
};

export type WorkspacePersistedState = {
  domain: DomainState;
  ui: WorkspacePersistedUiState;
};

export type WorkspaceHistoryApi = {
  undo: (steps?: number) => void;
  redo: (steps?: number) => void;
  clear: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  pause: () => void;
  resume: () => void;
};

export type WaypointUpdatePatch = Partial<Omit<Waypoint, 'id' | 'pointId'>> & {
  robotHeading?: number | null;
  name?: string;
  x?: number;
  y?: number;
};

export type HeadingKeyframeUpdatePatch = Partial<Omit<HeadingKeyframe, 'id'>>;

export type SnapSettingsActionKey = SnapToggleKey;
