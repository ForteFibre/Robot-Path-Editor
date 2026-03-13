import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

export type ConfirmationRequest = {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
};

type AppConfirmationContextValue = {
  request: ConfirmationRequest | null;
  openConfirmation: (request: ConfirmationRequest) => void;
  closeConfirmation: () => void;
};

const AppConfirmationContext =
  createContext<AppConfirmationContextValue | null>(null);

type AppConfirmationProviderProps = {
  children: ReactNode;
};

export const AppConfirmationProvider = ({
  children,
}: AppConfirmationProviderProps): ReactElement => {
  const [request, setRequest] = useState<ConfirmationRequest | null>(null);

  const openConfirmation = useCallback((nextRequest: ConfirmationRequest) => {
    setRequest(nextRequest);
  }, []);

  const closeConfirmation = useCallback(() => {
    setRequest(null);
  }, []);

  const value = useMemo<AppConfirmationContextValue>(() => {
    return {
      request,
      openConfirmation,
      closeConfirmation,
    };
  }, [closeConfirmation, openConfirmation, request]);

  return (
    <AppConfirmationContext.Provider value={value}>
      {children}
    </AppConfirmationContext.Provider>
  );
};

export const useAppConfirmation = (): AppConfirmationContextValue => {
  const value = useContext(AppConfirmationContext);

  if (value === null) {
    throw new Error(
      'useAppConfirmation must be used within AppConfirmationProvider.',
    );
  }

  return value;
};
