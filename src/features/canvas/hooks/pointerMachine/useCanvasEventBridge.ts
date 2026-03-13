import type Konva from 'konva';
import {
  useCallback,
  useEffect,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import type {
  CanvasDoubleClickEvent,
  CanvasEventBridgeHandlers,
  CanvasPointerEvent,
  PointerMachineEventHandlers,
} from './types';

type UseCanvasEventBridgeParams = {
  stageRef: RefObject<Konva.Stage | null>;
  interactionSurfaceRef: RefObject<HTMLElement | null>;
  machineHandlers: PointerMachineEventHandlers;
};

const syncStagePointerPosition = (
  stageRef: RefObject<Konva.Stage | null>,
  event: PointerEvent | MouseEvent,
): void => {
  stageRef.current?.setPointersPositions(event);
};

const toCanvasPointerEvent = (event: PointerEvent): CanvasPointerEvent => ({
  evt: event,
});

const toCanvasDoubleClickEvent = (
  event: MouseEvent,
): CanvasDoubleClickEvent => ({
  evt: event,
});

export const useCanvasEventBridge = ({
  stageRef,
  interactionSurfaceRef,
  machineHandlers,
}: UseCanvasEventBridgeParams): CanvasEventBridgeHandlers => {
  const forwardPointerEvent = useCallback(
    (
      event: PointerEvent,
      handler: (event: CanvasPointerEvent) => void,
    ): void => {
      syncStagePointerPosition(stageRef, event);
      handler(toCanvasPointerEvent(event));
    },
    [stageRef],
  );

  const forwardDoubleClickEvent = useCallback(
    (event: MouseEvent): void => {
      syncStagePointerPosition(stageRef, event);
      machineHandlers.onDoubleClick(toCanvasDoubleClickEvent(event));
    },
    [machineHandlers, stageRef],
  );

  useEffect(() => {
    const host = interactionSurfaceRef.current;
    if (host === null) {
      return;
    }

    const handleDoubleClick = (event: MouseEvent): void => {
      forwardDoubleClickEvent(event);
    };

    host.addEventListener('dblclick', handleDoubleClick);

    return () => {
      host.removeEventListener('dblclick', handleDoubleClick);
    };
  }, [forwardDoubleClickEvent, interactionSurfaceRef]);

  const bindPointerHandler = useCallback(
    (handler: (event: CanvasPointerEvent) => void) => {
      return (event: ReactPointerEvent<HTMLDivElement>): void => {
        forwardPointerEvent(event.nativeEvent, handler);
      };
    },
    [forwardPointerEvent],
  );

  return {
    onPointerDown: bindPointerHandler(machineHandlers.onPointerDown),
    onPointerMove: bindPointerHandler(machineHandlers.onPointerMove),
    onPointerUp: bindPointerHandler(machineHandlers.onPointerUp),
    onPointerLeave: bindPointerHandler(machineHandlers.onPointerLeave),
    onPointerCancel: bindPointerHandler(machineHandlers.onPointerCancel),
    onLostPointerCapture: bindPointerHandler(
      machineHandlers.onLostPointerCapture,
    ),
  };
};
