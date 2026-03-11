import type { LoadResult } from '../../io/workspacePersistence';
import type { WorkspacePersistedState } from '../../store/types';

export type WorkspacePersistenceRecoveredResult = Extract<
  LoadResult,
  { kind: 'recovered' }
>;

export type WorkspacePersistenceAutosaveOnlyResult = {
  kind: 'autosave-only';
  autosave: WorkspacePersistedState;
  savedAt: number;
};

export type WorkspacePersistenceConflictResult = {
  kind: 'conflict';
  autosave: WorkspacePersistedState;
  autoSavedAt: number;
  linkedFile: WorkspacePersistedState;
  linkedFileModifiedAt: number;
  linkedFileName: string;
};

export type WorkspacePersistenceBootstrapResult =
  | {
      kind: 'no-restore';
    }
  | WorkspacePersistenceAutosaveOnlyResult
  | WorkspacePersistenceConflictResult
  | WorkspacePersistenceRecoveredResult;

export type WorkspacePersistenceRestoreCandidate = Extract<
  WorkspacePersistenceBootstrapResult,
  { kind: 'autosave-only' | 'conflict' }
>;

export type ConflictState = {
  fileName: string;
  lastKnownModifiedAt: number;
  linkedFileModifiedAt: number;
};

export type WorkspaceAutosaveState =
  | {
      kind: 'idle';
      savedAt: number | null;
      message: null;
    }
  | {
      kind: 'saving';
      savedAt: number | null;
      message: null;
    }
  | {
      kind: 'error';
      savedAt: number | null;
      message: string;
    };

export const createIdleWorkspaceAutosaveState = (
  savedAt: number | null,
): WorkspaceAutosaveState => {
  return {
    kind: 'idle',
    savedAt,
    message: null,
  };
};
