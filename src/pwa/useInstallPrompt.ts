import { useCallback, useEffect, useState } from 'react';

export type InstallPromptOutcome = 'accepted' | 'dismissed';

export type BeforeInstallPromptEvent = Event & {
  platforms?: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: InstallPromptOutcome;
    platform: string;
  }>;
};

export type UseInstallPromptResult = {
  clearInstallPrompt: () => void;
  installPrompt: BeforeInstallPromptEvent | null;
  isInstalled: boolean;
};

const INSTALL_DISPLAY_MODE_QUERY = '(display-mode: standalone)';

const isStandaloneDisplayMode = (): boolean => {
  if (typeof globalThis.window.matchMedia !== 'function') {
    return false;
  }

  return globalThis.window.matchMedia(INSTALL_DISPLAY_MODE_QUERY).matches;
};

export const useInstallPrompt = (): UseInstallPromptResult => {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    return isStandaloneDisplayMode();
  });

  const clearInstallPrompt = useCallback(() => {
    setInstallPrompt(null);
  }, []);

  useEffect(() => {
    const mediaQuery =
      typeof globalThis.window.matchMedia === 'function'
        ? globalThis.window.matchMedia(INSTALL_DISPLAY_MODE_QUERY)
        : null;

    const syncInstalledState = (nextIsInstalled: boolean): void => {
      setIsInstalled(nextIsInstalled);

      if (nextIsInstalled) {
        setInstallPrompt(null);
      }
    };

    syncInstalledState(mediaQuery?.matches ?? false);

    const handleBeforeInstallPrompt = (event: Event): void => {
      const promptEvent = event as BeforeInstallPromptEvent;

      promptEvent.preventDefault();

      if (mediaQuery?.matches ?? false) {
        syncInstalledState(true);
        return;
      }

      syncInstalledState(false);
      setInstallPrompt(promptEvent);
    };

    const handleAppInstalled = (): void => {
      syncInstalledState(true);
    };

    const handleDisplayModeChange = (): void => {
      syncInstalledState(mediaQuery?.matches ?? false);
    };

    globalThis.window.addEventListener(
      'beforeinstallprompt',
      handleBeforeInstallPrompt as EventListener,
    );
    globalThis.window.addEventListener(
      'appinstalled',
      handleAppInstalled as EventListener,
    );
    mediaQuery?.addEventListener('change', handleDisplayModeChange);

    return () => {
      globalThis.window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt as EventListener,
      );
      globalThis.window.removeEventListener(
        'appinstalled',
        handleAppInstalled as EventListener,
      );
      mediaQuery?.removeEventListener('change', handleDisplayModeChange);
    };
  }, []);

  return {
    clearInstallPrompt,
    installPrompt: isInstalled ? null : installPrompt,
    isInstalled,
  };
};
