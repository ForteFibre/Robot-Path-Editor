import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type BeforeInstallPromptEvent,
  useInstallPrompt,
} from '../../pwa/useInstallPrompt';

type MatchMediaListener = (event: MediaQueryListEvent) => void;

const createMatchMediaController = (initialMatches = false) => {
  let matches = initialMatches;
  const listeners = new Set<MatchMediaListener>();
  const mediaQueryList = {
    media: '(display-mode: standalone)',
    get matches() {
      return matches;
    },
    addEventListener: vi.fn(
      (_eventName: 'change', listener: MatchMediaListener) => {
        listeners.add(listener);
      },
    ),
    removeEventListener: vi.fn(
      (_eventName: 'change', listener: MatchMediaListener) => {
        listeners.delete(listener);
      },
    ),
  } as unknown as MediaQueryList;

  Object.defineProperty(globalThis.window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn(() => mediaQueryList),
  });

  return {
    setMatches(nextMatches: boolean) {
      matches = nextMatches;
      const event = {
        matches: nextMatches,
        media: mediaQueryList.media,
      } as MediaQueryListEvent;

      for (const listener of listeners) {
        listener(event);
      }
    },
  };
};

const createBeforeInstallPromptEvent = (): BeforeInstallPromptEvent => {
  const event = new Event('beforeinstallprompt', {
    cancelable: true,
  }) as BeforeInstallPromptEvent;

  event.prompt = vi.fn(() => Promise.resolve());
  event.userChoice = Promise.resolve({
    outcome: 'accepted',
    platform: 'web',
  });

  return event;
};

describe('useInstallPrompt', () => {
  beforeEach(() => {
    createMatchMediaController(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis.window, 'matchMedia', {
      configurable: true,
      value: undefined,
    });
  });

  it('captures the deferred install prompt when beforeinstallprompt fires', () => {
    const { result } = renderHook(() => useInstallPrompt());
    const installEvent = createBeforeInstallPromptEvent();
    const preventDefaultSpy = vi.spyOn(installEvent, 'preventDefault');

    act(() => {
      globalThis.window.dispatchEvent(installEvent);
    });

    expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
    expect(result.current.installPrompt).toBe(installEvent);
    expect(result.current.isInstalled).toBe(false);
  });

  it('treats standalone display mode as already installed from the start', () => {
    createMatchMediaController(true);

    const { result } = renderHook(() => useInstallPrompt());

    expect(result.current.isInstalled).toBe(true);
    expect(result.current.installPrompt).toBeNull();
  });

  it('clears the prompt when the app becomes installed', () => {
    const matchMediaController = createMatchMediaController(false);
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      globalThis.window.dispatchEvent(createBeforeInstallPromptEvent());
    });

    expect(result.current.installPrompt).not.toBeNull();

    act(() => {
      matchMediaController.setMatches(true);
    });

    expect(result.current.isInstalled).toBe(true);
    expect(result.current.installPrompt).toBeNull();

    act(() => {
      globalThis.window.dispatchEvent(new Event('appinstalled'));
    });

    expect(result.current.isInstalled).toBe(true);
    expect(result.current.installPrompt).toBeNull();
  });
});
