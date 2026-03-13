import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useWorkspaceAutosaveTracking } from '../../features/persistence/useWorkspaceAutosaveTracking';
import { useWorkspaceStore } from '../../store/workspaceStore';

describe('useWorkspaceAutosaveTracking', () => {
  it('flags persisted workspace edits while ignoring transient ui state', () => {
    const { result } = renderHook(() => useWorkspaceAutosaveTracking());

    expect(result.current.hasTrackedChange).toBe(false);

    act(() => {
      useWorkspaceStore.getState().setDragging(true);
    });

    expect(result.current.hasTrackedChange).toBe(false);

    act(() => {
      useWorkspaceStore.getState().setTool('add-point');
    });

    expect(result.current.hasTrackedChange).toBe(true);
  });

  it('keeps same-tick tracked source access in sync through store subscriptions', () => {
    const { result, rerender } = renderHook(() =>
      useWorkspaceAutosaveTracking(),
    );
    const { getLatestTrackedSource, syncTrackedState } = result.current;

    let latestSource = getLatestTrackedSource();

    act(() => {
      useWorkspaceStore.getState().setRobotSettings({ maxVelocity: 4.2 });
      latestSource = getLatestTrackedSource();
      syncTrackedState();
    });

    expect(latestSource.robotSettings.maxVelocity).toBe(4.2);

    rerender();

    expect(result.current.hasTrackedChange).toBe(false);
    expect(result.current.trackedSource.robotSettings.maxVelocity).toBe(4.2);
  });
});
