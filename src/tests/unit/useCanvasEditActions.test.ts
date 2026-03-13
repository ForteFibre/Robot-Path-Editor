import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCanvasEditActions } from '../../features/canvas/hooks/useCanvasEditActions';
import { useWorkspaceActions } from '../../store/workspaceStore';

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceActions: vi.fn(),
}));

describe('useCanvasEditActions', () => {
  const mockedUseWorkspaceActions = vi.mocked(useWorkspaceActions);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the canvas-focused subset of workspace actions', () => {
    const actionSet = {
      addHeadingKeyframe: vi.fn(),
      clearSelection: vi.fn(),
      insertLibraryWaypoint: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      setCanvasTransform: vi.fn(),
      setDragging: vi.fn(),
      setSectionRMin: vi.fn(),
      setSelection: vi.fn(),
      setSnapPanelOpen: vi.fn(),
      setTool: vi.fn(),
      toggleSnapSetting: vi.fn(),
      updateBackgroundImage: vi.fn(),
      updateHeadingKeyframe: vi.fn(),
      updateWaypoint: vi.fn(),
      zoomCanvas: vi.fn(),
      addPath: vi.fn(),
    };

    mockedUseWorkspaceActions.mockReturnValue(actionSet as never);

    const { result } = renderHook(() => useCanvasEditActions());

    expect(result.current).toEqual({
      addHeadingKeyframe: actionSet.addHeadingKeyframe,
      clearSelection: actionSet.clearSelection,
      insertLibraryWaypoint: actionSet.insertLibraryWaypoint,
      pause: actionSet.pause,
      resume: actionSet.resume,
      setCanvasTransform: actionSet.setCanvasTransform,
      setDragging: actionSet.setDragging,
      setSectionRMin: actionSet.setSectionRMin,
      setSelection: actionSet.setSelection,
      setSnapPanelOpen: actionSet.setSnapPanelOpen,
      setTool: actionSet.setTool,
      toggleSnapSetting: actionSet.toggleSnapSetting,
      updateBackgroundImage: actionSet.updateBackgroundImage,
      updateHeadingKeyframe: actionSet.updateHeadingKeyframe,
      updateWaypoint: actionSet.updateWaypoint,
      zoomCanvas: actionSet.zoomCanvas,
    });
  });
});
