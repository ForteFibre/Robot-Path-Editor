import { describe, expect, it } from 'vitest';
import {
  reduceHeadingKeyframeMove,
  reduceRobotHeadingMove,
  reduceSectionPointerDown,
} from '../../features/canvas/hooks/pointerMachine/reducer/headingMode';
import { createSnapshot, createWorkspace } from './pointerMachineTestUtils';

describe('pointerMachine headingMode reducer helpers', () => {
  it('emits a heading-keyframe creation command and captures the pointer when heading add-point hits a section', () => {
    const workspace = createWorkspace({ mode: 'heading', tool: 'add-point' });
    const sectionHit = {
      kind: 'section' as const,
      pathId: 'path-1',
      sectionIndex: 0,
    };

    const transition = reduceSectionPointerDown(
      createSnapshot({
        workspace,
        hit: sectionHit,
        world: { x: 5, y: 0 },
      }),
      sectionHit,
    );

    expect(transition.nextState).toMatchObject({
      kind: 'dragging-heading-keyframe-heading',
      pathId: 'path-1',
      hasMoved: false,
      origin: 'add-point',
    });

    const createEffect = transition.effects.find(
      (
        effect,
      ): effect is Extract<
        (typeof transition.effects)[number],
        { kind: 'command.execute-add-heading-keyframe' }
      > => effect.kind === 'command.execute-add-heading-keyframe',
    );

    expect(createEffect).toBeDefined();
    expect(createEffect?.params.sectionIndex).toBe(0);
    expect(createEffect?.params.sectionRatio).toBe(0.5);
    expect(typeof createEffect?.params.robotHeading).toBe('number');
    if (transition.nextState.kind !== 'dragging-heading-keyframe-heading') {
      throw new Error('Expected a heading-keyframe drag state.');
    }
    expect(createEffect?.params.headingKeyframeId).toBe(
      transition.nextState.headingKeyframeId,
    );
    expect(transition.effects).toContainEqual({
      kind: 'local.capture-pointer',
      pointerId: 1,
    });
  });

  it('returns an idle transition in non-heading mode while selecting the section', () => {
    const sectionHit = {
      kind: 'section' as const,
      pathId: 'path-1',
      sectionIndex: 0,
    };

    const transition = reduceSectionPointerDown(
      createSnapshot({ hit: sectionHit }),
      sectionHit,
    );

    expect(transition.nextState).toEqual({ kind: 'idle' });
    expect(transition.effects).toEqual([
      {
        kind: 'path.select-section',
        pathId: 'path-1',
        sectionIndex: 0,
      },
    ]);
  });

  it('stays idle when heading preview cannot be resolved', () => {
    const workspace = createWorkspace({ mode: 'heading', tool: 'add-point' });
    const sectionHit = {
      kind: 'section' as const,
      pathId: 'path-1',
      sectionIndex: 0,
    };

    const transition = reduceSectionPointerDown(
      createSnapshot({
        workspace,
        hit: sectionHit,
        discretizedByPath: new Map(),
      }),
      sectionHit,
    );

    expect(transition.nextState).toEqual({ kind: 'idle' });
    expect(transition.effects).toEqual([]);
  });

  it('returns the original robot-heading drag state when world coordinates are unavailable', () => {
    const state = {
      kind: 'dragging-robot-heading' as const,
      pathId: 'path-1',
      waypointId: 'waypoint-1',
      anchor: { x: 0, y: 0 },
      startScreenX: 240,
      startScreenY: 170,
      hasMoved: true,
    };

    const transition = reduceRobotHeadingMove(
      state,
      createSnapshot({ world: null }),
    );

    expect(transition.nextState).toEqual(state);
    expect(transition.effects).toEqual([]);
  });

  it('updates waypoint robot heading during a valid drag move', () => {
    const state = {
      kind: 'dragging-robot-heading' as const,
      pathId: 'path-1',
      waypointId: 'waypoint-1',
      anchor: { x: 0, y: 0 },
      startScreenX: 240,
      startScreenY: 170,
      hasMoved: false,
    };

    const transition = reduceRobotHeadingMove(
      state,
      createSnapshot({
        clientX: 250,
        clientY: 170,
        world: { x: 10, y: 0 },
      }),
    );

    expect(transition.nextState).toEqual({ ...state, hasMoved: true });
    expect(transition.effects.map((effect) => effect.kind)).toEqual([
      'local.set-add-point-preview',
      'local.set-snap-guide',
      'heading.update-waypoint-robot-heading',
    ]);
    expect(transition.effects[2]).toMatchObject({
      kind: 'heading.update-waypoint-robot-heading',
      pathId: 'path-1',
      waypointId: 'waypoint-1',
      robotHeading: 0,
    });
  });

  it('updates heading keyframe position when projection succeeds', () => {
    const state = {
      kind: 'dragging-heading-keyframe' as const,
      pathId: 'path-1',
      headingKeyframeId: 'heading-1',
      startScreenX: 240,
      startScreenY: 170,
      hasMoved: false,
    };

    const transition = reduceHeadingKeyframeMove(
      state,
      createSnapshot({
        clientX: 250,
        clientY: 170,
        world: { x: 5, y: 0 },
      }),
    );

    expect(transition.nextState).toEqual({ ...state, hasMoved: true });
    expect(transition.effects.map((effect) => effect.kind)).toEqual([
      'local.set-add-point-preview',
      'local.set-snap-guide',
      'heading.update-heading-keyframe-position',
    ]);
    expect(transition.effects[2]).toMatchObject({
      kind: 'heading.update-heading-keyframe-position',
      pathId: 'path-1',
      headingKeyframeId: 'heading-1',
      sectionIndex: 0,
      sectionRatio: 0.5,
    });
  });

  it('returns the original heading-keyframe drag state when prerequisites are missing', () => {
    const state = {
      kind: 'dragging-heading-keyframe' as const,
      pathId: 'path-1',
      headingKeyframeId: 'heading-1',
      startScreenX: 240,
      startScreenY: 170,
      hasMoved: true,
    };

    const transition = reduceHeadingKeyframeMove(
      state,
      createSnapshot({ world: null }),
    );

    expect(transition.nextState).toEqual(state);
    expect(transition.effects).toEqual([]);
  });
});
