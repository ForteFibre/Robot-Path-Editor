import { describe, expect, it } from 'vitest';
import { reducePointerMove } from '../../features/canvas/hooks/pointerMachine/reducer/pointerMove';
import { EMPTY_GUIDE } from '../../features/canvas/hooks/pointerMachine/reducer/shared';
import { createSnapshot, createWorkspace } from './pointerMachineTestUtils';

describe('pointerMachine pointerMove reducer helper', () => {
  it('shows waypoint add-point preview and snap-guide while idle in path mode', () => {
    const workspace = createWorkspace({ tool: 'add-point' });

    const transition = reducePointerMove(
      { kind: 'idle' },
      createSnapshot({
        workspace,
        world: { x: 5, y: 0 },
      }),
    );

    expect(transition.nextState).toEqual({ kind: 'idle' });
    expect(transition.effects).toHaveLength(2);
    const previewEffect = transition.effects.find(
      (
        effect,
      ): effect is Extract<
        (typeof transition.effects)[number],
        { kind: 'local.set-add-point-preview' }
      > => effect.kind === 'local.set-add-point-preview',
    );
    const guideEffect = transition.effects.find(
      (
        effect,
      ): effect is Extract<
        (typeof transition.effects)[number],
        { kind: 'local.set-snap-guide' }
      > => effect.kind === 'local.set-snap-guide',
    );

    expect(previewEffect?.preview?.kind).toBe('path-waypoint');
    expect(previewEffect?.preview?.point).toEqual({ x: 5, y: 0 });
    expect(guideEffect?.kind).toBe('local.set-snap-guide');
  });

  it('shows heading-keyframe preview when idle heading add-point hovers a section', () => {
    const workspace = createWorkspace({ mode: 'heading', tool: 'add-point' });

    const transition = reducePointerMove(
      { kind: 'idle' },
      createSnapshot({
        workspace,
        hit: { kind: 'section', pathId: 'path-1', sectionIndex: 0 },
        world: { x: 5, y: 0 },
      }),
    );

    expect(transition.nextState).toEqual({ kind: 'idle' });
    const previewEffect = transition.effects.find(
      (
        effect,
      ): effect is Extract<
        (typeof transition.effects)[number],
        { kind: 'local.set-add-point-preview' }
      > => effect.kind === 'local.set-add-point-preview',
    );
    const guideEffect = transition.effects.find(
      (
        effect,
      ): effect is Extract<
        (typeof transition.effects)[number],
        { kind: 'local.set-snap-guide' }
      > => effect.kind === 'local.set-snap-guide',
    );

    expect(previewEffect?.preview?.kind).toBe('heading-keyframe');
    if (previewEffect?.preview?.kind !== 'heading-keyframe') {
      throw new Error('Expected a heading-keyframe preview.');
    }
    expect(previewEffect.preview.point).toEqual({ x: 5, y: 0 });
    expect(previewEffect.preview.sectionIndex).toBe(0);
    expect(previewEffect.preview.sectionRatio).toBe(0.5);
    expect(guideEffect).toEqual({
      kind: 'local.set-snap-guide',
      guide: EMPTY_GUIDE,
    });
  });

  it('keeps pending-pan state until the drag threshold is crossed', () => {
    const state = {
      kind: 'pending-pan' as const,
      startScreenX: 240,
      startScreenY: 170,
      startTx: 200,
      startTy: 100,
    };

    const transition = reducePointerMove(
      state,
      createSnapshot({ clientX: 242, clientY: 171 }),
    );

    expect(transition.nextState).toEqual(state);
    expect(transition.effects).toEqual([]);
  });

  it('promotes pending-pan to panning after crossing the drag threshold', () => {
    const transition = reducePointerMove(
      {
        kind: 'pending-pan',
        startScreenX: 240,
        startScreenY: 170,
        startTx: 200,
        startTy: 100,
      },
      createSnapshot({ clientX: 245, clientY: 174 }),
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
});
