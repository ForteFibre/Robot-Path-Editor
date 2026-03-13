import { act, render, screen, waitFor } from '@testing-library/react';
import { createElement, useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  resolveCanvasViewportSize,
  useCanvasViewport,
  type CanvasViewportSize,
} from '../../features/canvas/hooks/useCanvasViewport';

const originalResizeObserver = globalThis.ResizeObserver;
const originalInnerWidth = globalThis.innerWidth;
const originalInnerHeight = globalThis.innerHeight;

const setElementDimensions = (
  element: HTMLElement,
  dimensions: {
    clientWidth: number;
    clientHeight: number;
    rectWidth?: number;
    rectHeight?: number;
  },
): void => {
  const {
    clientWidth,
    clientHeight,
    rectWidth = clientWidth,
    rectHeight = clientHeight,
  } = dimensions;

  Object.defineProperty(element, 'clientWidth', {
    configurable: true,
    get: () => clientWidth,
  });
  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    get: () => clientHeight,
  });
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    width: rectWidth,
    height: rectHeight,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: rectHeight,
    right: rectWidth,
    toJSON: () => ({}),
  } as DOMRect);
};

const ViewportProbe = ({
  onViewportSize,
}: {
  onViewportSize: (viewportSize: CanvasViewportSize) => void;
}) => {
  const { canvasHostRef, viewportSize } = useCanvasViewport();

  useEffect(() => {
    onViewportSize(viewportSize);
  }, [onViewportSize, viewportSize]);

  return createElement(
    'div',
    { 'data-testid': 'parent' },
    createElement('div', { ref: canvasHostRef, 'data-testid': 'host' }),
  );
};

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.ResizeObserver = originalResizeObserver;
  Object.defineProperty(globalThis, 'innerWidth', {
    configurable: true,
    value: originalInnerWidth,
  });
  Object.defineProperty(globalThis, 'innerHeight', {
    configurable: true,
    value: originalInnerHeight,
  });
});

describe('useCanvasViewport', () => {
  it('updates viewport size from the host element via ResizeObserver', async () => {
    let resizeCallback:
      | ((entries: ResizeObserverEntry[], observer: ResizeObserver) => void)
      | undefined;

    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe(): void {
        return undefined;
      }

      disconnect(): void {
        return undefined;
      }
    }

    globalThis.ResizeObserver =
      ResizeObserverMock as unknown as typeof ResizeObserver;

    let latestViewportSize: CanvasViewportSize = { width: 0, height: 0 };

    render(
      createElement(ViewportProbe, {
        onViewportSize: (viewportSize) => {
          latestViewportSize = viewportSize;
        },
      }),
    );

    const host = screen.getByTestId('host');
    setElementDimensions(host, {
      clientWidth: 320,
      clientHeight: 180,
    });

    act(() => {
      if (resizeCallback !== undefined) {
        resizeCallback([], {} as ResizeObserver);
      }
    });

    await waitFor(() => {
      expect(latestViewportSize).toEqual({ width: 320, height: 180 });
    });
  });

  it('falls back to window dimensions when host and parent sizes are unavailable', () => {
    Object.defineProperty(globalThis, 'innerWidth', {
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(globalThis, 'innerHeight', {
      configurable: true,
      value: 768,
    });

    const parent = document.createElement('div');
    const host = document.createElement('div');
    parent.appendChild(host);

    setElementDimensions(parent, {
      clientWidth: 0,
      clientHeight: 0,
      rectWidth: 0,
      rectHeight: 0,
    });
    setElementDimensions(host, {
      clientWidth: 0,
      clientHeight: 0,
      rectWidth: 0,
      rectHeight: 0,
    });

    expect(resolveCanvasViewportSize(host)).toEqual({
      width: 1024,
      height: 768,
    });
  });
});
