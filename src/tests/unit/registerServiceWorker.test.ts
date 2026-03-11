import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerServiceWorker } from '../../pwa/registerServiceWorker';

const createWindowObject = (): object => ({
  location: { href: 'http://localhost/' },
});

const createNavigatorObject = () => {
  return {
    serviceWorker: {
      controller: null as ServiceWorker | null,
      register: vi.fn(),
    },
  };
};

const createEventTarget = () => {
  const listeners = new Map<string, Set<EventListener>>();

  return {
    addEventListener: vi.fn((eventName: string, listener: EventListener) => {
      const eventListeners =
        listeners.get(eventName) ?? new Set<EventListener>();
      eventListeners.add(listener);
      listeners.set(eventName, eventListeners);
    }),
    dispatch(eventName: string) {
      const event = new Event(eventName);

      for (const listener of listeners.get(eventName) ?? []) {
        listener(event);
      }
    },
    removeEventListener: vi.fn((eventName: string, listener: EventListener) => {
      listeners.get(eventName)?.delete(listener);
    }),
  };
};

afterEach(() => {
  Object.defineProperty(globalThis.navigator, 'serviceWorker', {
    configurable: true,
    value: undefined,
  });
});

describe('registerServiceWorker', () => {
  it('registers /sw.js in production when service workers are supported', async () => {
    const navigatorObject = createNavigatorObject();
    const registrationEvents = createEventTarget();
    const registration = {
      ...registrationEvents,
      installing: null,
      scope: '/',
      waiting: null,
    } as unknown as ServiceWorkerRegistration;

    navigatorObject.serviceWorker.register.mockResolvedValue(registration);

    await expect(
      registerServiceWorker({
        isProduction: true,
        navigatorObject,
        windowObject: createWindowObject(),
      }),
    ).resolves.toBe(registration);

    expect(navigatorObject.serviceWorker.register).toHaveBeenCalledWith(
      '/sw.js',
    );
  });

  it('falls back to browser globals when undefined override values are passed', async () => {
    const navigatorObject = createNavigatorObject();
    const registrationEvents = createEventTarget();
    const registration = {
      ...registrationEvents,
      installing: null,
      scope: '/',
      waiting: null,
    } as unknown as ServiceWorkerRegistration;

    navigatorObject.serviceWorker.register.mockResolvedValue(registration);
    Object.defineProperty(globalThis.navigator, 'serviceWorker', {
      configurable: true,
      value: navigatorObject.serviceWorker,
    });

    await expect(
      registerServiceWorker({
        isProduction: true,
        navigatorObject: undefined,
        windowObject: undefined,
      }),
    ).resolves.toBe(registration);

    expect(navigatorObject.serviceWorker.register).toHaveBeenCalledWith(
      '/sw.js',
    );
  });

  it('skips registration outside production', async () => {
    const navigatorObject = createNavigatorObject();

    await expect(
      registerServiceWorker({
        isProduction: false,
        navigatorObject,
        windowObject: createWindowObject(),
      }),
    ).resolves.toBeUndefined();

    expect(navigatorObject.serviceWorker.register).not.toHaveBeenCalled();
  });

  it('skips registration when service worker support is unavailable', async () => {
    const navigatorObject = {};

    await expect(
      registerServiceWorker({
        isProduction: true,
        navigatorObject,
        windowObject: undefined,
      }),
    ).resolves.toBeUndefined();
  });

  it('reports registration failures through onError and resolves safely', async () => {
    const navigatorObject = createNavigatorObject();
    const onError = vi.fn();
    const failure = new Error('registration failed');

    navigatorObject.serviceWorker.register.mockRejectedValue(failure);

    await expect(
      registerServiceWorker({
        isProduction: true,
        navigatorObject,
        onError,
        windowObject: createWindowObject(),
      }),
    ).resolves.toBeUndefined();

    expect(onError).toHaveBeenCalledWith(failure);
  });

  it('notifies immediately when a waiting service worker already exists', async () => {
    const navigatorObject = createNavigatorObject();
    const registrationEvents = createEventTarget();
    const registration = {
      ...registrationEvents,
      installing: null,
      waiting: {} as ServiceWorker,
    } as unknown as ServiceWorkerRegistration;
    const onUpdateReady = vi.fn();

    navigatorObject.serviceWorker.register.mockResolvedValue(registration);

    await expect(
      registerServiceWorker({
        isProduction: true,
        navigatorObject,
        onUpdateReady,
        windowObject: createWindowObject(),
      }),
    ).resolves.toBe(registration);

    expect(onUpdateReady).toHaveBeenCalledWith(registration);
  });

  it('notifies when an updated service worker finishes installing', async () => {
    const navigatorObject = createNavigatorObject();
    const registrationEvents = createEventTarget();
    const installingEvents = createEventTarget();
    let workerState: ServiceWorkerState = 'installing';
    const installingWorker = {
      ...installingEvents,
      get state() {
        return workerState;
      },
      postMessage: vi.fn(),
    } as unknown as ServiceWorker;
    const registration = {
      ...registrationEvents,
      installing: installingWorker,
      waiting: null,
    } as unknown as ServiceWorkerRegistration;
    const onUpdateReady = vi.fn();

    navigatorObject.serviceWorker.controller = {} as ServiceWorker;
    navigatorObject.serviceWorker.register.mockResolvedValue(registration);

    await expect(
      registerServiceWorker({
        isProduction: true,
        navigatorObject,
        onUpdateReady,
        windowObject: createWindowObject(),
      }),
    ).resolves.toBe(registration);

    registrationEvents.dispatch('updatefound');
    workerState = 'installed';
    installingEvents.dispatch('statechange');

    expect(onUpdateReady).toHaveBeenCalledWith(registration);
  });
});
