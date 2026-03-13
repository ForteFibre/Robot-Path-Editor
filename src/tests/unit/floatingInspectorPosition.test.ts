import { describe, expect, it, vi } from 'vitest';
import type { CanvasTransform } from '../../domain/canvasTransform';
import {
  DEFAULT_FLOATING_INSPECTOR_LAYOUT,
  getPanelStyle,
  type FloatingInspectorLayout,
} from '../../features/floating/floatingInspectorPosition';

const identityTransform: CanvasTransform = {
  x: 0,
  y: 0,
  k: 1,
};

const createLayout = (
  overrides: Partial<FloatingInspectorLayout> = {},
): FloatingInspectorLayout => {
  return {
    ...DEFAULT_FLOATING_INSPECTOR_LAYOUT,
    ...overrides,
  };
};

describe('getPanelStyle', () => {
  it('returns an empty style when there is no anchor', () => {
    const querySelectorSpy = vi.spyOn(document, 'querySelector');

    expect(
      getPanelStyle(identityTransform, null, createLayout()),
    ).toStrictEqual({});
    expect(querySelectorSpy).not.toHaveBeenCalled();
  });

  it('positions the panel relative to the sidebar inset', () => {
    const style = getPanelStyle(
      identityTransform,
      { x: -50, y: -100 },
      createLayout(),
    );

    expect(style).toMatchObject({
      left: '500px',
      top: '12px',
      right: 'auto',
    });
  });

  it('clamps the panel to the available left boundary', () => {
    const style = getPanelStyle(
      identityTransform,
      { x: 0, y: 200 },
      createLayout(),
    );

    expect(style.left).toBe('328px');
  });

  it('clamps the panel to the available right boundary', () => {
    const style = getPanelStyle(
      identityTransform,
      { x: 0, y: -1000 },
      createLayout(),
    );

    expect(style.left).toBe('920px');
  });

  it('uses explicit container and sidebar offsets without reading the DOM', () => {
    const querySelectorSpy = vi.spyOn(document, 'querySelector');
    const style = getPanelStyle(
      identityTransform,
      { x: -40, y: -50 },
      createLayout({
        containerLeft: 120,
        containerWidth: 900,
        sidebarLeft: 120,
        sidebarWidth: 280,
        panelWidth: 240,
      }),
    );

    expect(style).toMatchObject({
      left: '410px',
      top: '12px',
    });
    expect(querySelectorSpy).not.toHaveBeenCalled();
  });
});
