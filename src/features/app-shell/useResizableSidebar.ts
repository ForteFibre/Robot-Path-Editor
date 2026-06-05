import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';

export const LEFT_SIDEBAR_MIN_WIDTH = 240;
export const LEFT_SIDEBAR_MAX_WIDTH = 520;

const LEFT_SIDEBAR_DEFAULT_WIDE_WIDTH = 320;
const LEFT_SIDEBAR_DEFAULT_NARROW_WIDTH = 280;
const LEFT_SIDEBAR_WIDTH_STORAGE_KEY = 'path-editor.left-sidebar-width';
const LEFT_SIDEBAR_KEYBOARD_STEP = 16;
const NARROW_VIEWPORT_BREAKPOINT = 1400;

const clampSidebarWidth = (width: number): number => {
  return Math.min(
    Math.max(width, LEFT_SIDEBAR_MIN_WIDTH),
    LEFT_SIDEBAR_MAX_WIDTH,
  );
};

const resolveDefaultSidebarWidth = (): number => {
  return globalThis.innerWidth <= NARROW_VIEWPORT_BREAKPOINT
    ? LEFT_SIDEBAR_DEFAULT_NARROW_WIDTH
    : LEFT_SIDEBAR_DEFAULT_WIDE_WIDTH;
};

const readStoredSidebarWidth = (): number => {
  try {
    const storedWidth = globalThis.localStorage.getItem(
      LEFT_SIDEBAR_WIDTH_STORAGE_KEY,
    );
    if (storedWidth === null) {
      return resolveDefaultSidebarWidth();
    }

    const parsedWidth = Number.parseInt(storedWidth, 10);
    return Number.isFinite(parsedWidth)
      ? clampSidebarWidth(parsedWidth)
      : resolveDefaultSidebarWidth();
  } catch {
    return resolveDefaultSidebarWidth();
  }
};

export type ResizableSidebarState = {
  width: number;
  minWidth: number;
  maxWidth: number;
  isResizing: boolean;
  onResizeStart: (event: PointerEvent<HTMLElement>) => void;
  onResizeKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
};

export const useResizableSidebar = (): ResizableSidebarState => {
  const [width, setWidth] = useState(readStoredSidebarWidth);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartClientXRef = useRef(0);
  const dragStartWidthRef = useRef(width);

  useEffect(() => {
    try {
      globalThis.localStorage.setItem(
        LEFT_SIDEBAR_WIDTH_STORAGE_KEY,
        String(width),
      );
    } catch {
      // Ignore storage failures; resizing should still work for this session.
    }
  }, [width]);

  useEffect(() => {
    if (!isResizing) {
      return undefined;
    }

    const handlePointerMove = (event: globalThis.PointerEvent): void => {
      const nextWidth =
        dragStartWidthRef.current + event.clientX - dragStartClientXRef.current;
      setWidth(clampSidebarWidth(nextWidth));
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

  const updateWidth = useCallback((nextWidth: number): void => {
    setWidth(clampSidebarWidth(nextWidth));
  }, []);

  const onResizeStart = useCallback(
    (event: PointerEvent<HTMLElement>): void => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      dragStartClientXRef.current = event.clientX;
      dragStartWidthRef.current = width;
      setIsResizing(true);
    },
    [width],
  );

  const onResizeKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>): void => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        updateWidth(width - LEFT_SIDEBAR_KEYBOARD_STEP);
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        updateWidth(width + LEFT_SIDEBAR_KEYBOARD_STEP);
        return;
      }

      if (event.key === 'Home') {
        event.preventDefault();
        updateWidth(LEFT_SIDEBAR_MIN_WIDTH);
        return;
      }

      if (event.key === 'End') {
        event.preventDefault();
        updateWidth(LEFT_SIDEBAR_MAX_WIDTH);
      }
    },
    [updateWidth, width],
  );

  return {
    width,
    minWidth: LEFT_SIDEBAR_MIN_WIDTH,
    maxWidth: LEFT_SIDEBAR_MAX_WIDTH,
    isResizing,
    onResizeStart,
    onResizeKeyDown,
  };
};
