import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { AppNotification } from '../../errors';

type AppNotificationContextValue = {
  notification: AppNotification | null;
  setNotification: (notification: AppNotification | null) => void;
  clearNotification: () => void;
};

const AppNotificationContext =
  createContext<AppNotificationContextValue | null>(null);

type AppNotificationProviderProps = {
  children: ReactNode;
};

export const AppNotificationProvider = ({
  children,
}: AppNotificationProviderProps): ReactElement => {
  const [notification, setNotification] = useState<AppNotification | null>(
    null,
  );

  const clearNotification = useCallback((): void => {
    setNotification(null);
  }, []);

  const value = useMemo<AppNotificationContextValue>(() => {
    return {
      notification,
      setNotification,
      clearNotification,
    };
  }, [clearNotification, notification]);

  return (
    <AppNotificationContext.Provider value={value}>
      {children}
    </AppNotificationContext.Provider>
  );
};

export const useAppNotification = (): AppNotificationContextValue => {
  const value = useContext(AppNotificationContext);

  if (value === null) {
    throw new Error(
      'useAppNotification must be used within AppNotificationProvider.',
    );
  }

  return value;
};
