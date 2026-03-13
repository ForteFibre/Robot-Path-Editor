import { useEffect, useRef, useState, type RefObject } from 'react';

export type CanvasViewportSize = {
  width: number;
  height: number;
};

const isPositiveFiniteNumber = (value: number | undefined): value is number => {
  return value !== undefined && Number.isFinite(value) && value > 0;
};

const resolveViewportDimension = (
  ...candidates: (number | undefined)[]
): number => {
  for (const candidate of candidates) {
    if (isPositiveFiniteNumber(candidate)) {
      return candidate;
    }
  }

  return 0;
};

export const resolveCanvasViewportSize = (
  host: HTMLElement,
): CanvasViewportSize => {
  const rect = host.getBoundingClientRect();
  const parentWidth = host.parentElement?.clientWidth;
  const parentHeight = host.parentElement?.clientHeight;
  const windowWidth =
    typeof globalThis.innerWidth === 'number' ? globalThis.innerWidth : 0;
  const windowHeight =
    typeof globalThis.innerHeight === 'number' ? globalThis.innerHeight : 0;

  return {
    width: resolveViewportDimension(
      host.clientWidth,
      rect.width,
      parentWidth,
      windowWidth,
    ),
    height: resolveViewportDimension(
      host.clientHeight,
      rect.height,
      parentHeight,
      windowHeight,
    ),
  };
};

export const useCanvasViewport = (): {
  canvasHostRef: RefObject<HTMLDivElement | null>;
  viewportSize: CanvasViewportSize;
} => {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState<CanvasViewportSize>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const host = canvasHostRef.current;
    if (host === null) {
      return;
    }

    const updateViewportSize = (): void => {
      setViewportSize(resolveCanvasViewportSize(host));
    };

    updateViewportSize();

    const handleWindowResize = (): void => {
      updateViewportSize();
    };

    globalThis.addEventListener('resize', handleWindowResize);

    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            updateViewportSize();
          });

    observer?.observe(host);

    return () => {
      observer?.disconnect();
      globalThis.removeEventListener('resize', handleWindowResize);
    };
  }, []);

  return {
    canvasHostRef,
    viewportSize,
  };
};
