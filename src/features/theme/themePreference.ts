import { resetCanvasThemeCache } from '../canvas/canvasTheme';
import { resetVelocityColorScaleCache } from '../canvas/components/pathVelocitySegments';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_PREFERENCE_STORAGE_KEY = 'app.themePreference';

const SYSTEM_DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';
const FALLBACK_THEME_PREFERENCE: ThemePreference = 'system';

type LegacyMediaQueryListCompatibility = {
  addListener?: (listener: () => void) => void;
  removeListener?: (listener: () => void) => void;
};

const isThemePreference = (value: string): value is ThemePreference => {
  return value === 'light' || value === 'dark' || value === 'system';
};

const getThemeStorage = (storage?: Storage | null): Storage | null => {
  if (storage !== undefined) {
    return storage;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const getMatchMedia = (): ((query: string) => MediaQueryList) | null => {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return null;
  }

  return window.matchMedia.bind(window);
};

const applyResolvedThemeToDocument = (
  resolvedTheme: ResolvedTheme,
): boolean => {
  if (typeof document === 'undefined') {
    return false;
  }

  const root = document.documentElement;
  const previousTheme = root.dataset.theme;

  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;

  return previousTheme !== resolvedTheme;
};

const invalidateCanvasColorCaches = (): void => {
  resetCanvasThemeCache();
  resetVelocityColorScaleCache();
};

export const readStoredThemePreference = (
  storage: Storage | null = getThemeStorage(),
): ThemePreference => {
  if (storage === null) {
    return FALLBACK_THEME_PREFERENCE;
  }

  const storedPreference = storage.getItem(THEME_PREFERENCE_STORAGE_KEY);
  if (storedPreference === null || !isThemePreference(storedPreference)) {
    return FALLBACK_THEME_PREFERENCE;
  }

  return storedPreference;
};

export const persistThemePreference = (
  preference: ThemePreference,
  storage: Storage | null = getThemeStorage(),
): void => {
  if (storage === null) {
    return;
  }

  storage.setItem(THEME_PREFERENCE_STORAGE_KEY, preference);
};

export const resolveSystemTheme = (
  matchMedia: ((query: string) => MediaQueryList) | null = getMatchMedia(),
): ResolvedTheme => {
  if (matchMedia === null) {
    return 'light';
  }

  return matchMedia(SYSTEM_DARK_MEDIA_QUERY).matches ? 'dark' : 'light';
};

export const resolveTheme = (
  preference: ThemePreference,
  systemTheme: ResolvedTheme,
): ResolvedTheme => {
  return preference === 'system' ? systemTheme : preference;
};

export const applyThemePreference = (
  preference: ThemePreference,
): ResolvedTheme => {
  const resolvedTheme = resolveTheme(preference, resolveSystemTheme());
  const hasThemeChanged = applyResolvedThemeToDocument(resolvedTheme);

  if (hasThemeChanged) {
    invalidateCanvasColorCaches();
  }

  return resolvedTheme;
};

export const initializeThemePreference = (): ThemePreference => {
  const preference = readStoredThemePreference();
  applyThemePreference(preference);
  return preference;
};

export const listenToSystemTheme = (listener: () => void): (() => void) => {
  const matchMedia = getMatchMedia();
  if (matchMedia === null) {
    return () => undefined;
  }

  const mediaQueryList = matchMedia(SYSTEM_DARK_MEDIA_QUERY);
  const legacyMediaQueryList =
    mediaQueryList as unknown as LegacyMediaQueryListCompatibility;
  const handleChange = (): void => {
    listener();
  };

  if (typeof mediaQueryList.addEventListener === 'function') {
    mediaQueryList.addEventListener('change', handleChange);

    return () => {
      mediaQueryList.removeEventListener('change', handleChange);
    };
  }

  if (
    typeof legacyMediaQueryList.addListener === 'function' &&
    typeof legacyMediaQueryList.removeListener === 'function'
  ) {
    const addLegacyListener = legacyMediaQueryList.addListener;
    const removeLegacyListener = legacyMediaQueryList.removeListener;
    addLegacyListener(handleChange);

    return () => {
      removeLegacyListener(handleChange);
    };
  }

  return () => undefined;
};
