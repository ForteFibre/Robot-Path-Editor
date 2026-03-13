import type { WorkspaceAutosavePayload } from '../domain/workspaceContract';
import { normalizeWorkspaceAutosavePayload } from '../domain/workspaceNormalization';
import {
  deleteIndexedDbRecord,
  getIndexedDbRecord,
  putIndexedDbRecord,
} from './indexedDb';
import { UnsupportedWorkspaceFormatError } from './workspaceCodec';

export const ACTIVE_WORKSPACE_PERSISTENCE_KEY = 'active-workspace';

type WorkspacePersistenceRecord = {
  key: string;
  savedAt: number;
  payloadJson: string;
};

export type LoadResult =
  | { kind: 'missing' }
  | {
      kind: 'loaded';
      workspace: WorkspaceAutosavePayload;
      savedAt: number;
    }
  | {
      kind: 'recovered';
      reason: 'corrupt' | 'unsupported-format' | 'unreadable';
      cleared: true;
    };

const isWorkspacePersistenceRecord = (
  value: unknown,
): value is WorkspacePersistenceRecord => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<WorkspacePersistenceRecord>;

  return (
    typeof candidate.key === 'string' &&
    typeof candidate.savedAt === 'number' &&
    Number.isFinite(candidate.savedAt) &&
    typeof candidate.payloadJson === 'string'
  );
};

const classifyLoadFailure = (
  error: unknown,
): Extract<LoadResult, { kind: 'recovered' }>['reason'] => {
  if (error instanceof SyntaxError) {
    return 'corrupt';
  }

  if (error instanceof UnsupportedWorkspaceFormatError) {
    return 'unsupported-format';
  }

  return 'unreadable';
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const serializeWorkspaceAutosavePayload = (
  workspace: WorkspaceAutosavePayload,
): string => {
  return JSON.stringify(normalizeWorkspaceAutosavePayload(workspace));
};

const deserializeWorkspaceAutosavePayload = (
  source: string,
): WorkspaceAutosavePayload => {
  const parsed = JSON.parse(source) as Partial<WorkspaceAutosavePayload>;

  if (
    !isRecord(parsed) ||
    !isRecord(parsed.document) ||
    !isRecord(parsed.session)
  ) {
    throw new UnsupportedWorkspaceFormatError();
  }

  try {
    return normalizeWorkspaceAutosavePayload(
      parsed as WorkspaceAutosavePayload,
    );
  } catch {
    throw new UnsupportedWorkspaceFormatError();
  }
};

export const saveWorkspacePersistence = async (
  workspace: WorkspaceAutosavePayload,
): Promise<{ savedAt: number }> => {
  const savedAt = Date.now();
  const payloadJson = serializeWorkspaceAutosavePayload(workspace);

  await putIndexedDbRecord({
    key: ACTIVE_WORKSPACE_PERSISTENCE_KEY,
    savedAt,
    payloadJson,
  });

  return { savedAt };
};

export const loadWorkspacePersistence = async (): Promise<LoadResult> => {
  const record = await getIndexedDbRecord(ACTIVE_WORKSPACE_PERSISTENCE_KEY);

  if (record === undefined) {
    return { kind: 'missing' };
  }

  if (!isWorkspacePersistenceRecord(record)) {
    await deleteWorkspacePersistence();
    return {
      kind: 'recovered',
      reason: 'unreadable',
      cleared: true,
    };
  }

  try {
    const workspace = deserializeWorkspaceAutosavePayload(record.payloadJson);

    return {
      kind: 'loaded',
      workspace,
      savedAt: record.savedAt,
    };
  } catch (error) {
    await deleteWorkspacePersistence();
    return {
      kind: 'recovered',
      reason: classifyLoadFailure(error),
      cleared: true,
    };
  }
};

export const deleteWorkspacePersistence = async (): Promise<void> => {
  await deleteIndexedDbRecord(ACTIVE_WORKSPACE_PERSISTENCE_KEY);
};
