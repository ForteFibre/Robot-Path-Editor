import type { WorkspaceDocument } from '../domain/workspaceContract';
import { createBenchmarkWorkspaceDocument } from './benchmarkDataset';
import { useWorkspaceStore } from '../store/workspaceStore';

type BenchmarkWindow = Window & {
  __PATH_EDITOR_BENCH__?: BenchmarkWindowApi;
};

declare global {
  type BenchmarkWindowApi = {
    loadBenchmarkWorkspace: () => void;
    getBenchmarkWorkspaceDocument: () => WorkspaceDocument;
  };
}

const hasBenchmarkFlag = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  return new URLSearchParams(window.location.search).has('benchmark');
};

export const exposeBenchmarkApi = (): void => {
  if (!hasBenchmarkFlag()) {
    return;
  }

  (window as BenchmarkWindow).__PATH_EDITOR_BENCH__ = {
    loadBenchmarkWorkspace: () => {
      useWorkspaceStore
        .getState()
        .importWorkspaceDocument(createBenchmarkWorkspaceDocument());
    },
    getBenchmarkWorkspaceDocument: () => createBenchmarkWorkspaceDocument(),
  };
};
