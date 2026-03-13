import { describe, expect, it } from 'vitest';
import { reducePointerFinish } from '../../features/canvas/hooks/pointerMachine/reducer/pointerFinish';
import {
  createRMinDragTarget,
  createSnapshot,
} from './pointerMachineTestUtils';

describe('pointerMachine pointerFinish reducer helper', () => {
  it('selects the waypoint and releases the pointer for a stationary waypoint drag', () => {
    const transition = reducePointerFinish(
      {
        kind: 'dragging-waypoint',
        pathId: 'path-1',
        waypointId: 'waypoint-1',
        startScreenX: 240,
        startScreenY: 170,
        hasMoved: false,
      },
      createSnapshot(),
    );

    expect(transition.nextState).toEqual({ kind: 'idle' });
    expect(transition.effects.map((effect) => effect.kind)).toEqual([
      'local.set-snap-guide',
      'local.set-add-point-preview',
      'path.select-waypoint',
      'local.release-pointer',
    ]);
    expect(transition.effects[2]).toMatchObject({
      kind: 'path.select-waypoint',
      pathId: 'path-1',
      waypointId: 'waypoint-1',
    });
  });

  it('confirms stationary add-point path-heading drags by selecting the waypoint and restoring the tool', () => {
    const transition = reducePointerFinish(
      {
        kind: 'dragging-path-heading',
        pathId: 'path-1',
        waypointId: 'waypoint-new',
        startScreenX: 240,
        startScreenY: 170,
        hasMoved: false,
        origin: 'add-point',
      },
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
    expect(transition.effects[2]).toMatchObject({
      kind: 'path.select-waypoint',
      pathId: 'path-1',
      waypointId: 'waypoint-new',
    });
    expect(transition.effects[3]).toEqual({
      kind: 'command.complete-add-waypoint-mode',
    });
  });

  it('applies the final rMin update and releases the pointer for moved drags', () => {
    const target = createRMinDragTarget({
      waypointPoint: { x: 0, y: 0 },
      rMin: 4,
    });

    const transition = reducePointerFinish(
      {
        kind: 'dragging-rmin',
        target,
        startScreenX: 240,
        startScreenY: 170,
        startDistance: 5,
        initialRMin: 4,
        hasMoved: true,
      },
      createSnapshot({ world: { x: 8, y: 0 } }),
    );

    expect(transition.nextState).toEqual({ kind: 'idle' });
    expect(transition.effects.map((effect) => effect.kind)).toEqual([
      'local.set-snap-guide',
      'local.set-add-point-preview',
      'rmin.update-section-rmin',
      'local.release-pointer',
    ]);
    expect(transition.effects[2]).toEqual({
      kind: 'rmin.update-section-rmin',
      pathId: 'path-1',
      sectionIndex: 0,
      rMin: 7,
    });
    expect(transition.effects[3]).toEqual({
      kind: 'local.release-pointer',
      pointerId: 1,
    });
  });
});
