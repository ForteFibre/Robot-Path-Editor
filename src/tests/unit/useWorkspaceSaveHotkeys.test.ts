import { fireEvent, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceSaveHotkeys } from '../../features/toolbar/components/useWorkspaceSaveHotkeys';
import type { WorkspaceFileCommands } from '../../features/workspace-file/types';

type WorkspaceCommands = Pick<WorkspaceFileCommands, 'save' | 'saveAs'> & {
  save: ReturnType<typeof vi.fn<() => Promise<void>>>;
  saveAs: ReturnType<typeof vi.fn<() => Promise<void>>>;
};

const createWorkspaceCommands = (): WorkspaceCommands => {
  const save = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const saveAs = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

  return {
    save,
    saveAs,
  };
};

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('useWorkspaceSaveHotkeys', () => {
  it.each([
    ['Ctrl+S', { key: 's', ctrlKey: true }],
    ['Meta+S', { key: 's', metaKey: true }],
  ])('%s で save を呼び出す', (_label, eventInit) => {
    const workspaceCommands = createWorkspaceCommands();

    renderHook(() => {
      useWorkspaceSaveHotkeys({ workspaceCommands });
    });

    fireEvent.keyDown(document, eventInit);

    expect(workspaceCommands.save).toHaveBeenCalledTimes(1);
    expect(workspaceCommands.saveAs).not.toHaveBeenCalled();
  });

  it.each([
    ['Ctrl+Shift+S', { key: 's', ctrlKey: true, shiftKey: true }],
    ['Meta+Shift+S', { key: 's', metaKey: true, shiftKey: true }],
  ])('%s で saveAs を呼び出す', (_label, eventInit) => {
    const workspaceCommands = createWorkspaceCommands();

    renderHook(() => {
      useWorkspaceSaveHotkeys({ workspaceCommands });
    });

    fireEvent.keyDown(document, eventInit);

    expect(workspaceCommands.saveAs).toHaveBeenCalledTimes(1);
    expect(workspaceCommands.save).not.toHaveBeenCalled();
  });

  it('editable target ではショートカットを無視する', () => {
    const workspaceCommands = createWorkspaceCommands();
    const contentEditable = document.createElement('div');
    contentEditable.contentEditable = 'true';
    Object.defineProperty(contentEditable, 'isContentEditable', {
      configurable: true,
      value: true,
    });
    const editableTargets = [
      document.createElement('input'),
      document.createElement('textarea'),
      document.createElement('select'),
      contentEditable,
    ];

    renderHook(() => {
      useWorkspaceSaveHotkeys({ workspaceCommands });
    });

    for (const target of editableTargets) {
      document.body.appendChild(target);
      fireEvent.keyDown(target, { key: 's', ctrlKey: true });
      fireEvent.keyDown(target, { key: 's', metaKey: true, shiftKey: true });
    }

    expect(workspaceCommands.save).not.toHaveBeenCalled();
    expect(workspaceCommands.saveAs).not.toHaveBeenCalled();
  });

  it('unmount 時に listener を cleanup する', () => {
    const workspaceCommands = createWorkspaceCommands();
    const addEventListenerSpy = vi.spyOn(globalThis, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(globalThis, 'removeEventListener');

    const { unmount } = renderHook(() => {
      useWorkspaceSaveHotkeys({ workspaceCommands });
    });

    const keydownHandler = addEventListenerSpy.mock.calls.find(
      ([type]) => type === 'keydown',
    )?.[1];

    expect(keydownHandler).toBeDefined();

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'keydown',
      keydownHandler,
    );

    fireEvent.keyDown(document, { key: 's', ctrlKey: true });

    expect(workspaceCommands.save).not.toHaveBeenCalled();
    expect(workspaceCommands.saveAs).not.toHaveBeenCalled();
  });
});
