import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';

export const SIDEBAR_PATHS_MIN_HEIGHT = 120;
export const SIDEBAR_PATHS_MAX_HEIGHT = 520;

const SIDEBAR_PATHS_DEFAULT_HEIGHT = 220;
const SIDEBAR_PATHS_HEIGHT_STORAGE_KEY = 'path-editor.sidebar-paths-height';
const SIDEBAR_PATHS_KEYBOARD_STEP = 16;

const clampPathsHeight = (height: number): number => {
  return Math.min(
    Math.max(height, SIDEBAR_PATHS_MIN_HEIGHT),
    SIDEBAR_PATHS_MAX_HEIGHT,
  );
};

const readStoredPathsHeight = (): number => {
  try {
    const storedHeight = globalThis.localStorage.getItem(
      SIDEBAR_PATHS_HEIGHT_STORAGE_KEY,
    );
    if (storedHeight === null) {
      return SIDEBAR_PATHS_DEFAULT_HEIGHT;
    }

    const parsedHeight = Number.parseInt(storedHeight, 10);
    return Number.isFinite(parsedHeight)
      ? clampPathsHeight(parsedHeight)
      : SIDEBAR_PATHS_DEFAULT_HEIGHT;
  } catch {
    return SIDEBAR_PATHS_DEFAULT_HEIGHT;
  }
};

export type ResizableSidebarSectionsState = {
  pathsHeight: number;
  minPathsHeight: number;
  maxPathsHeight: number;
  isResizing: boolean;
  onResizeStart: (event: PointerEvent<HTMLElement>) => void;
  onResizeKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
};

export const useResizableSidebarSections =
  (): ResizableSidebarSectionsState => {
    const [pathsHeight, setPathsHeight] = useState(readStoredPathsHeight);
    const [isResizing, setIsResizing] = useState(false);
    const dragStartClientYRef = useRef(0);
    const dragStartHeightRef = useRef(pathsHeight);

    useEffect(() => {
      try {
        globalThis.localStorage.setItem(
          SIDEBAR_PATHS_HEIGHT_STORAGE_KEY,
          String(pathsHeight),
        );
      } catch {
        // Ignore storage failures; resizing should still work for this session.
      }
    }, [pathsHeight]);

    useEffect(() => {
      if (!isResizing) {
        return undefined;
      }

      const handlePointerMove = (event: globalThis.PointerEvent): void => {
        const nextHeight =
          dragStartHeightRef.current +
          event.clientY -
          dragStartClientYRef.current;
        setPathsHeight(clampPathsHeight(nextHeight));
      };

      const handlePointerUp = (): void => {
        setIsResizing(false);
      };

      globalThis.addEventListener('pointermove', handlePointerMove);
      globalThis.addEventListener('pointerup', handlePointerUp, { once: true });

      return () => {
        globalThis.removeEventListener('pointermove', handlePointerMove);
        globalThis.removeEventListener('pointerup', handlePointerUp);
      };
    }, [isResizing]);

    const updatePathsHeight = useCallback((nextHeight: number): void => {
      setPathsHeight(clampPathsHeight(nextHeight));
    }, []);

    const onResizeStart = useCallback(
      (event: PointerEvent<HTMLElement>): void => {
        if (event.button !== 0) {
          return;
        }

        event.preventDefault();
        dragStartClientYRef.current = event.clientY;
        dragStartHeightRef.current = pathsHeight;
        setIsResizing(true);
      },
      [pathsHeight],
    );

    const onResizeKeyDown = useCallback(
      (event: KeyboardEvent<HTMLElement>): void => {
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          updatePathsHeight(pathsHeight - SIDEBAR_PATHS_KEYBOARD_STEP);
          return;
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          updatePathsHeight(pathsHeight + SIDEBAR_PATHS_KEYBOARD_STEP);
          return;
        }

        if (event.key === 'Home') {
          event.preventDefault();
          updatePathsHeight(SIDEBAR_PATHS_MIN_HEIGHT);
          return;
        }

        if (event.key === 'End') {
          event.preventDefault();
          updatePathsHeight(SIDEBAR_PATHS_MAX_HEIGHT);
        }
      },
      [pathsHeight, updatePathsHeight],
    );

    return {
      pathsHeight,
      minPathsHeight: SIDEBAR_PATHS_MIN_HEIGHT,
      maxPathsHeight: SIDEBAR_PATHS_MAX_HEIGHT,
      isResizing,
      onResizeStart,
      onResizeKeyDown,
    };
  };
