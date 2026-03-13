import {
  WORKSPACE_COORDINATE_SYSTEM,
  WORKSPACE_FILE_VERSION,
  type WorkspaceFileDocument,
  type WorkspaceDocument,
} from '../domain/workspaceContract';
import { normalizeWorkspaceDocument } from '../domain/workspaceNormalization';

export class UnsupportedWorkspaceFormatError extends Error {
  constructor() {
    super('Unsupported workspace format');
    this.name = 'UnsupportedWorkspaceFormatError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const normalizeFileDocument = (
  document: WorkspaceDocument,
): WorkspaceDocument => {
  return normalizeWorkspaceDocument(document);
};

const normalizeFileDocumentOrThrow = (document: unknown): WorkspaceDocument => {
  if (!isRecord(document)) {
    throw new UnsupportedWorkspaceFormatError();
  }

  try {
    return normalizeFileDocument(document as WorkspaceDocument);
  } catch {
    throw new UnsupportedWorkspaceFormatError();
  }
};

export const serializeWorkspace = (document: WorkspaceDocument): string => {
  const payload: WorkspaceFileDocument = {
    version: WORKSPACE_FILE_VERSION,
    coordinateSystem: WORKSPACE_COORDINATE_SYSTEM,
    document: normalizeFileDocument(document),
  };
  return JSON.stringify(payload, null, 2);
};

export const deserializeWorkspace = (source: string): WorkspaceDocument => {
  const parsed = JSON.parse(source) as Partial<WorkspaceFileDocument>;

  if (
    parsed.coordinateSystem !== WORKSPACE_COORDINATE_SYSTEM ||
    parsed.document === undefined ||
    parsed.version !== WORKSPACE_FILE_VERSION
  ) {
    throw new UnsupportedWorkspaceFormatError();
  }

  return normalizeFileDocumentOrThrow(parsed.document);
};
