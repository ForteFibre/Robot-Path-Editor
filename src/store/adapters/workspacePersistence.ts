import type {
  WorkspaceAutosavePayload,
  WorkspaceDocument,
  WorkspaceSession,
} from '../../domain/workspaceContract';
import {
  normalizeWorkspaceAutosavePayload,
  normalizeWorkspaceDocument,
  normalizeWorkspaceSession,
} from '../../domain/workspaceNormalization';
import { createInitialUiState, normalizeUiState } from '../slices/uiSlice';
import type { UiState, WorkspaceState } from '../types';

export type WorkspaceDocumentSource = {
  domain: WorkspaceState['domain'];
  robotSettings: UiState['robotSettings'];
  backgroundImage: UiState['backgroundImage'];
};

export type WorkspaceAutosaveSource = WorkspaceDocumentSource & {
  mode: UiState['mode'];
  tool: UiState['tool'];
  selection: UiState['selection'];
  canvasTransform: UiState['canvasTransform'];
  robotPreviewEnabled: UiState['robotPreviewEnabled'];
};

const toWorkspaceSessionState = (
  source: WorkspaceAutosaveSource,
): WorkspaceSession => {
  return {
    mode: source.mode,
    tool: source.tool,
    selection: {
      pathId: source.selection.pathId,
      waypointId: source.selection.waypointId,
      headingKeyframeId: source.selection.headingKeyframeId,
      sectionIndex: source.selection.sectionIndex,
    },
    canvasTransform: {
      x: source.canvasTransform.x,
      y: source.canvasTransform.y,
      k: source.canvasTransform.k,
    },
    robotPreviewEnabled: source.robotPreviewEnabled,
  };
};

const toWorkspaceDocumentState = (
  source: WorkspaceDocumentSource,
): WorkspaceDocument => {
  return {
    domain: source.domain,
    backgroundImage:
      source.backgroundImage === null
        ? null
        : {
            url: source.backgroundImage.url,
            width: source.backgroundImage.width,
            height: source.backgroundImage.height,
            x: source.backgroundImage.x,
            y: source.backgroundImage.y,
            scale: source.backgroundImage.scale,
            alpha: source.backgroundImage.alpha,
          },
    robotSettings: {
      length: source.robotSettings.length,
      width: source.robotSettings.width,
      acceleration: source.robotSettings.acceleration,
      deceleration: source.robotSettings.deceleration,
      maxVelocity: source.robotSettings.maxVelocity,
      centripetalAcceleration: source.robotSettings.centripetalAcceleration,
    },
  };
};

const createInitialSelection = (activePathId: string): UiState['selection'] => {
  return {
    pathId: activePathId,
    waypointId: null,
    headingKeyframeId: null,
    sectionIndex: null,
  };
};

const createImportedUiState = (params: {
  domain: WorkspaceState['domain'];
  backgroundImage: UiState['backgroundImage'];
  robotSettings: UiState['robotSettings'];
  session?: WorkspaceSession;
}): WorkspaceState['ui'] => {
  const { domain, backgroundImage, robotSettings, session } = params;
  const baseUi: UiState = {
    ...createInitialUiState(),
    selection: createInitialSelection(domain.activePathId),
    snapPanelOpen: false,
    backgroundImage,
    robotSettings,
  };

  return normalizeUiState(
    domain,
    session === undefined ? baseUi : { ...baseUi, ...session },
  );
};

export const toWorkspaceDocument = (
  state: Pick<WorkspaceState, 'domain' | 'ui'>,
): WorkspaceDocument => {
  return toWorkspaceDocumentFromSource({
    domain: state.domain,
    backgroundImage: state.ui.backgroundImage,
    robotSettings: state.ui.robotSettings,
  });
};

export const toWorkspaceDocumentFromSource = (
  source: WorkspaceDocumentSource,
): WorkspaceDocument => {
  return normalizeWorkspaceDocument(toWorkspaceDocumentState(source));
};

export const toWorkspaceSession = (
  state: Pick<WorkspaceState, 'domain' | 'ui'>,
): WorkspaceSession => {
  const source: WorkspaceAutosaveSource = {
    domain: state.domain,
    mode: state.ui.mode,
    tool: state.ui.tool,
    selection: state.ui.selection,
    canvasTransform: state.ui.canvasTransform,
    robotPreviewEnabled: state.ui.robotPreviewEnabled,
    backgroundImage: state.ui.backgroundImage,
    robotSettings: state.ui.robotSettings,
  };
  const document = toWorkspaceDocumentFromSource(source);

  return normalizeWorkspaceSession(
    document.domain,
    toWorkspaceSessionState(source),
  );
};

export const toWorkspaceAutosavePayload = (
  state: Pick<WorkspaceState, 'domain' | 'ui'>,
): WorkspaceAutosavePayload => {
  return toWorkspaceAutosavePayloadFromSource({
    domain: state.domain,
    mode: state.ui.mode,
    tool: state.ui.tool,
    selection: state.ui.selection,
    canvasTransform: state.ui.canvasTransform,
    robotPreviewEnabled: state.ui.robotPreviewEnabled,
    backgroundImage: state.ui.backgroundImage,
    robotSettings: state.ui.robotSettings,
  });
};

export const toWorkspaceAutosavePayloadFromSource = (
  source: WorkspaceAutosaveSource,
): WorkspaceAutosavePayload => {
  return normalizeWorkspaceAutosavePayload({
    document: toWorkspaceDocumentState(source),
    session: toWorkspaceSessionState(source),
  });
};

export const applyWorkspaceDocument = (
  document: WorkspaceDocument,
): Pick<WorkspaceState, 'domain' | 'ui'> => {
  const normalizedDocument = normalizeWorkspaceDocument(document);

  return {
    domain: normalizedDocument.domain,
    ui: createImportedUiState({
      domain: normalizedDocument.domain,
      backgroundImage: normalizedDocument.backgroundImage,
      robotSettings: normalizedDocument.robotSettings,
    }),
  };
};

export const applyWorkspaceAutosavePayload = (
  payload: WorkspaceAutosavePayload,
): Pick<WorkspaceState, 'domain' | 'ui'> => {
  const normalizedPayload = normalizeWorkspaceAutosavePayload(payload);

  return {
    domain: normalizedPayload.document.domain,
    ui: createImportedUiState({
      domain: normalizedPayload.document.domain,
      backgroundImage: normalizedPayload.document.backgroundImage,
      robotSettings: normalizedPayload.document.robotSettings,
      session: normalizedPayload.session,
    }),
  };
};
