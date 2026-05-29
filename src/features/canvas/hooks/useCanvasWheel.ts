import { useEffect, useRef, type RefObject } from 'react';
import { useCanvasEditActions } from './useCanvasEditActions';

export const useCanvasWheel = (
  surfaceRef: RefObject<HTMLElement | null>,
): void => {
  const { zoomCanvas } = useCanvasEditActions();
  const pendingWheelRef = useRef<{
    centerX: number;
    centerY: number;
    delta: number;
  } | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (surface === null) {
      return;
    }

    const flushPendingWheel = (): void => {
      frameRef.current = null;
      const pendingWheel = pendingWheelRef.current;
      pendingWheelRef.current = null;

      if (pendingWheel === null) {
        return;
      }

      zoomCanvas(
        pendingWheel.centerX,
        pendingWheel.centerY,
        pendingWheel.delta,
      );
    };

    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();

      // In the new tool model:
      // Scroll (Y axis) = Zoom
      // Drag = Pan (handled by pointer machine)

      // Use deltaY for zoom. Positive deltaY (scroll down/backward) means zoom out.
      // Negative deltaY (scroll up/forward) means zoom in.
      // store uses: oldK * (1 - delta * 0.001)
      // So passing positive deltaY gives `1 - positive` which reduces scale (zoom out).

      const rect = surface.getBoundingClientRect();
      const centerX = event.clientX - rect.left;
      const centerY = event.clientY - rect.top;

      const pendingWheel = pendingWheelRef.current;
      pendingWheelRef.current =
        pendingWheel === null
          ? {
              centerX,
              centerY,
              delta: event.deltaY,
            }
          : {
              centerX,
              centerY,
              delta: pendingWheel.delta + event.deltaY,
            };

      if (frameRef.current !== null) {
        return;
      }

      frameRef.current = globalThis.requestAnimationFrame(flushPendingWheel);
    };

    surface.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      if (frameRef.current !== null) {
        globalThis.cancelAnimationFrame(frameRef.current);
      }

      frameRef.current = null;
      pendingWheelRef.current = null;
      surface.removeEventListener('wheel', onWheel);
    };
  }, [surfaceRef, zoomCanvas]);
};
