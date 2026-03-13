import { describe, expect, it } from 'vitest';
import { reducePointerMachine } from '../../features/canvas/hooks/pointerMachine/reducer/index';
import { getMachineStateMetadata } from '../../features/canvas/hooks/pointerMachine/types';
import type { RMinDragTarget } from '../../features/canvas/types/rMinDragTarget';
import {
  createPath,
  createSnapshot,
  createWorkspace,
} from './pointerMachineTestUtils';

describe('reducePointerMachine', () => {
  it('starts waypoint drags from idle in path mode', () => {
    const snapshot = createSnapshot({
      hit: { kind: 'waypoint', pathId: 'path-1', waypointId: 'waypoint-1' },
    });

    const transition = reducePointerMachine(
      { kind: 'idle' },
      { type: 'pointer-down' },
      snapshot,
    );

    expect(transition.nextState).toEqual({
      kind: 'dragging-waypoint',
      pathId: 'path-1',
      waypointId: 'waypoint-1',
      startScreenX: 240,
      startScreenY: 170,
      hasMoved: false,
    });
    expect(transition.effects).toEqual([
      { kind: 'local.capture-pointer', pointerId: 1 },
    ]);
  });

  it('creates a new waypoint drag from canvas add-point mode', () => {
    const workspace = createWorkspace({ tool: 'add-point' });
    const transition = reducePointerMachine(
      { kind: 'idle' },
      { type: 'pointer-down' },
      createSnapshot({ workspace }),
    );

    expect(transition.nextState.kind).toBe('dragging-path-heading');
    expect(transition.effects.map((effect) => effect.kind)).toEqual([
      'local.set-snap-guide',
      'local.set-add-point-preview',
      'command.execute-add-waypoint',
      'local.capture-pointer',
    ]);

    const insertEffect = transition.effects.find(
      (effect) => effect.kind === 'command.execute-add-waypoint',
    );
    expect(insertEffect).toMatchObject({
      kind: 'command.execute-add-waypoint',
      params: { pathId: 'path-1', x: 5, y: 0 },
    });
  });

  it('promotes pending pan to panning after crossing the drag threshold', () => {
    const transition = reducePointerMachine(
      {
        kind: 'pending-pan',
        startScreenX: 240,
        startScreenY: 170,
        startTx: 200,
        startTy: 100,
      },
      { type: 'pointer-move' },
      createSnapshot({ clientX: 260, clientY: 190 }),
    );

    expect(transition.nextState).toEqual({
      kind: 'panning',
      startScreenX: 240,
      startScreenY: 170,
      startTx: 200,
      startTy: 100,
    });
    expect(transition.effects).toEqual([]);
  });

  it('starts heading-keyframe-heading drags from heading add-point section hits', () => {
    const workspace = createWorkspace({ mode: 'heading', tool: 'add-point' });
    const transition = reducePointerMachine(
      { kind: 'idle' },
      { type: 'pointer-down' },
      createSnapshot({
        workspace,
        hit: { kind: 'section', pathId: 'path-1', sectionIndex: 0 },
        world: { x: 5, y: 0 },
      }),
    );

    expect(transition.nextState.kind).toBe('dragging-heading-keyframe-heading');
    expect((transition.nextState as { origin?: string }).origin).toBe(
      'add-point',
    );
    expect(transition.effects.map((effect) => effect.kind)).toEqual([
      'command.execute-add-heading-keyframe',
      'local.set-add-point-preview',
      'local.capture-pointer',
    ]);
  });

  it('starts rMin drags when a matching handle is hit in path mode', () => {
    const target: RMinDragTarget = {
      pathId: 'path-1',
      sectionIndex: 0,
      center: { x: 3, y: 2 },
      waypointPoint: { x: 0, y: 0 },
      rMin: 4,
      isAuto: false,
    };

    const transition = reducePointerMachine(
      { kind: 'idle' },
      { type: 'pointer-down' },
      createSnapshot({
        hit: {
          kind: 'rmin-handle',
          pathId: 'path-1',
          sectionIndex: 0,
          center: { x: 3, y: 2 },
        },
        world: { x: 6, y: 8 },
        rMinDragTargets: [target],
      }),
    );

    expect(transition.nextState).toEqual({
      kind: 'dragging-rmin',
      target,
      startScreenX: 240,
      startScreenY: 170,
      startDistance: 10,
      initialRMin: 4,
      hasMoved: false,
    });
  });

  it('moves background images using the ROS x-up / y-left screen mapping', () => {
    const workspace = createWorkspace({
      tool: 'edit-image',
      backgroundImage: {
        url: 'data:image/png;base64,test',
        width: 100,
        height: 50,
        x: 1,
        y: 2,
        scale: 1,
        alpha: 0.5,
      },
    });

    const transition = reducePointerMachine(
      {
        kind: 'dragging-background-image',
        startScreenX: 240,
        startScreenY: 170,
        startImgX: 1,
        startImgY: 2,
        hasMoved: false,
      },
      { type: 'pointer-move' },
      createSnapshot({
        workspace,
        clientX: 280,
        clientY: 150,
      }),
    );

    expect(transition.effects).toContainEqual({
      kind: 'pan.update-background-image',
      updates: {
        x: 2,
        y: 0,
      },
    });
  });

  it('returns selection and tool reset effects when an add-point heading drag finishes without moving', () => {
    const transition = reducePointerMachine(
      {
        kind: 'dragging-path-heading',
        pathId: 'path-1',
        waypointId: 'waypoint-new',
        startScreenX: 240,
        startScreenY: 170,
        hasMoved: false,
        origin: 'add-point',
      },
      { type: 'pointer-finish', reason: 'pointer-up' },
      createSnapshot(),
    );

    expect(transition.nextState).toEqual({ kind: 'idle' });
    expect(transition.effects.map((effect) => effect.kind)).toEqual([
      'local.set-snap-guide',
      'local.set-add-point-preview',
      'path.select-waypoint',
      'command.complete-add-waypoint-mode',
      'local.release-pointer',
    ]);
  });

  it('resets robot heading and section rMin on double-click', () => {
    const robotTransition = reducePointerMachine(
      { kind: 'idle' },
      { type: 'double-click' },
      createSnapshot({
        workspace: createWorkspace({ mode: 'heading' }),
        hit: {
          kind: 'robot-heading',
          pathId: 'path-1',
          waypointId: 'waypoint-1',
        },
      }),
    );

    expect(robotTransition.effects).toEqual([
      {
        kind: 'command.reset-waypoint-robot-heading',
        waypointId: 'waypoint-1',
      },
    ]);

    const rMinTransition = reducePointerMachine(
      { kind: 'idle' },
      { type: 'double-click' },
      createSnapshot({
        hit: {
          kind: 'rmin-handle',
          pathId: 'path-1',
          sectionIndex: 0,
          center: { x: 3, y: 2 },
        },
      }),
    );

    expect(rMinTransition.effects).toEqual([
      {
        kind: 'command.reset-section-rmin',
        sectionId: {
          pathId: 'path-1',
          sectionIndex: 0,
        },
      },
    ]);
  });

  it('marks robot heading drags as drag + robot-animation-suppressing metadata', () => {
    expect(
      getMachineStateMetadata({
        kind: 'dragging-robot-heading',
        pathId: 'path-1',
        waypointId: 'waypoint-1',
        anchor: { x: 0, y: 0 },
        startScreenX: 0,
        startScreenY: 0,
        hasMoved: false,
      }),
    ).toMatchObject({
      isDraggingInteraction: true,
      isContinuousDomainDrag: true,
      suppressesRobotAnimation: true,
    });
  });

  it('emits AppNotification effects instead of browser alerts for locked waypoints', () => {
    const workspace = createWorkspace({
      lockedPointIds: ['point-1'],
      paths: [
        {
          ...createPath().path,
          waypoints: [
            {
              id: 'waypoint-1',
              pointId: 'point-1',
              libraryPointId: 'point-1',
              pathHeading: 0,
            },
            {
              id: 'waypoint-2',
              pointId: 'point-2',
              libraryPointId: null,
              pathHeading: 0,
            },
          ],
        },
      ],
    });

    const transition = reducePointerMachine(
      {
        kind: 'dragging-waypoint',
        pathId: 'path-1',
        waypointId: 'waypoint-1',
        startScreenX: 240,
        startScreenY: 170,
        hasMoved: false,
      },
      { type: 'pointer-move' },
      createSnapshot({
        workspace,
        clientX: 280,
        clientY: 210,
      }),
    );

    expect(transition.nextState).toEqual({ kind: 'idle' });
    expect(transition.effects).toContainEqual({
      kind: 'local.notify',
      notification: {
        kind: 'info',
        message:
          'このポイントはロックされています。移動させるにはロックを解除してください。',
      },
    });
  });
});
