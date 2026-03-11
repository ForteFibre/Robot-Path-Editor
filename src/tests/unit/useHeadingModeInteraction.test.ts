import { renderHook } from '@testing-library/react';
import type Konva from 'konva';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_SNAP_GUIDE } from '../../domain/geometry';
import {
  DEFAULT_ROBOT_MOTION_SETTINGS,
  type Workspace,
} from '../../domain/models';
import { DEFAULT_SNAP_SETTINGS } from '../../domain/snapping';
import type { DiscretizedPath } from '../../domain/interpolation';
import type { ResolvedPathModel } from '../../domain/pointResolution';
import type * as HeadingKeyframesModule from '../../domain/headingKeyframes';
import type * as PointerMachineHelpersModule from '../../features/canvas/hooks/pointerMachine/helpers';
import { useHeadingModeInteraction } from '../../features/canvas/hooks/pointerMachine/useHeadingModeInteraction';
import type {
  CanvasPointerEvent,
  DraggingHeadingKeyframeHeadingState,
  PointerMachineRefs,
} from '../../features/canvas/hooks/pointerMachine/types';

const {
  actions,
  mockUseWorkspaceActions,
  mockGetPointerWorldFromStage,
  mockFindResolvedWaypointContext,
  mockFindWaypointWithPoint,
  mockResolveContinuousDragStateOnMove,
  mockResolveHeadingKeyframeAnchor,
  mockResolveHeadingKeyframePreview,
  mockResolveHeadingWithModifiers,
  mockGetPreviousHeadingKeyframe,
  mockProjectPointToPathSections,
  mockResolveDiscretizedHeadingKeyframes,
} = vi.hoisted(() => {
  return {
    actions: {
      createHeadingKeyframe: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      setSelection: vi.fn(),
      setTool: vi.fn(),
      updateHeadingKeyframe: vi.fn(),
      updateWaypoint: vi.fn(),
    },
    mockUseWorkspaceActions: vi.fn(),
    mockGetPointerWorldFromStage: vi.fn(),
    mockFindResolvedWaypointContext: vi.fn(),
    mockFindWaypointWithPoint: vi.fn(),
    mockResolveContinuousDragStateOnMove: vi.fn(),
    mockResolveHeadingKeyframeAnchor: vi.fn(),
    mockResolveHeadingKeyframePreview: vi.fn(),
    mockResolveHeadingWithModifiers: vi.fn(),
    mockGetPreviousHeadingKeyframe: vi.fn(),
    mockProjectPointToPathSections: vi.fn(),
    mockResolveDiscretizedHeadingKeyframes: vi.fn(),
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
    findResolvedWaypointContext: mockFindResolvedWaypointContext,
    findWaypointWithPoint: mockFindWaypointWithPoint,
    resolveContinuousDragStateOnMove: mockResolveContinuousDragStateOnMove,
    resolveHeadingKeyframeAnchor: mockResolveHeadingKeyframeAnchor,
    resolveHeadingKeyframePreview: mockResolveHeadingKeyframePreview,
    resolveHeadingWithModifiers: mockResolveHeadingWithModifiers,
  };
});

vi.mock('../../domain/headingKeyframes', async () => {
  const actual = await vi.importActual<typeof HeadingKeyframesModule>(
    '../../domain/headingKeyframes',
  );

  return {
    ...actual,
    getPreviousHeadingKeyframe: mockGetPreviousHeadingKeyframe,
    projectPointToPathSections: mockProjectPointToPathSections,
    resolveDiscretizedHeadingKeyframes: mockResolveDiscretizedHeadingKeyframes,
  };
});

