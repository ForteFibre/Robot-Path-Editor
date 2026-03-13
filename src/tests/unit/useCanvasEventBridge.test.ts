import { fireEvent, render, screen } from '@testing-library/react';
import type Konva from 'konva';
import { createElement, createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCanvasEventBridge } from '../../features/canvas/hooks/pointerMachine/useCanvasEventBridge';
import type { PointerMachineEventHandlers } from '../../features/canvas/hooks/pointerMachine/types';

type MockedPointerMachineHandlers = PointerMachineEventHandlers & {
  onPointerDown: ReturnType<typeof vi.fn>;
  onDoubleClick: ReturnType<typeof vi.fn>;
  onPointerMove: ReturnType<typeof vi.fn>;
  onPointerUp: ReturnType<typeof vi.fn>;
  onPointerLeave: ReturnType<typeof vi.fn>;
  onPointerCancel: ReturnType<typeof vi.fn>;
  onLostPointerCapture: ReturnType<typeof vi.fn>;
};

type EventBridgeProbeProps = {
  stageRef: { current: Konva.Stage | null };
  interactionSurfaceRef: ReturnType<typeof createRef<HTMLDivElement>>;
  machineHandlers: PointerMachineEventHandlers;
};

const createMachineHandlers = (): MockedPointerMachineHandlers => {
  return {
    onPointerDown: vi.fn<PointerMachineEventHandlers['onPointerDown']>(),
    onDoubleClick: vi.fn<PointerMachineEventHandlers['onDoubleClick']>(),
    onPointerMove: vi.fn<PointerMachineEventHandlers['onPointerMove']>(),
    onPointerUp: vi.fn<PointerMachineEventHandlers['onPointerUp']>(),
    onPointerLeave: vi.fn<PointerMachineEventHandlers['onPointerLeave']>(),
    onPointerCancel: vi.fn<PointerMachineEventHandlers['onPointerCancel']>(),
    onLostPointerCapture:
      vi.fn<PointerMachineEventHandlers['onLostPointerCapture']>(),
  };
};

const createStageRef = () => {
  const setPointersPositions = vi.fn();

  return {
    stageRef: {
      current: {
        setPointersPositions,
      } as unknown as Konva.Stage,
    },
    setPointersPositions,
  };
};

const EventBridgeProbe = ({
  stageRef,
  interactionSurfaceRef,
  machineHandlers,
}: EventBridgeProbeProps) => {
  const handlers = useCanvasEventBridge({
    stageRef,
    interactionSurfaceRef,
    machineHandlers,
  });

  return createElement('div', {
    'data-testid': 'surface',
    ref: interactionSurfaceRef,
    ...handlers,
  });
};

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('useCanvasEventBridge', () => {
  it('registers and removes the dblclick listener while forwarding the native event', () => {
    const addEventListenerSpy = vi.spyOn(
      HTMLElement.prototype,
      'addEventListener',
    );
    const removeEventListenerSpy = vi.spyOn(
      HTMLElement.prototype,
      'removeEventListener',
    );
    const { stageRef, setPointersPositions } = createStageRef();
    const interactionSurfaceRef = createRef<HTMLDivElement>();
    const machineHandlers = createMachineHandlers();

    const { unmount } = render(
      createElement(EventBridgeProbe, {
        stageRef,
        interactionSurfaceRef,
        machineHandlers,
      }),
    );

    const host = screen.getByTestId('surface');
    const firstDoubleClick = new MouseEvent('dblclick', { bubbles: true });
    const registeredDoubleClickHandlers = addEventListenerSpy.mock.calls
      .filter(([type]) => type === 'dblclick')
      .map(([, handler]) => handler);

    expect(registeredDoubleClickHandlers.length).toBeGreaterThan(0);

    fireEvent(host, firstDoubleClick);

    expect(setPointersPositions).toHaveBeenCalledWith(firstDoubleClick);
    expect(machineHandlers.onDoubleClick).toHaveBeenCalledWith({
      evt: firstDoubleClick,
    });
    unmount();

    const removedDoubleClickHandler = removeEventListenerSpy.mock.calls.find(
      ([type]) => type === 'dblclick',
    )?.[1];

    expect(removedDoubleClickHandler).toBeDefined();
    expect(registeredDoubleClickHandlers).toContain(removedDoubleClickHandler);

    fireEvent(host, new MouseEvent('dblclick', { bubbles: true }));

    expect(machineHandlers.onDoubleClick).toHaveBeenCalledTimes(1);
  });

  it('bridges React pointer events to machine handlers after syncing stage pointers', () => {
    const { stageRef, setPointersPositions } = createStageRef();
    const interactionSurfaceRef = createRef<HTMLDivElement>();
    const machineHandlers = createMachineHandlers();

    render(
      createElement(EventBridgeProbe, {
        stageRef,
        interactionSurfaceRef,
        machineHandlers,
      }),
    );

    const host = screen.getByTestId('surface');

    fireEvent.pointerDown(host, { button: 0, pointerId: 7 });
    fireEvent.pointerMove(host, { pointerId: 7 });
    fireEvent.pointerUp(host, { pointerId: 7 });

    expect(setPointersPositions).toHaveBeenCalledTimes(3);
    expect(machineHandlers.onPointerDown).toHaveBeenCalledTimes(1);
    expect(machineHandlers.onPointerMove).toHaveBeenCalledTimes(1);
    expect(machineHandlers.onPointerUp).toHaveBeenCalledTimes(1);

    const forwardedPointerDownEvent = (
      machineHandlers.onPointerDown.mock.calls[0]?.[0] as
        | { evt: Event }
        | undefined
    )?.evt;
    const forwardedPointerMoveEvent = (
      machineHandlers.onPointerMove.mock.calls[0]?.[0] as
        | { evt: Event }
        | undefined
    )?.evt;
    const forwardedPointerUpEvent = (
      machineHandlers.onPointerUp.mock.calls[0]?.[0] as
        | { evt: Event }
        | undefined
    )?.evt;

    expect(forwardedPointerDownEvent).toBeInstanceOf(Event);
    expect(forwardedPointerMoveEvent).toBeInstanceOf(Event);
    expect(forwardedPointerUpEvent).toBeInstanceOf(Event);
    expect(setPointersPositions).toHaveBeenNthCalledWith(
      1,
      forwardedPointerDownEvent,
    );
    expect(setPointersPositions).toHaveBeenNthCalledWith(
      2,
      forwardedPointerMoveEvent,
    );
    expect(setPointersPositions).toHaveBeenNthCalledWith(
      3,
      forwardedPointerUpEvent,
    );
  });
});
