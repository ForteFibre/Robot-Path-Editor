import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  applyThemePreference,
  listenToSystemTheme,
  persistThemePreference,
  readStoredThemePreference,
  resolveTheme,
  resolveSystemTheme,
  type ResolvedTheme,
  type ThemePreference,
} from './themePreference';

type ThemePreferenceContextValue = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};

const ThemePreferenceContext =
  createContext<ThemePreferenceContextValue | null>(null);

type ThemePreferenceProviderProps = {
  children: ReactNode;
};

export const ThemePreferenceProvider = ({
  children,
}: ThemePreferenceProviderProps): ReactElement => {
  const [preference, setPreference] = useState<ThemePreference>(() =>
    readStoredThemePreference(),
  );
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(preference, resolveSystemTheme()),
  );

  useEffect(() => {
    persistThemePreference(preference);
    setResolvedTheme(applyThemePreference(preference));
  }, [preference]);

  useEffect(() => {
    if (preference !== 'system') {
      return;
    }

    return listenToSystemTheme(() => {
      setResolvedTheme(applyThemePreference('system'));
    });
  }, [preference]);

  const contextValue = useMemo<ThemePreferenceContextValue>(() => {
    return {
      preference,
      resolvedTheme,
      setPreference,
    };
  }, [preference, resolvedTheme]);

  return (
    <ThemePreferenceContext.Provider value={contextValue}>
      {children}
    </ThemePreferenceContext.Provider>
  );
};

export const useThemePreference = (): ThemePreferenceContextValue => {
  const contextValue = useContext(ThemePreferenceContext);

  if (contextValue === null) {
    throw new Error(
      'useThemePreference must be used within ThemePreferenceProvider.',
    );
  }

  return contextValue;
};
