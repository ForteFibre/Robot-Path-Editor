import { normalizePathSections } from '../domain/models';
import { normalizeDomainState } from '../store/domain';
import { createImportedUiState } from '../store/slices/uiSlice';
import type { WorkspacePersistedState } from '../store/types';

const WORKSPACE_FILE_VERSION = 1;
const WORKSPACE_COORDINATE_SYSTEM = 'ros-x-up-y-left' as const;

type SerializableWorkspace = {
  version: number;
  coordinateSystem: typeof WORKSPACE_COORDINATE_SYSTEM;
  workspace: WorkspacePersistedState;
};

type ParsedWorkspace = {
  version: typeof WORKSPACE_FILE_VERSION;
  coordinateSystem: typeof WORKSPACE_COORDINATE_SYSTEM;
  workspace: WorkspacePersistedState;
};

const toPersistedState = (
  domain: WorkspacePersistedState['domain'],
  ui: WorkspacePersistedState['ui'],
): WorkspacePersistedState => {
  const sanitizedPoints = domain.points.map((point) => ({
    id: point.id,
    x: point.x,
    y: point.y,
    robotHeading: point.robotHeading,
    isLibrary: point.isLibrary,
    name: point.name,
  }));
  const normalizedDomain = normalizeDomainState({
    ...domain,
    points: sanitizedPoints,
    paths: domain.paths.map((path) =>
      normalizePathSections({
        ...path,
      }),
    ),
  });
  const normalizedUi = createImportedUiState(normalizedDomain, ui);

  return {
    domain: normalizedDomain,
    ui: {
      mode: normalizedUi.mode,
      tool: normalizedUi.tool,
      selection: normalizedUi.selection,
      canvasTransform: normalizedUi.canvasTransform,
      backgroundImage: normalizedUi.backgroundImage,
      robotPreviewEnabled: normalizedUi.robotPreviewEnabled,
      robotSettings: normalizedUi.robotSettings,
    },
  };
};

const normalizePersistedWorkspace = (
  workspace: WorkspacePersistedState,
): WorkspacePersistedState => {
  return toPersistedState(workspace.domain, workspace.ui);
};

export const serializeWorkspace = (
  workspace: WorkspacePersistedState,
): string => {
  const payload: SerializableWorkspace = {
    version: WORKSPACE_FILE_VERSION,
    coordinateSystem: WORKSPACE_COORDINATE_SYSTEM,
    workspace: normalizePersistedWorkspace(workspace),
  };
  return JSON.stringify(payload, null, 2);
};

export const deserializeWorkspace = (
  source: string,
): WorkspacePersistedState => {
  const parsed = JSON.parse(source) as Partial<ParsedWorkspace>;

  if (
    parsed.coordinateSystem !== WORKSPACE_COORDINATE_SYSTEM ||
    parsed.workspace === undefined ||
    parsed.version !== WORKSPACE_FILE_VERSION
  ) {
    throw new Error('Unsupported workspace format');
  }

  return normalizePersistedWorkspace(parsed.workspace);
};

export const downloadText = (
  filename: string,
  content: string,
  mimeType: string,
): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};
