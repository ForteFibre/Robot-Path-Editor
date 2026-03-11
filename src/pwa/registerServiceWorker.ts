type RegisterableServiceWorkerContainer = Pick<
  ServiceWorkerContainer,
  'controller' | 'register'
>;

type ServiceWorkerNavigator = {
  serviceWorker?: RegisterableServiceWorkerContainer;
};

export type RegisterServiceWorkerSupport = {
  isProduction: boolean;
  navigatorObject?: ServiceWorkerNavigator | undefined;
  windowObject?: object | undefined;
};

export type RegisterServiceWorkerOptions =
  Partial<RegisterServiceWorkerSupport> & {
    onError?: (error: unknown) => void;
    onUpdateReady?: (registration: ServiceWorkerRegistration) => void;
    serviceWorkerUrl?: string;
  };

const noop = (_error: unknown): void => undefined;
const noopOnUpdateReady = (_registration: ServiceWorkerRegistration): void =>
  undefined;

type UpdateAwareServiceWorker = ServiceWorker &
  Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

type UpdateAwareServiceWorkerRegistration = ServiceWorkerRegistration &
  Pick<EventTarget, 'addEventListener' | 'removeEventListener'> & {
    installing: UpdateAwareServiceWorker | null;
    waiting: ServiceWorker | null;
  };

const monitorServiceWorkerUpdates = (
  registration: ServiceWorkerRegistration,
  serviceWorker: RegisterableServiceWorkerContainer,
  onUpdateReady: (registration: ServiceWorkerRegistration) => void,
): void => {
  const updateAwareRegistration =
    registration as UpdateAwareServiceWorkerRegistration;
  let hasNotified = false;

  const notifyUpdateReady = (): void => {
    if (hasNotified) {
      return;
    }

    hasNotified = true;
    updateAwareRegistration.removeEventListener(
      'updatefound',
      handleUpdateFound,
    );
    onUpdateReady(registration);
  };

  const handleUpdateFound = (): void => {
    const installingWorker = updateAwareRegistration.installing;

    if (installingWorker === null) {
      return;
    }

    const handleStateChange = (): void => {
      if (
        installingWorker.state === 'installed' &&
        serviceWorker.controller !== null
      ) {
        installingWorker.removeEventListener('statechange', handleStateChange);
        notifyUpdateReady();
      }
    };

    installingWorker.addEventListener('statechange', handleStateChange);
  };

  if (updateAwareRegistration.waiting !== null) {
    notifyUpdateReady();
    return;
  }

  updateAwareRegistration.addEventListener('updatefound', handleUpdateFound);
};

export const registerServiceWorker = async (
  options: RegisterServiceWorkerOptions = {},
): Promise<ServiceWorkerRegistration | undefined> => {
  const isProduction = options.isProduction ?? import.meta.env.PROD;
  const navigatorObject =
    options.navigatorObject ??
    (globalThis.navigator as ServiceWorkerNavigator | undefined);
  const windowObject =
    options.windowObject ?? (globalThis.window as object | undefined);
  const serviceWorkerUrl = options.serviceWorkerUrl ?? '/sw.js';
  const onError = options.onError ?? noop;
  const onUpdateReady = options.onUpdateReady ?? noopOnUpdateReady;
  const serviceWorker = navigatorObject?.serviceWorker;

  if (
    !isProduction ||
    windowObject === undefined ||
    serviceWorker === undefined
  ) {
    return undefined;
  }

  try {
    const registration = await serviceWorker.register(serviceWorkerUrl);

    monitorServiceWorkerUpdates(registration, serviceWorker, onUpdateReady);

    return registration;
  } catch (error) {
    onError(error);
    return undefined;
  }
};
