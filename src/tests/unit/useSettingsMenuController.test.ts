import {
  act,
  renderHook,
  waitFor,
  type RenderHookResult,
} from '@testing-library/react';
import { createElement, type ChangeEvent, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AppNotificationProvider,
  useAppNotification,
} from '../../features/app-shell/AppNotificationContext';
import { loadBackgroundImageFile } from '../../features/toolbar/backgroundImageFile';
import { useSettingsMenuController } from '../../features/toolbar/components/useSettingsMenuController';

vi.mock('../../features/toolbar/backgroundImageFile', () => ({
  loadBackgroundImageFile: vi.fn(),
}));

type SettingsMenuControllerHook = ReturnType<typeof useSettingsMenuController>;
type SettingsMenuControllerSnapshot = {
  controller: SettingsMenuControllerHook;
  notification: ReturnType<typeof useAppNotification>['notification'];
};

type SettingsMenuControllerRenderResult = RenderHookResult<
  SettingsMenuControllerSnapshot,
  unknown
>;

const wrapper = ({ children }: { children: ReactNode }) => {
  return createElement(AppNotificationProvider, null, children);
};

const renderSettingsMenuController = (): SettingsMenuControllerRenderResult => {
  return renderHook(
    () => ({
      controller: useSettingsMenuController(),
      notification: useAppNotification().notification,
    }),
    { wrapper },
  );
};

describe('useSettingsMenuController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads a background image successfully and clears notifications', async () => {
    const backgroundImage = {
      url: 'data:image/png;base64,abc',
      width: 320,
      height: 180,
      x: 0,
      y: 0,
      scale: 1,
      alpha: 1,
    };
    const file = new File(['image'], 'field.png', { type: 'image/png' });
    const event = {
      target: {
        files: [file],
        value: 'C:/fakepath/field.png',
      },
    } as unknown as ChangeEvent<HTMLInputElement>;

    vi.mocked(loadBackgroundImageFile).mockResolvedValue(backgroundImage);

    const { result } = renderSettingsMenuController();

    act(() => {
      result.current.controller.handleBackgroundImageLoad(event);
    });

    await waitFor(() => {
      expect(result.current.controller.backgroundImage).toEqual(
        backgroundImage,
      );
    });

    expect(loadBackgroundImageFile).toHaveBeenCalledWith(file);
    expect(result.current.notification).toBeNull();
    expect(event.target.value).toBe('');
  });

  it('reports a notification when background image loading fails', async () => {
    const file = new File(['oops'], 'broken.png', { type: 'image/png' });
    const event = {
      target: {
        files: [file],
        value: 'broken.png',
      },
    } as unknown as ChangeEvent<HTMLInputElement>;

    vi.mocked(loadBackgroundImageFile).mockRejectedValue(new Error('boom'));

    const { result } = renderSettingsMenuController();

    act(() => {
      result.current.controller.handleBackgroundImageLoad(event);
    });

    await waitFor(() => {
      expect(result.current.notification).toEqual({
        kind: 'error',
        error: {
          kind: 'background-image',
          reason: 'read-failed',
        },
      });
    });

    expect(result.current.controller.backgroundImage).toBeNull();
    expect(event.target.value).toBe('');
  });

  it('opens and closes the settings menu', () => {
    const { result } = renderSettingsMenuController();

    expect(result.current.controller.isOpen).toBe(false);

    act(() => {
      result.current.controller.openMenu();
    });

    expect(result.current.controller.isOpen).toBe(true);

    act(() => {
      result.current.controller.closeMenu();
    });

    expect(result.current.controller.isOpen).toBe(false);
  });
});
