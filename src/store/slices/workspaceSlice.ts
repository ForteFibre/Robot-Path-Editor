import type {
  WorkspaceAutosavePayload,
  WorkspaceDocument,
} from '../../domain/workspaceContract';
import {
  applyWorkspaceAutosavePayload,
  applyWorkspaceDocument,
} from '../adapters/workspacePersistence';
import type { WorkspaceSetState, WorkspaceState } from '../types';

export type WorkspaceActions = {
  importWorkspaceDocument: (document: WorkspaceDocument) => void;
  restoreWorkspaceAutosave: (payload: WorkspaceAutosavePayload) => void;
  resetWorkspace: () => void;
};

type WorkspaceActionDeps = {
  setState: WorkspaceSetState;
  clearHistory: () => void;
  createInitialState: () => WorkspaceState;
};

export const createWorkspaceActions = ({
  setState,
  clearHistory,
  createInitialState,
}: WorkspaceActionDeps): WorkspaceActions => {
  return {
    importWorkspaceDocument: (document) => {
      const { domain, ui } = applyWorkspaceDocument(document);

      setState({ domain, ui });
      clearHistory();
    },

    restoreWorkspaceAutosave: (payload) => {
      const { domain, ui } = applyWorkspaceAutosavePayload(payload);

      setState({ domain, ui });
      clearHistory();
    },

    resetWorkspace: () => {
      setState(createInitialState());
      clearHistory();
    },
  };
};
