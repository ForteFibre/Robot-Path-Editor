import type { LoadResult } from '../../io/workspacePersistence';
import type { AppError } from '../../errors/appError';
import type { AppNotification } from '../../errors/appNotification';
import type {
  WorkspaceAutosavePayload,
  WorkspaceDocument,
} from '../../domain/workspaceContract';

export type WorkspacePersistenceRecoveredResult = Extract<
  LoadResult,
  { kind: 'recovered' }
>;

export type WorkspacePersistenceAutosaveOnlyResult = {
  kind: 'autosave-only';
  autosave: WorkspaceAutosavePayload;
  savedAt: number;
  linkedFileUnreadable: boolean;
  linkedFileName: string | null;
};

export type WorkspacePersistenceConflictResult = {
  kind: 'conflict';
  autosave: WorkspaceAutosavePayload;
  autoSavedAt: number;
  linkedFile: WorkspaceDocument;
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

export type WorkspaceFileActionResult = {
  fileName: string;
};

export type WorkspaceAutosaveState =
  | {
      kind: 'idle';
      savedAt: number | null;
      error: null;
    }
  | {
      kind: 'saving';
      savedAt: number | null;
      error: null;
    }
  | {
      kind: 'error';
      savedAt: number | null;
      error: AppError;
    };

export type WorkspaceRestoreDialogState = {
  result: WorkspacePersistenceRestoreCandidate | null;
  isBusy: boolean;
  onStartFresh: () => void;
  onRestoreLastEdit: () => void;
  onRestoreLinkedFile: () => void;
  onLoadFromFile: (file: File) => Promise<void>;
};

export type WorkspacePersistenceFacade = {
  autosaveState: WorkspaceAutosaveState;
  recoveredNotification: AppNotification | null;
  restoreDialog: WorkspaceRestoreDialogState;
  pendingSaveConflict: ConflictState | null;
  linkedFileName: string | null;
  isFileSystemAccessSupported: boolean;
  newWorkspace: () => Promise<void>;
  importJsonFile: (file: File) => Promise<WorkspaceFileActionResult>;
  openLinkedWorkspace: () => Promise<WorkspaceFileActionResult | null>;
  saveWorkspace: () => Promise<WorkspaceFileActionResult | null>;
  saveWorkspaceAs: () => Promise<WorkspaceFileActionResult | null>;
  restoreLinkedWorkspace: () => Promise<WorkspaceFileActionResult | null>;
  startFresh: () => Promise<void>;
  cancelSaveConflict: () => void;
  confirmOverwriteSaveConflict: () => Promise<WorkspaceFileActionResult | null>;
};

export const createIdleWorkspaceAutosaveState = (
  savedAt: number | null,
): WorkspaceAutosaveState => {
  return {
    kind: 'idle',
    savedAt,
    error: null,
  };
};
