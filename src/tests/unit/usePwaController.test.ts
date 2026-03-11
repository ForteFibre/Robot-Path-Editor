import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegisterServiceWorkerOptions } from '../../pwa/registerServiceWorker';
import type { BeforeInstallPromptEvent } from '../../pwa/useInstallPrompt';
import { usePwaController } from '../../pwa/usePwaController';

type MockServiceWorkerContainer = {
  addEventListener: (
    eventName: 'controllerchange',
    listener: EventListener,
  ) => void;
  controller: ServiceWorker | null;
  emitControllerChange: () => void;
  register: ServiceWorkerContainer['register'];
  removeEventListener: (
    eventName: 'controllerchange',
    listener: EventListener,
  ) => void;
};

const installMatchMediaMock = (initialMatches = false): void => {
  const mediaQueryList = {
    media: '(display-mode: standalone)',
    matches: initialMatches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList;

  Object.defineProperty(globalThis.window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn(() => mediaQueryList),
  });
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

const createServiceWorkerContainer = (): MockServiceWorkerContainer => {
  const listeners = new Set<EventListener>();

  return {
    addEventListener: vi.fn(
      (_eventName: 'controllerchange', listener: EventListener) => {
        listeners.add(listener);
      },
    ),
    controller: {} as ServiceWorker,
    emitControllerChange: () => {
      const event = new Event('controllerchange');

      for (const listener of listeners) {
        listener(event);
      }
    },
    register: vi.fn(() =>
      Promise.resolve({
        waiting: null,
      } as ServiceWorkerRegistration),
    ) as ServiceWorkerContainer['register'],
    removeEventListener: vi.fn(
      (_eventName: 'controllerchange', listener: EventListener) => {
        listeners.delete(listener);
      },
    ),
  };
};

describe('usePwaController', () => {
  beforeEach(() => {
    installMatchMediaMock(false);
    Object.defineProperty(globalThis.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis.window, 'matchMedia', {
      configurable: true,
      value: undefined,
    });
  });

  it('exposes install availability and clears it after prompting', async () => {
    const { result } = renderHook(() =>
      usePwaController({
        isProduction: false,
      }),
    );

    const installEvent = createBeforeInstallPromptEvent();

    act(() => {
      globalThis.window.dispatchEvent(installEvent);
    });

    expect(result.current.canInstall).toBe(true);

    await act(async () => {
      await result.current.install();
    });

    expect(installEvent.prompt).toHaveBeenCalledTimes(1);
    expect(result.current.canInstall).toBe(false);
  });

  it('surfaces update-ready state and lets the banner be dismissed', async () => {
    const registration = {
      waiting: {} as ServiceWorker,
    } as ServiceWorkerRegistration;
    const registerServiceWorkerFn = vi.fn(
      (options?: RegisterServiceWorkerOptions) => {
        options?.onUpdateReady?.(registration);
        return Promise.resolve(registration);
      },
    );

    const { result } = renderHook(() =>
      usePwaController({
        isProduction: true,
        registerServiceWorkerFn,
      }),
    );

    await waitFor(() => {
      expect(result.current.isUpdateReady).toBe(true);
      expect(result.current.isUpdateBannerVisible).toBe(true);
    });

    act(() => {
      result.current.dismissUpdate();
    });

    expect(result.current.isUpdateBannerVisible).toBe(false);
  });

  it('omits undefined browser override options when registering the service worker', async () => {
    let registerCallCount = 0;
    let capturedRegisterOptions: RegisterServiceWorkerOptions | undefined;
    const registerServiceWorkerFn = (
      options?: RegisterServiceWorkerOptions,
    ): Promise<ServiceWorkerRegistration | undefined> => {
      registerCallCount += 1;
      capturedRegisterOptions = options;
      return Promise.resolve(undefined);
    };

    renderHook(() =>
      usePwaController({
        isProduction: true,
        registerServiceWorkerFn,
      }),
    );

    await waitFor(() => {
      expect(registerCallCount).toBe(1);
    });

    expect(capturedRegisterOptions?.isProduction).toBe(true);
    expect(typeof capturedRegisterOptions?.onUpdateReady).toBe('function');
    expect(
      Object.hasOwn(capturedRegisterOptions ?? {}, 'navigatorObject'),
    ).toBe(false);
    expect(Object.hasOwn(capturedRegisterOptions ?? {}, 'windowObject')).toBe(
      false,
    );
  });

  it('posts SKIP_WAITING and reloads after controllerchange', async () => {
    const serviceWorkerContainer = createServiceWorkerContainer();
    const postMessage = vi.fn();
    const waitingWorker = {
      postMessage,
    } as unknown as ServiceWorker;
    const registration = {
      waiting: waitingWorker,
    } as ServiceWorkerRegistration;
    const registerServiceWorkerFn = vi.fn(() => Promise.resolve(registration));
    const reloadPage = vi.fn();

    const { result } = renderHook(() =>
      usePwaController({
        isProduction: true,
        navigatorObject: {
          serviceWorker: serviceWorkerContainer,
        },
        registerServiceWorkerFn,
        reloadPage,
        windowObject: globalThis.window,
      }),
    );

    await waitFor(() => {
      expect(result.current.isUpdateReady).toBe(true);
    });

    const updatePromise = act(async () => {
      const promise = (() => {
        return result.current.applyUpdate();
      })();

      serviceWorkerContainer.emitControllerChange();

      await promise;
    });

    await updatePromise;

    expect(postMessage).toHaveBeenCalledWith({
      type: 'SKIP_WAITING',
    });
    expect(reloadPage).toHaveBeenCalledTimes(1);
  });
});
