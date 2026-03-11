import { renderHook } from '@testing-library/react';
import type Konva from 'konva';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_SNAP_GUIDE } from '../../domain/geometry';
import {
  DEFAULT_ROBOT_MOTION_SETTINGS,
  type Workspace,
} from '../../domain/models';
import { DEFAULT_SNAP_SETTINGS } from '../../domain/snapping';
import type * as PointerMachineHelpersModule from '../../features/canvas/hooks/pointerMachine/helpers';
import { useRMinInteraction } from '../../features/canvas/hooks/pointerMachine/useRMinInteraction';
import type { RMinDragTarget } from '../../features/canvas/components/CanvasRMinDrag';
import type {
  CanvasPointerEvent,
  DraggingRMinState,
  PointerMachineRefs,
} from '../../features/canvas/hooks/pointerMachine/types';

const {
  actions,
  mockUseWorkspaceActions,
  mockGetPointerWorldFromStage,
  mockResolveContinuousDragStateOnMove,
} = vi.hoisted(() => {
  return {
    actions: {
      setSectionRMin: vi.fn(),
      setSelection: vi.fn(),
    },
    mockUseWorkspaceActions: vi.fn(),
    mockGetPointerWorldFromStage: vi.fn(),
    mockResolveContinuousDragStateOnMove: vi.fn(),
  };
});

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceActions: mockUseWorkspaceActions,
}));

vi.mock('../../features/canvas/hooks/canvasHitTesting', () => ({
  getPointerWorldFromStage: mockGetPointerWorldFromStage,
}));

vi.mock('../../features/canvas/hooks/pointerMachine/helpers', async () => {
  const actual = await vi.importActual<typeof PointerMachineHelpersModule>(
    '../../features/canvas/hooks/pointerMachine/helpers',
  );

  return {
    ...actual,
    resolveContinuousDragStateOnMove: mockResolveContinuousDragStateOnMove,
  };
});

const createWorkspace = (overrides: Partial<Workspace> = {}): Workspace => {
  return {
    mode: 'path',
    tool: 'select',
    paths: [],
    points: [],
    lockedPointIds: [],
    activePathId: 'path-1',
    canvasTransform: { x: 200, y: 100, k: 20 },
    selection: {
      pathId: 'path-1',
      waypointId: null,
      headingKeyframeId: null,
      sectionIndex: null,
    },
    isDragging: false,
    snapSettings: DEFAULT_SNAP_SETTINGS,
    snapPanelOpen: true,
    backgroundImage: null,
    robotPreviewEnabled: true,
    robotSettings: DEFAULT_ROBOT_MOTION_SETTINGS,
    ...overrides,
  };
};

const createEvent = (
  overrides: Partial<PointerEvent> = {},
): CanvasPointerEvent => {
  return {
    evt: {
      clientX: 240,
      clientY: 170,
      pointerId: 1,
      shiftKey: false,
      altKey: false,
      preventDefault: vi.fn(),
      ...overrides,
    },
  } as unknown as CanvasPointerEvent;
};

const createTarget = (): RMinDragTarget => {
  return {
    pathId: 'path-1',
    sectionIndex: 0,
    center: { x: 4, y: 4 },
    waypointPoint: { x: 1, y: 1 },
    rMin: 5,
    isAuto: false,
  };
};

const createRefs = (target: RMinDragTarget): PointerMachineRefs => {
  return {
    waypointPointsRef: { current: [] },
    resolvedPathsRef: { current: [] },
    discretizedByPathRef: { current: new Map() },
    snapSettingsRef: { current: DEFAULT_SNAP_SETTINGS },
    rMinTargetsRef: { current: [target] },
  };
};

const createDragState = (target: RMinDragTarget): DraggingRMinState => {
  return {
    kind: 'dragging-rmin',
    target,
    startScreenX: 240,
    startScreenY: 170,
    startDistance: 5,
    initialRMin: target.rMin,
    hasMoved: true,
  };
};

