import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getVelocityColor,
  resetVelocityColorScaleCache,
} from '../../features/canvas/components/pathVelocitySegments';
import {
  applyThemePreference,
  initializeThemePreference,
  listenToSystemTheme,
  readStoredThemePreference,
  resolveTheme,
  THEME_PREFERENCE_STORAGE_KEY,
} from '../../features/theme/themePreference';

type MatchMediaChangeListener = (event: MediaQueryListEvent) => void;
type LegacyMatchMediaListener = () => void;

const SYSTEM_DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

const createModernMatchMediaController = (initialMatches = false) => {
  let matches = initialMatches;
  const listeners = new Set<MatchMediaChangeListener>();

  const addEventListener = vi.fn(
    (_eventName: 'change', listener: MatchMediaChangeListener) => {
      listeners.add(listener);
    },
  );
  const removeEventListener = vi.fn(
    (_eventName: 'change', listener: MatchMediaChangeListener) => {
      listeners.delete(listener);
    },
  );
  const addListener = vi.fn();
  const removeListener = vi.fn();

  const mediaQueryList = {
    media: SYSTEM_DARK_MEDIA_QUERY,
    get matches() {
      return matches;
    },
    onchange: null,
    addEventListener,
    removeEventListener,
    addListener,
    removeListener,
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;

  const matchMedia = vi.fn(() => mediaQueryList);

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: matchMedia,
  });

  return {
    matchMedia,
    mediaQueryList,
    addEventListener,
    removeEventListener,
    setMatches(nextMatches: boolean): void {
      matches = nextMatches;
      const event = {
        matches: nextMatches,
        media: SYSTEM_DARK_MEDIA_QUERY,
      } as MediaQueryListEvent;

      for (const listener of listeners) {
        listener(event);
      }
    },
  };
};

const createLegacyMatchMediaController = (initialMatches = false) => {
  let matches = initialMatches;
  const listeners = new Set<LegacyMatchMediaListener>();

  const addListener = vi.fn((listener: LegacyMatchMediaListener) => {
    listeners.add(listener);
  });
  const removeListener = vi.fn((listener: LegacyMatchMediaListener) => {
    listeners.delete(listener);
  });

  const mediaQueryList = {
    media: SYSTEM_DARK_MEDIA_QUERY,
    get matches() {
      return matches;
    },
    onchange: null,
    addListener,
    removeListener,
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;

  Object.defineProperty(mediaQueryList, 'addEventListener', {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(mediaQueryList, 'removeEventListener', {
    configurable: true,
    value: undefined,
  });

  const matchMedia = vi.fn(() => mediaQueryList);

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: matchMedia,
  });

  return {
    matchMedia,
    addListener,
    removeListener,
    setMatches(nextMatches: boolean): void {
      matches = nextMatches;
      for (const listener of listeners) {
        listener();
      }
    },
  };
};

describe('themePreference', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
    document.documentElement.style.colorScheme = '';
    resetVelocityColorScaleCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: undefined,
    });
  });

  it('falls back to system preference when stored value is missing or invalid', () => {
    expect(readStoredThemePreference()).toBe('system');

    window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'sepia');
    expect(readStoredThemePreference()).toBe('system');

    window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'dark');
    expect(readStoredThemePreference()).toBe('dark');
  });

  it('resolves system preference to the current system theme', () => {
    expect(resolveTheme('light', 'dark')).toBe('light');
    expect(resolveTheme('dark', 'light')).toBe('dark');
    expect(resolveTheme('system', 'dark')).toBe('dark');
    expect(resolveTheme('system', 'light')).toBe('light');
  });

  it('applies the initial theme from stored preference before mount', () => {
    window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'system');
    const { matchMedia } = createModernMatchMediaController(true);

    const preference = initializeThemePreference();

    expect(preference).toBe('system');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(matchMedia).toHaveBeenCalledWith(SYSTEM_DARK_MEDIA_QUERY);
  });

  it('invalidates canvas and velocity color caches when theme changes', () => {
    createModernMatchMediaController(false);

    document.documentElement.style.setProperty(
      '--color-canvas-velocity-low',
      '#111111',
    );
    document.documentElement.style.setProperty(
      '--color-canvas-velocity-high',
      '#22aa22',
    );

    applyThemePreference('light');
    expect(getVelocityColor(0)).toBe('#111111');

    document.documentElement.style.setProperty(
      '--color-canvas-velocity-low',
      '#222222',
    );
    applyThemePreference('dark');

    expect(getVelocityColor(0)).toBe('#222222');
  });

  it('tracks system theme changes while system preference is active', () => {
    window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'system');
    const controller = createModernMatchMediaController(false);

    initializeThemePreference();
    expect(document.documentElement.dataset.theme).toBe('light');

    const cleanup = listenToSystemTheme(() => {
      applyThemePreference('system');
    });

    controller.setMatches(true);

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');

    cleanup();
  });

  it('cleans up modern matchMedia listeners', () => {
    const controller = createModernMatchMediaController(false);
    const listener = vi.fn();

    const cleanup = listenToSystemTheme(listener);
    const registeredListener = controller.addEventListener.mock.calls[0]?.[1];

    expect(controller.addEventListener).toHaveBeenCalledTimes(1);

    controller.setMatches(true);
    expect(listener).toHaveBeenCalledTimes(1);

    cleanup();

    expect(controller.removeEventListener).toHaveBeenCalledTimes(1);
    expect(controller.removeEventListener).toHaveBeenCalledWith(
      'change',
      registeredListener,
    );

    controller.setMatches(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('falls back to addListener/removeListener for Safari-compatible system listeners', () => {
    const controller = createLegacyMatchMediaController(false);
    const listener = vi.fn();

    const cleanup = listenToSystemTheme(listener);
    const registeredListener = controller.addListener.mock.calls[0]?.[0];

    expect(controller.addListener).toHaveBeenCalledTimes(1);

    controller.setMatches(true);
    expect(listener).toHaveBeenCalledTimes(1);

    cleanup();

    expect(controller.removeListener).toHaveBeenCalledTimes(1);
    expect(controller.removeListener).toHaveBeenCalledWith(registeredListener);

    controller.setMatches(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