const createWorkspace = (overrides: Partial<Workspace> = {}): Workspace => {
  return {
    mode: 'heading',
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

const createResolvedPath = (): ResolvedPathModel => {
  return {
    id: 'path-1',
    name: 'Path 1',
    color: '#2563eb',
    visible: true,
    waypoints: [
      {
        id: 'waypoint-1',
        pointId: 'point-1',
        libraryPointId: null,
        name: 'WP 1',
        pathHeading: 270,
        point: {
          id: 'point-1',
          x: 1,
          y: 2,
          robotHeading: null,
          isLibrary: false,
          name: 'WP 1',
        },
        libraryPoint: null,
        x: 1,
        y: 2,
      },
    ],
    headingKeyframes: [
      {
        id: 'heading-1',
        name: 'Heading 1',
        sectionIndex: 0,
        sectionRatio: 0.4,
        robotHeading: 270,
      },
    ],
    sectionRMin: [],
  };
};

const createRefs = (): PointerMachineRefs => {
  return {
    waypointPointsRef: { current: [] },
    resolvedPathsRef: { current: [createResolvedPath()] },
    discretizedByPathRef: {
      current: new Map([['path-1', {} as DiscretizedPath]]),
    },
    snapSettingsRef: { current: DEFAULT_SNAP_SETTINGS },
    rMinTargetsRef: { current: [] },
  };
};

const createHeadingHandleDragState = (
  origin: 'existing' | 'add-point' = 'existing',
): DraggingHeadingKeyframeHeadingState => {
  return {
    kind: 'dragging-heading-keyframe-heading',
    pathId: 'path-1',
    headingKeyframeId: 'heading-1',
    anchor: { x: 3, y: 4 },
    startScreenX: 240,
    startScreenY: 170,
    hasMoved: true,
    origin,
  };
};

describe('useHeadingModeInteraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseWorkspaceActions.mockReturnValue(actions);
    actions.createHeadingKeyframe.mockReturnValue('heading-1');

    mockFindWaypointWithPoint.mockReturnValue({
      waypoint: {
        id: 'waypoint-1',
        pointId: 'point-1',
        libraryPointId: null,
        pathHeading: 270,
      },
      point: {
        id: 'point-1',
        x: 1,
        y: 2,
        robotHeading: null,
        isLibrary: false,
        name: 'WP 1',
      },
      libraryPoint: null,
    });
    mockFindResolvedWaypointContext.mockReturnValue({
      previousPoint: { x: 0, y: 0 },
      previousHeadingDeg: 180,
      previousSegmentStart: null,
    });
    mockResolveContinuousDragStateOnMove.mockImplementation(
      ({ state }: { state: { hasMoved: boolean } }) => ({
        ...state,
        hasMoved: true,
      }),
    );
    mockResolveHeadingKeyframeAnchor.mockReturnValue({ x: 3, y: 4 });
    mockResolveHeadingKeyframePreview.mockReturnValue({
      kind: 'heading-keyframe',
      point: { x: 4, y: 6 },
      robotHeading: 225,
      sectionIndex: 0,
      sectionRatio: 0.35,
    });
    mockResolveHeadingWithModifiers.mockReturnValue({
      angle: 123,
      guide: {
        x: null,
        y: null,
        line: null,
        point: { x: 8, y: 9 },
        label: 'heading snap',
      },
    });
    mockGetPreviousHeadingKeyframe.mockReturnValue({
      id: 'previous-heading',
      name: 'Heading 0',
      sectionIndex: 0,
      sectionRatio: 0.2,
      robotHeading: 180,
      x: 2,
      y: 2,
      pathHeading: 180,
    });
    mockProjectPointToPathSections.mockReturnValue({
      sectionIndex: 2,
      sectionRatio: 0.25,
    });
    mockResolveDiscretizedHeadingKeyframes.mockReturnValue([
      {
        id: 'previous-heading',
        name: 'Heading 0',
        sectionIndex: 0,
        sectionRatio: 0.2,
        robotHeading: 180,
        x: 2,
        y: 2,
        pathHeading: 180,
      },
      {
        id: 'heading-1',
        name: 'Heading 1',
        sectionIndex: 0,
        sectionRatio: 0.4,
        robotHeading: 270,
        x: 4,
        y: 6,
        pathHeading: 270,
      },
    ]);
    mockGetPointerWorldFromStage.mockReturnValue({ x: 8, y: 9 });
  });

  it('starts robot-heading drags and updates the waypoint heading while dragging', () => {
    const setMachineState = vi.fn();
    const setSnapGuide = vi.fn();
    const setAddPointPreview = vi.fn();
    const captureStagePointer = vi.fn();
    const refs = createRefs();
    const stage = {} as Konva.Stage;
    const event = createEvent();
    const workspace = createWorkspace();

    const { result } = renderHook(() =>
      useHeadingModeInteraction({
        refs,
        setMachineState,
        setSnapGuide,
        setAddPointPreview,
        captureStagePointer,
      }),
    );

    result.current.beginRobotHeadingDrag(event, stage, workspace, {
      kind: 'robot-heading',
      pathId: 'path-1',
      waypointId: 'waypoint-1',
    });

    expect(setMachineState).toHaveBeenCalledWith({
      kind: 'dragging-robot-heading',
      pathId: 'path-1',
      waypointId: 'waypoint-1',
      anchor: { x: 1, y: 2 },
      startScreenX: 240,
      startScreenY: 170,
      hasMoved: false,
    });
    expect(captureStagePointer).toHaveBeenCalledWith(stage, event);

    result.current.handlePointerMove({
      state: {
        kind: 'dragging-robot-heading',
        pathId: 'path-1',
        waypointId: 'waypoint-1',
        anchor: { x: 1, y: 2 },
        startScreenX: 240,
        startScreenY: 170,
        hasMoved: true,
      },
      event,
      stage,
      workspace,
    });

    expect(mockFindResolvedWaypointContext).toHaveBeenCalledWith(
      refs.resolvedPathsRef.current,
      'path-1',
      'waypoint-1',
    );
    expect(actions.updateWaypoint).toHaveBeenCalledWith(
      'path-1',
      'waypoint-1',
      { robotHeading: 123 },
    );
    expect(setSnapGuide).toHaveBeenCalledWith({
      x: null,
      y: null,
      line: null,
      point: { x: 8, y: 9 },
      label: 'heading snap',
    });
  });

  it('resets robot heading handles back to auto', () => {
    const setMachineState = vi.fn();
    const setSnapGuide = vi.fn();
    const setAddPointPreview = vi.fn();
    const captureStagePointer = vi.fn();
    const refs = createRefs();

    const { result } = renderHook(() =>
      useHeadingModeInteraction({
        refs,
        setMachineState,
        setSnapGuide,
        setAddPointPreview,
        captureStagePointer,
      }),
    );

    result.current.resetRobotHeadingToAuto({
      kind: 'robot-heading',
      pathId: 'path-1',
      waypointId: 'waypoint-1',
    });

    expect(actions.updateWaypoint).toHaveBeenCalledWith(
      'path-1',
      'waypoint-1',
      {
        robotHeading: null,
      },
    );
    expect(actions.setSelection).toHaveBeenCalledWith({
      pathId: 'path-1',
      waypointId: 'waypoint-1',
      headingKeyframeId: null,
      sectionIndex: null,
    });
  });

  it('projects heading-keyframe drags onto the path and selects the keyframe when the interaction finishes', () => {
    const setMachineState = vi.fn();
    const setSnapGuide = vi.fn();
    const setAddPointPreview = vi.fn();
    const captureStagePointer = vi.fn();
    const refs = createRefs();
    const stage = {} as Konva.Stage;
    const event = createEvent({ clientX: 300, clientY: 210 });
    const workspace = createWorkspace();

    const { result } = renderHook(() =>
      useHeadingModeInteraction({
        refs,
        setMachineState,
        setSnapGuide,
        setAddPointPreview,
        captureStagePointer,
      }),
    );

    result.current.beginHeadingKeyframeDrag(event, stage, {
      kind: 'heading-keyframe',
      pathId: 'path-1',
      headingKeyframeId: 'heading-1',
    });

    expect(setMachineState).toHaveBeenCalledWith({
      kind: 'dragging-heading-keyframe',
      pathId: 'path-1',
      headingKeyframeId: 'heading-1',
      startScreenX: 300,
      startScreenY: 210,
      hasMoved: false,
    });
    expect(captureStagePointer).toHaveBeenCalledWith(stage, event);

    const nextState = result.current.resolveHeadingKeyframeMoveState(
      {
        kind: 'dragging-heading-keyframe',
        pathId: 'path-1',
        headingKeyframeId: 'heading-1',
        startScreenX: 300,
        startScreenY: 210,
        hasMoved: false,
      },
      event,
    );

    expect(mockResolveContinuousDragStateOnMove).toHaveBeenCalled();
    expect(nextState).toEqual({
      kind: 'dragging-heading-keyframe',
      pathId: 'path-1',
      headingKeyframeId: 'heading-1',
      startScreenX: 300,
      startScreenY: 210,
      hasMoved: true,
    });

    result.current.handlePointerMove({
      state: {
        kind: 'dragging-heading-keyframe',
        pathId: 'path-1',
        headingKeyframeId: 'heading-1',
        startScreenX: 300,
        startScreenY: 210,
        hasMoved: true,
      },
      event,
      stage,
      workspace,
    });

    expect(actions.updateHeadingKeyframe).toHaveBeenCalledWith(
      'path-1',
      'heading-1',
      {
        sectionIndex: 2,
        sectionRatio: 0.25,
      },
    );
    expect(setSnapGuide).toHaveBeenCalledWith(EMPTY_SNAP_GUIDE);

    result.current.finishStationaryInteraction({
      kind: 'dragging-heading-keyframe',
      pathId: 'path-1',
      headingKeyframeId: 'heading-1',
      startScreenX: 300,
      startScreenY: 210,
      hasMoved: false,
    });

    expect(actions.setSelection).toHaveBeenCalledWith({
      pathId: 'path-1',
      waypointId: null,
      headingKeyframeId: 'heading-1',
      sectionIndex: null,
    });
  });

  it('creates a heading keyframe from section add-point mode and restores select mode on stationary finish', () => {
    const setMachineState = vi.fn();
    const setSnapGuide = vi.fn();
    const setAddPointPreview = vi.fn();
    const captureStagePointer = vi.fn();
    const refs = createRefs();
    const stage = {} as Konva.Stage;
    const event = createEvent();
    const workspace = createWorkspace({
      tool: 'add-point',
      mode: 'heading',
    });

    const { result } = renderHook(() =>
      useHeadingModeInteraction({
        refs,
        setMachineState,
        setSnapGuide,
        setAddPointPreview,
        captureStagePointer,
      }),
    );

    result.current.handleSectionInteraction(event, stage, workspace, {
      kind: 'section',
      pathId: 'path-1',
      sectionIndex: 0,
    });

    expect(actions.pause).toHaveBeenCalled();
    expect(actions.createHeadingKeyframe).toHaveBeenCalledWith({
      pathId: 'path-1',
      sectionIndex: 0,
      sectionRatio: 0.35,
      robotHeading: 225,
    });
    expect(setMachineState).toHaveBeenCalledWith({
      kind: 'dragging-heading-keyframe-heading',
      pathId: 'path-1',
      headingKeyframeId: 'heading-1',
      anchor: { x: 4, y: 6 },
      startScreenX: 240,
      startScreenY: 170,
      hasMoved: false,
      origin: 'add-point',
    });
    expect(setAddPointPreview).toHaveBeenCalledWith(null);
    expect(captureStagePointer).toHaveBeenCalledWith(stage, event);

    result.current.finishStationaryInteraction({
      kind: 'dragging-heading-keyframe-heading',
      pathId: 'path-1',
      headingKeyframeId: 'heading-1',
      anchor: { x: 4, y: 6 },
      startScreenX: 240,
      startScreenY: 170,
      hasMoved: false,
      origin: 'add-point',
    });

    expect(actions.setSelection).toHaveBeenCalledWith({
      pathId: 'path-1',
      waypointId: null,
      headingKeyframeId: 'heading-1',
      sectionIndex: null,
    });
    expect(actions.setTool).toHaveBeenCalledWith('select');
  });

  it('anchors existing heading-handle drags, updates robot heading, and keeps pointer-cancel finish logic on the add-point path', () => {
    const setMachineState = vi.fn();
    const setSnapGuide = vi.fn();
    const setAddPointPreview = vi.fn();
    const captureStagePointer = vi.fn();
    const refs = createRefs();
    const stage = {} as Konva.Stage;
    const event = createEvent({ clientX: 392, clientY: 170 });
    const workspace = createWorkspace();

    const { result } = renderHook(() =>
      useHeadingModeInteraction({
        refs,
        setMachineState,
        setSnapGuide,
        setAddPointPreview,
        captureStagePointer,
      }),
    );

    result.current.beginHeadingKeyframeHeadingDrag(event, stage, {
      kind: 'heading-keyframe-heading',
      pathId: 'path-1',
      headingKeyframeId: 'heading-1',
    });

    expect(mockResolveHeadingKeyframeAnchor).toHaveBeenCalledWith(
      refs.resolvedPathsRef.current,
      refs.discretizedByPathRef.current,
      'path-1',
      'heading-1',
    );
    expect(setMachineState).toHaveBeenCalledWith({
      kind: 'dragging-heading-keyframe-heading',
      pathId: 'path-1',
      headingKeyframeId: 'heading-1',
      anchor: { x: 3, y: 4 },
      startScreenX: 392,
      startScreenY: 170,
      hasMoved: false,
      origin: 'existing',
    });
    expect(captureStagePointer).toHaveBeenCalledWith(stage, event);

    const movedState = createHeadingHandleDragState();
    expect(
      result.current.resolveHeadingKeyframeHeadingMoveState(movedState, event),
    ).toEqual({
      ...movedState,
      hasMoved: true,
    });

    result.current.handlePointerMove({
      state: movedState,
      event,
      stage,
      workspace,
    });

    expect(actions.updateHeadingKeyframe).toHaveBeenCalledWith(
      'path-1',
      'heading-1',
      { robotHeading: 123 },
    );
    expect(setSnapGuide).toHaveBeenCalledWith({
      x: null,
      y: null,
      line: null,
      point: { x: 8, y: 9 },
      label: 'heading snap',
    });

    result.current.finishMovedInteraction(
      createHeadingHandleDragState('add-point'),
    );

    expect(actions.setTool).toHaveBeenCalledWith('select');
  });
});
