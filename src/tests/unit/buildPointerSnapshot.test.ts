import { describe, expect, it } from 'vitest';
import type Konva from 'konva';
import { DEFAULT_SNAP_SETTINGS } from '../../domain/snapSettings';
import { buildPointerSnapshot } from '../../features/canvas/hooks/pointerMachine/buildPointerSnapshot';
import {
  createDiscretizedPath,
  createWorkspace,
  resolvePaths,
} from './pointerMachineTestUtils';

const createStageAtScreen = (x: number, y: number): Konva.Stage => {
  return {
    getPointerPosition: () => ({ x, y }),
  } as unknown as Konva.Stage;
};

const createPointerEvent = (
  overrides: Partial<PointerEvent> = {},
): PointerEvent => {
  return {
    pointerId: 7,
    button: 0,
    clientX: 200,
    clientY: 100,
    shiftKey: true,
    altKey: false,
    ...overrides,
  } as PointerEvent;
};

const createMouseEvent = (overrides: Partial<MouseEvent> = {}): MouseEvent => {
  return {
    button: 1,
    clientX: 15,
    clientY: 25,
    shiftKey: false,
    altKey: true,
    ...overrides,
  } as MouseEvent;
};

describe('buildPointerSnapshot', () => {
  it('builds a snapshot with hit testing and world coordinates when a stage is available', () => {
    const workspace = createWorkspace();
    const resolvedPaths = resolvePaths(workspace);
    const waypointPoints = resolvedPaths.flatMap((path) =>
      path.waypoints.map((waypoint) => ({
        id: waypoint.id,
        x: waypoint.x,
        y: waypoint.y,
      })),
    );
    const discretizedByPath = new Map([
      [workspace.activePathId, createDiscretizedPath()],
    ]);

    const snapshot = buildPointerSnapshot({
      event: createPointerEvent(),
      stage: createStageAtScreen(200, 100),
      workspace,
      waypointPoints,
      resolvedPaths,
      discretizedByPath,
      snapSettings: DEFAULT_SNAP_SETTINGS,
      rMinDragTargets: [],
    });

    expect(snapshot.pointerId).toBe(7);
    expect(snapshot.clientX).toBe(200);
    expect(snapshot.clientY).toBe(100);
    expect(snapshot.shiftKey).toBe(true);
    expect(snapshot.altKey).toBe(false);
    expect(snapshot.world?.x).toBeCloseTo(0);
    expect(snapshot.world?.y).toBeCloseTo(0);
    expect(snapshot.hit).toEqual({
      kind: 'waypoint',
      pathId: 'path-1',
      waypointId: 'waypoint-1',
    });
    expect(snapshot.resolvedPaths).toBe(resolvedPaths);
    expect(snapshot.discretizedByPath).toBe(discretizedByPath);
    expect(snapshot.waypointPoints).toBe(waypointPoints);
  });

  it('falls back to a canvas hit and null world coordinates when no stage is available', () => {
    const workspace = createWorkspace();
    const resolvedPaths = resolvePaths(workspace);
    const waypointPoints = resolvedPaths.flatMap((path) =>
      path.waypoints.map((waypoint) => ({
        id: waypoint.id,
        x: waypoint.x,
        y: waypoint.y,
      })),
    );
    const discretizedByPath = new Map([
      [workspace.activePathId, createDiscretizedPath()],
    ]);

    const snapshot = buildPointerSnapshot({
      event: createMouseEvent(),
      stage: null,
      workspace,
      waypointPoints,
      resolvedPaths,
      discretizedByPath,
      snapSettings: DEFAULT_SNAP_SETTINGS,
      rMinDragTargets: [],
    });

    expect(snapshot.pointerId).toBe(-1);
    expect(snapshot.hit).toEqual({ kind: 'canvas' });
    expect(snapshot.world).toBeNull();
    expect(snapshot.clientX).toBe(15);
    expect(snapshot.clientY).toBe(25);
    expect(snapshot.shiftKey).toBe(false);
    expect(snapshot.altKey).toBe(true);
  });
});
