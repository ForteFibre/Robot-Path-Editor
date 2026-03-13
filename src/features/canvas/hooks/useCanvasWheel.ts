import { useEffect, type RefObject } from 'react';
import { useCanvasEditActions } from './useCanvasEditActions';

export const useCanvasWheel = (
  surfaceRef: RefObject<HTMLElement | null>,
): void => {
  const { zoomCanvas } = useCanvasEditActions();

  useEffect(() => {
    const surface = surfaceRef.current;
    if (surface === null) {
      return;
    }

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

      zoomCanvas(centerX, centerY, event.deltaY);
    };

    surface.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      surface.removeEventListener('wheel', onWheel);
    };
  }, [surfaceRef, zoomCanvas]);
};
