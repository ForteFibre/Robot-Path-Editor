import type { CanvasTransform } from './canvasTransform';
import type {
  BackgroundImage,
  CanvasTool,
  EditorMode,
  PathModel,
  Point,
  RobotMotionSettings,
  SelectionState,
} from './models';

export const WORKSPACE_FILE_VERSION = 1 as const;
export const WORKSPACE_COORDINATE_SYSTEM = 'ros-x-up-y-left' as const;

export type Mode = EditorMode;
export type Tool = CanvasTool;
export type Path = PathModel;
export type Selection = SelectionState;
export type RobotSettings = RobotMotionSettings;

export type WorkspaceDomainState = {
  paths: PathModel[];
  points: Point[];
  lockedPointIds: string[];
  activePathId: string;
};

export type CsvWorkspaceSource = Pick<
  WorkspaceDomainState,
  'paths' | 'points' | 'activePathId'
>;

export type WorkspaceDocument = {
  domain: WorkspaceDomainState;
  robotSettings: RobotSettings;
  backgroundImage: BackgroundImage | null;
};

export type WorkspaceSession = {
  mode: Mode;
  tool: Tool;
  selection: Selection;
  canvasTransform: CanvasTransform;
  robotPreviewEnabled?: boolean;
};

export type NormalizedWorkspaceSession = Omit<
  WorkspaceSession,
  'robotPreviewEnabled'
> & {
  robotPreviewEnabled: boolean;
};

export type WorkspaceAutosavePayload = {
  document: WorkspaceDocument;
  session: WorkspaceSession;
};

export type NormalizedWorkspaceAutosavePayload = {
  document: WorkspaceDocument;
  session: NormalizedWorkspaceSession;
};

export type WorkspaceFileDocument = {
  version: typeof WORKSPACE_FILE_VERSION;
  coordinateSystem: typeof WORKSPACE_COORDINATE_SYSTEM;
  document: WorkspaceDocument;
};
