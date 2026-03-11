import { useEffect, useState } from 'react';

const getInitialOnlineStatus = (): boolean => {
  if (typeof navigator === 'undefined') {
    return true;
  }

  return navigator.onLine;
};

export const useOnlineStatus = (): boolean => {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return getInitialOnlineStatus();
  });

  useEffect(() => {
    const handleOnline = (): void => {
      setIsOnline(true);
    };

    const handleOffline = (): void => {
      setIsOnline(false);
    };

    globalThis.window.addEventListener('online', handleOnline);
    globalThis.window.addEventListener('offline', handleOffline);

    return () => {
      globalThis.window.removeEventListener('online', handleOnline);
      globalThis.window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};
