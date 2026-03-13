import { describe, expect, it, vi } from 'vitest';
import { EMPTY_SNAP_GUIDE } from '../../domain/geometry';
import { createPointerEffectExecutor } from '../../features/canvas/hooks/pointerMachine/usePointerEffectExecutor';
import type { PointerEffectExecutorDeps } from '../../features/canvas/hooks/pointerMachine/usePointerEffectExecutor';

const createExecutorDeps = (): PointerEffectExecutorDeps & {
  pointerSurface: {
    releasePointerCapture: ReturnType<typeof vi.fn>;
    setPointerCapture: ReturnType<typeof vi.fn>;
  };
} => {
  const pointerSurface = {
    releasePointerCapture: vi.fn(),
    setPointerCapture: vi.fn(),
  };

  return {
    interactionSurfaceRef: {
      current: pointerSurface as unknown as HTMLElement,
    },
    setSnapGuide: vi.fn(),
    setAddPointPreview: vi.fn(),
    notify: vi.fn(),
    canvasEditingCommands: {
      executeAddWaypoint: vi.fn(),
      completeAddWaypointMode: vi.fn(),
      executeAddHeadingKeyframe: vi.fn(),
      resetWaypointRobotHeading: vi.fn(),
      resetSectionRMin: vi.fn(),
      executePanSelectionClear: vi.fn(),
    },
    workspaceActions: {
      clearSelection: vi.fn(),
      setCanvasTransform: vi.fn(),
      setSectionRMin: vi.fn(),
      setSelection: vi.fn(),
      updateBackgroundImage: vi.fn(),
      updateHeadingKeyframe: vi.fn(),
      updateWaypoint: vi.fn(),
    },
    pointerSurface,
  };
};

describe('createPointerEffectExecutor', () => {
  it('executes local effects, including pointer capture and graceful release', () => {
    const deps = createExecutorDeps();
    deps.pointerSurface.releasePointerCapture.mockImplementation(() => {
      throw new Error('no active capture');
    });
    const executeEffect = createPointerEffectExecutor(deps);
    const preview = {
      kind: 'path-waypoint' as const,
      point: { x: 5, y: 2 },
      pathHeading: 90,
      sourcePoint: null,
      nextPoint: null,
    };

    executeEffect({ kind: 'local.set-snap-guide', guide: EMPTY_SNAP_GUIDE });
    executeEffect({ kind: 'local.set-add-point-preview', preview });
    executeEffect({ kind: 'local.capture-pointer', pointerId: 12 });
    expect(() => {
      executeEffect({ kind: 'local.release-pointer', pointerId: 12 });
    }).not.toThrow();
    executeEffect({
      kind: 'local.notify',
      notification: {
        kind: 'info',
        message: 'pointer locked',
      },
    });

    expect(deps.setSnapGuide).toHaveBeenCalledWith(EMPTY_SNAP_GUIDE);
    expect(deps.setAddPointPreview).toHaveBeenCalledWith(preview);
    expect(deps.pointerSurface.setPointerCapture).toHaveBeenCalledWith(12);
    expect(deps.pointerSurface.releasePointerCapture).toHaveBeenCalledWith(12);
    expect(deps.notify).toHaveBeenCalledWith({
      kind: 'info',
      message: 'pointer locked',
    });
  });

  it('delegates command effects to canvas editing commands', () => {
    const deps = createExecutorDeps();
    const executeEffect = createPointerEffectExecutor(deps);

    executeEffect({
      kind: 'command.execute-add-waypoint',
      params: {
        pathId: 'path-1',
        pointId: 'point-new',
        waypointId: 'waypoint-new',
        x: 10,
        y: 20,
      },
    });
    executeEffect({
      kind: 'command.execute-add-heading-keyframe',
      params: {
        pathId: 'path-1',
        headingKeyframeId: 'heading-1',
        sectionIndex: 0,
        sectionRatio: 0.5,
        robotHeading: 45,
      },
    });
    executeEffect({
      kind: 'command.reset-section-rmin',
      sectionId: {
        pathId: 'path-1',
        sectionIndex: 1,
      },
    });
    executeEffect({ kind: 'command.execute-pan-selection-clear' });

    expect(deps.canvasEditingCommands.executeAddWaypoint).toHaveBeenCalledWith({
      pathId: 'path-1',
      pointId: 'point-new',
      waypointId: 'waypoint-new',
      x: 10,
      y: 20,
    });
    expect(
      deps.canvasEditingCommands.executeAddHeadingKeyframe,
    ).toHaveBeenCalledWith({
      pathId: 'path-1',
      headingKeyframeId: 'heading-1',
      sectionIndex: 0,
      sectionRatio: 0.5,
      robotHeading: 45,
    });
    expect(deps.canvasEditingCommands.resetSectionRMin).toHaveBeenCalledWith({
      pathId: 'path-1',
      sectionIndex: 1,
    });
    expect(
      deps.canvasEditingCommands.executePanSelectionClear,
    ).toHaveBeenCalledTimes(1);
  });

  it('routes workspace effects to the appropriate store actions', () => {
    const deps = createExecutorDeps();
    const executeEffect = createPointerEffectExecutor(deps);

    executeEffect({
      kind: 'path.update-waypoint-position',
      pathId: 'path-1',
      waypointId: 'waypoint-1',
      point: { x: 3, y: 4 },
    });
    executeEffect({
      kind: 'heading.select-heading-keyframe',
      pathId: 'path-1',
      headingKeyframeId: 'heading-2',
    });
    executeEffect({
      kind: 'heading.update-heading-keyframe-position',
      pathId: 'path-1',
      headingKeyframeId: 'heading-2',
      sectionIndex: 2,
      sectionRatio: 0.25,
    });
    executeEffect({
      kind: 'rmin.update-section-rmin',
      pathId: 'path-1',
      sectionIndex: 2,
      rMin: 1.5,
    });
    executeEffect({
      kind: 'pan.update-background-image',
      updates: { x: 11, y: 13 },
    });

    expect(deps.workspaceActions.updateWaypoint).toHaveBeenCalledWith(
      'path-1',
      'waypoint-1',
      { x: 3, y: 4 },
    );
    expect(deps.workspaceActions.setSelection).toHaveBeenCalledWith({
      pathId: 'path-1',
      waypointId: null,
      headingKeyframeId: 'heading-2',
      sectionIndex: null,
    });
    expect(deps.workspaceActions.updateHeadingKeyframe).toHaveBeenCalledWith(
      'path-1',
      'heading-2',
      {
        sectionIndex: 2,
        sectionRatio: 0.25,
      },
    );
    expect(deps.workspaceActions.setSectionRMin).toHaveBeenCalledWith(
      'path-1',
      2,
      1.5,
    );
    expect(deps.workspaceActions.updateBackgroundImage).toHaveBeenCalledWith({
      x: 11,
      y: 13,
    });
  });
});
