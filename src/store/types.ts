import type {
  BackgroundImage,
  CanvasTool,
  EditorMode,
  HeadingKeyframe,
  RobotMotionSettings,
  SelectionState,
  Waypoint,
} from '../domain/models';
import type { WorkspaceDomainState } from '../domain/workspaceContract';
import type { CanvasTransform } from '../domain/canvasTransform';
import type { SnapSettings, SnapToggleKey } from '../domain/snapSettings';

export type DomainState = WorkspaceDomainState;

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

export type WorkspaceStateUpdater = (
  state: WorkspaceState,
) => Partial<WorkspaceState>;

export type WorkspaceSetState = (
  partial: Partial<WorkspaceState> | WorkspaceStateUpdater,
) => void;

export type CanvasInteractionSnapshot = WorkspaceDomainState &
  Pick<
    UiState,
    'mode' | 'tool' | 'selection' | 'canvasTransform' | 'backgroundImage'
  >;

export type {
  WorkspaceAutosavePayload,
  WorkspaceDocument,
  WorkspaceSession,
} from '../domain/workspaceContract';

export type WaypointUpdatePatch = Partial<Omit<Waypoint, 'id' | 'pointId'>> & {
  robotHeading?: number | null;
  name?: string;
  x?: number;
  y?: number;
};

export type HeadingKeyframeUpdatePatch = Partial<Omit<HeadingKeyframe, 'id'>>;

export type SnapSettingsActionKey = SnapToggleKey;
