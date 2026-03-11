import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  registerServiceWorker,
  type RegisterServiceWorkerOptions,
} from './registerServiceWorker';
import { useInstallPrompt } from './useInstallPrompt';
import { useOnlineStatus } from './useOnlineStatus';

type ReloadPage = () => void;

export type UsePwaControllerOptions = Pick<
  RegisterServiceWorkerOptions,
  'navigatorObject' | 'windowObject'
> & {
  isProduction?: boolean;
  registerServiceWorkerFn?: typeof registerServiceWorker;
  reloadPage?: ReloadPage;
};

export type UsePwaControllerResult = {
  applyUpdate: () => Promise<boolean>;
  canInstall: boolean;
  dismissUpdate: () => void;
  install: () => Promise<boolean>;
  isInstalled: boolean;
  isOnline: boolean;
  isUpdateBannerVisible: boolean;
  isUpdateReady: boolean;
  registration: ServiceWorkerRegistration | null;
};

type ServiceWorkerContainerWithEvents = Pick<
  ServiceWorkerContainer,
  'addEventListener' | 'controller' | 'removeEventListener'
>;

const shouldRegisterServiceWorker = (): boolean => {
  return (
    import.meta.env.PROD ||
    import.meta.env.MODE === 'test' ||
    import.meta.env.VITEST === true
  );
};

const defaultReloadPage: ReloadPage = () => {
  globalThis.window.location.reload();
};

export const usePwaController = (
  options: UsePwaControllerOptions = {},
): UsePwaControllerResult => {
  const { clearInstallPrompt, installPrompt, isInstalled } = useInstallPrompt();
  const isOnline = useOnlineStatus();
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  const [isUpdateReady, setIsUpdateReady] = useState(false);
  const [isUpdateDismissed, setIsUpdateDismissed] = useState(false);
  const registerServiceWorkerFn =
    options.registerServiceWorkerFn ?? registerServiceWorker;
  const reloadPage = options.reloadPage ?? defaultReloadPage;
  const serviceWorkerContainer = (options.navigatorObject?.serviceWorker ??
    (globalThis.navigator as RegisterServiceWorkerOptions['navigatorObject'])
      ?.serviceWorker) as ServiceWorkerContainerWithEvents | undefined;
  const isProduction = options.isProduction ?? shouldRegisterServiceWorker();

  useEffect(() => {
    let isMounted = true;
    const registerOptions: RegisterServiceWorkerOptions = {
      isProduction,
      onUpdateReady: (nextRegistration) => {
        if (!isMounted) {
          return;
        }

        setRegistration(nextRegistration);
        setIsUpdateReady(true);
        setIsUpdateDismissed(false);
      },
    };

    if (options.navigatorObject !== undefined) {
      registerOptions.navigatorObject = options.navigatorObject;
    }

    if (options.windowObject !== undefined) {
      registerOptions.windowObject = options.windowObject;
    }

    void registerServiceWorkerFn(registerOptions).then((nextRegistration) => {
      if (!isMounted || nextRegistration === undefined) {
        return;
      }

      setRegistration(nextRegistration);

      if (nextRegistration.waiting !== null) {
        setIsUpdateReady(true);
        setIsUpdateDismissed(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [
    isProduction,
    options.navigatorObject,
    options.windowObject,
    registerServiceWorkerFn,
  ]);

  const install = useCallback(async (): Promise<boolean> => {
    if (installPrompt === null) {
      return false;
    }

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;

      return choice.outcome === 'accepted';
    } finally {
      clearInstallPrompt();
    }
  }, [clearInstallPrompt, installPrompt]);

  const dismissUpdate = useCallback(() => {
    setIsUpdateDismissed(true);
  }, []);

  const applyUpdate = useCallback(async (): Promise<boolean> => {
    const waitingWorker = registration?.waiting;

    if (waitingWorker === null || waitingWorker === undefined) {
      return false;
    }

    if (serviceWorkerContainer === undefined) {
      return false;
    }

    await new Promise<void>((resolve) => {
      const handleControllerChange = (): void => {
        serviceWorkerContainer.removeEventListener(
          'controllerchange',
          handleControllerChange,
        );
        resolve();
      };

      serviceWorkerContainer.addEventListener(
        'controllerchange',
        handleControllerChange,
      );
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    });

    reloadPage();

    return true;
  }, [registration, reloadPage, serviceWorkerContainer]);

  const canInstall = useMemo(() => {
    return installPrompt !== null && !isInstalled;
  }, [installPrompt, isInstalled]);

  return {
    applyUpdate,
    canInstall,
    dismissUpdate,
    install,
    isInstalled,
    isOnline,
    isUpdateBannerVisible: isUpdateReady && !isUpdateDismissed,
    isUpdateReady,
    registration,
  };
};
