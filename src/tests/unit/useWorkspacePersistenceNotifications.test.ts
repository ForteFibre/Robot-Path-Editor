import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspacePersistenceNotifications } from '../../features/persistence/useWorkspacePersistenceNotifications';
import type {
  WorkspaceAutosaveState,
  WorkspacePersistenceBootstrapResult,
} from '../../features/persistence/types';

const createAutosaveState = (
  overrides: Partial<WorkspaceAutosaveState> = {},
): WorkspaceAutosaveState => {
  return {
    kind: 'idle',
    savedAt: null,
    error: null,
    ...overrides,
  } as WorkspaceAutosaveState;
};

describe('useWorkspacePersistenceNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns and emits the recovered-workspace notification', async () => {
    const setNotification = vi.fn();
    const bootstrapResult: WorkspacePersistenceBootstrapResult = {
      kind: 'recovered',
      reason: 'corrupt',
      cleared: true,
    };

    const { result } = renderHook(() =>
      useWorkspacePersistenceNotifications({
        autosaveState: createAutosaveState(),
        bootstrapResult,
        setNotification,
      }),
    );

    await waitFor(() => {
      expect(setNotification).toHaveBeenCalledWith({
        kind: 'info',
        message: '保存データが破損していたため自動削除して起動しました。',
      });
    });

    expect(result.current.recoveredNotification).toEqual({
      kind: 'info',
      message: '保存データが破損していたため自動削除して起動しました。',
    });
  });

  it('emits a linked-file unreadable notification when only autosave can be restored', async () => {
    const setNotification = vi.fn();
    const bootstrapResult: WorkspacePersistenceBootstrapResult = {
      kind: 'autosave-only',
      autosave: {
        document: {
          domain: {
            paths: [],
            points: [],
            lockedPointIds: [],
            activePathId: 'path-1',
          },
          backgroundImage: null,
          robotSettings: {
            length: 1,
            width: 1,
            acceleration: 1,
            deceleration: 1,
            maxVelocity: 1,
            centripetalAcceleration: 1,
          },
        },
        session: {
          mode: 'path',
          tool: 'select',
          selection: {
            pathId: null,
            waypointId: null,
            headingKeyframeId: null,
            sectionIndex: null,
          },
          canvasTransform: {
            x: 0,
            y: 0,
            k: 50,
          },
          robotPreviewEnabled: true,
        },
      },
      savedAt: 1_762_000_000_000,
      linkedFileUnreadable: true,
      linkedFileName: 'linked-workspace.json',
    };

    renderHook(() =>
      useWorkspacePersistenceNotifications({
        autosaveState: createAutosaveState(),
        bootstrapResult,
        setNotification,
      }),
    );

    await waitFor(() => {
      expect(setNotification).toHaveBeenCalledWith({
        kind: 'info',
        message:
          '前回リンクしたファイル「linked-workspace.json」を読み込めませんでした。自動保存データのみ復元できます。',
      });
    });
  });

  it('forwards autosave errors as AppNotification error payloads', async () => {
    const setNotification = vi.fn();
    const autosaveError = {
      kind: 'autosave',
      reason: 'write-failed',
    } as const;

    renderHook(() =>
      useWorkspacePersistenceNotifications({
        autosaveState: createAutosaveState({
          kind: 'error',
          savedAt: 123,
          error: autosaveError,
        }),
        bootstrapResult: null,
        setNotification,
      }),
    );

    await waitFor(() => {
      expect(setNotification).toHaveBeenCalledWith({
        kind: 'error',
        error: autosaveError,
      });
    });
  });
});
