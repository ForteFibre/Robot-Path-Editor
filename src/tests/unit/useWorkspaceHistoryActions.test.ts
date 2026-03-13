import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceHistoryActions } from '../../features/workspace-file/useWorkspaceHistoryActions';
import { useWorkspaceHistory } from '../../store/workspaceHistory';
import { useWorkspaceActions } from '../../store/workspaceStore';

vi.mock('../../store/workspaceHistory', () => ({
  useWorkspaceHistory: vi.fn(),
}));

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceActions: vi.fn(),
}));

describe('useWorkspaceHistoryActions', () => {
  const mockedUseWorkspaceActions = vi.mocked(useWorkspaceActions);
  const mockedUseWorkspaceHistory = vi.mocked(useWorkspaceHistory);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('combines undo/redo actions with current history availability', () => {
    const undo = vi.fn();
    const redo = vi.fn();

    mockedUseWorkspaceActions.mockReturnValue({ undo, redo } as never);
    mockedUseWorkspaceHistory.mockReturnValue({
      canUndo: true,
      canRedo: false,
      undo: vi.fn(),
      redo: vi.fn(),
      clear: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
    });

    const { result } = renderHook(() => useWorkspaceHistoryActions());

    expect(result.current).toEqual({
      canUndo: true,
      canRedo: false,
      undo,
      redo,
    });
  });
});
