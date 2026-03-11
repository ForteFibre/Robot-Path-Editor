import type { WorkspaceHistoryApi } from './types';
import { useWorkspaceStore } from './workspaceStore';

import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

export const workspaceHistory: WorkspaceHistoryApi = {
  undo: (steps) => {
    useWorkspaceStore.getState().undo(steps);
  },
  redo: (steps) => {
    useWorkspaceStore.getState().redo(steps);
  },
  clear: () => {
    useWorkspaceStore.getState().clear();
  },
  canUndo: () => {
    return useWorkspaceStore.getState().canUndo();
  },
  canRedo: () => {
    return useWorkspaceStore.getState().canRedo();
  },
  pause: () => {
    useWorkspaceStore.getState().pause();
  },
  resume: () => {
    useWorkspaceStore.getState().resume();
  },
};

export const useWorkspaceHistory = () => {
  const { canUndo, canRedo } = useStore(
    useWorkspaceStore.temporal,
    useShallow((state) => ({
      canUndo: state.pastStates.length > 0,
      canRedo: state.futureStates.length > 0,
    })),
  );

  const undo = useWorkspaceStore((state) => state.undo);
  const redo = useWorkspaceStore((state) => state.redo);
  const clear = useWorkspaceStore((state) => state.clear);
  const pause = useWorkspaceStore((state) => state.pause);
  const resume = useWorkspaceStore((state) => state.resume);

  return {
    undo,
    redo,
    clear,
    pause,
    resume,
    canUndo,
    canRedo,
  };
};