describe('useRMinInteraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseWorkspaceActions.mockReturnValue(actions);
    mockGetPointerWorldFromStage.mockReturnValue({ x: 5, y: 5 });
    mockResolveContinuousDragStateOnMove.mockImplementation(
      ({ state }: { state: { hasMoved: boolean } }) => ({
        ...state,
        hasMoved: true,
      }),
    );
  });

  it('starts rMin drags only in path mode and records the drag baseline', () => {
    const target = createTarget();
    const refs = createRefs(target);
    const setMachineState = vi.fn();
    const setSnapGuide = vi.fn();
    const captureStagePointer = vi.fn();
    const stage = {} as Konva.Stage;
    const event = createEvent();

    const { result } = renderHook(() =>
      useRMinInteraction({
        refs,
        setMachineState,
        setSnapGuide,
        captureStagePointer,
      }),
    );

    expect(
      result.current.beginRMinInteraction(
        event,
        stage,
        createWorkspace({ mode: 'heading' }),
        {
          kind: 'rmin-handle',
          pathId: 'path-1',
          sectionIndex: 0,
          center: { x: 4, y: 4 },
        },
      ),
    ).toBe(false);

    const handled = result.current.beginRMinInteraction(
      event,
      stage,
      createWorkspace(),
      {
        kind: 'rmin-handle',
        pathId: 'path-1',
        sectionIndex: 0,
        center: { x: 4, y: 4 },
      },
    );

    expect(handled).toBe(true);
    expect(setMachineState).toHaveBeenCalledWith({
      kind: 'dragging-rmin',
      target,
      startScreenX: 240,
      startScreenY: 170,
      startDistance: Math.hypot(5 - 1, 5 - 1),
      initialRMin: 5,
      hasMoved: false,
    });
    expect(captureStagePointer).toHaveBeenCalledWith(stage, event);
  });

  it('updates and finalizes rMin values for moved drags', () => {
    const target = createTarget();
    const refs = createRefs(target);
    const setMachineState = vi.fn();
    const setSnapGuide = vi.fn();
    const captureStagePointer = vi.fn();
    const stage = {} as Konva.Stage;
    const event = createEvent({ clientX: 280, clientY: 210 });
    const state = createDragState(target);

    mockGetPointerWorldFromStage.mockReturnValue({ x: 7, y: 9 });

    const { result } = renderHook(() =>
      useRMinInteraction({
        refs,
        setMachineState,
        setSnapGuide,
        captureStagePointer,
      }),
    );

    expect(result.current.resolveRMinMoveState(state, event)).toEqual({
      ...state,
      hasMoved: true,
    });
    expect(mockResolveContinuousDragStateOnMove).toHaveBeenCalled();

    result.current.handlePointerMove(state, stage, createWorkspace());

    const expectedRMin = Math.max(
      1,
      target.rMin + (Math.hypot(7 - 1, 9 - 1) - state.startDistance),
    );

    expect(actions.setSectionRMin).toHaveBeenCalledWith(
      'path-1',
      0,
      expectedRMin,
    );

    result.current.finalizeMovedInteraction(state, stage, createWorkspace());

    expect(actions.setSectionRMin).toHaveBeenLastCalledWith(
      'path-1',
      0,
      expectedRMin,
    );
    expect(setSnapGuide).toHaveBeenCalledWith(EMPTY_SNAP_GUIDE);
  });

  it('resets rMin handles back to auto', () => {
    const target = createTarget();
    const refs = createRefs(target);
    const setMachineState = vi.fn();
    const setSnapGuide = vi.fn();
    const captureStagePointer = vi.fn();

    const { result } = renderHook(() =>
      useRMinInteraction({
        refs,
        setMachineState,
        setSnapGuide,
        captureStagePointer,
      }),
    );

    expect(
      result.current.resetRMinToAuto({
        kind: 'rmin-handle',
        pathId: 'path-1',
        sectionIndex: 0,
        center: { x: 4, y: 4 },
      }),
    ).toBe(true);
    expect(actions.setSectionRMin).toHaveBeenCalledWith('path-1', 0, null);
    expect(actions.setSelection).toHaveBeenCalledWith({
      pathId: 'path-1',
      waypointId: null,
      headingKeyframeId: null,
      sectionIndex: 0,
    });
  });

  it('clears guides when finalization has no pointer world and selects the section on stationary finish', () => {
    const target = createTarget();
    const refs = createRefs(target);
    const setMachineState = vi.fn();
    const setSnapGuide = vi.fn();
    const captureStagePointer = vi.fn();
    const stage = {} as Konva.Stage;
    const state = createDragState(target);

    mockGetPointerWorldFromStage.mockReturnValue(null);

    const { result } = renderHook(() =>
      useRMinInteraction({
        refs,
        setMachineState,
        setSnapGuide,
        captureStagePointer,
      }),
    );

    result.current.finalizeMovedInteraction(state, stage, createWorkspace());

    expect(actions.setSectionRMin).not.toHaveBeenCalled();
    expect(setSnapGuide).toHaveBeenCalledWith(EMPTY_SNAP_GUIDE);

    result.current.finishStationaryInteraction({
      ...state,
      hasMoved: false,
    });

    expect(actions.setSelection).toHaveBeenCalledWith({
      pathId: 'path-1',
      waypointId: null,
      headingKeyframeId: null,
      sectionIndex: 0,
    });
  });
});
