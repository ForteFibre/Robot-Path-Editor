import type Konva from 'konva';
import type { Point } from '../../../../domain/geometry';
import type { DiscretizedPath } from '../../../../domain/interpolation';
import type { ResolvedPathModel } from '../../../../domain/pointResolution';
import type { SnapSettings } from '../../../../domain/snapSettings';
import type { CanvasInteractionSnapshot } from '../../../../store/types';
import type { RMinDragTarget } from '../../types/rMinDragTarget';
import { getPointerWorldFromStage, resolveStageHit } from '../canvasHitTesting';
import type { PointerSnapshot } from './types';

export type BuildPointerSnapshotParams = {
  event: PointerEvent | MouseEvent;
  stage: Konva.Stage | null;
  workspace: CanvasInteractionSnapshot;
  waypointPoints: (Point & { id: string })[];
  resolvedPaths: ResolvedPathModel[];
  discretizedByPath: Map<string, DiscretizedPath>;
  snapSettings: SnapSettings;
  rMinDragTargets: RMinDragTarget[];
};

export const buildPointerSnapshot = ({
  event,
  stage,
  workspace,
  waypointPoints,
  resolvedPaths,
  discretizedByPath,
  snapSettings,
  rMinDragTargets,
}: BuildPointerSnapshotParams): PointerSnapshot => {
  return {
    pointerId: 'pointerId' in event ? event.pointerId : -1,
    button: event.button,
    clientX: event.clientX,
    clientY: event.clientY,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    workspace,
    hit:
      stage === null
        ? { kind: 'canvas' }
        : resolveStageHit({
            workspace,
            stage,
            resolvedPaths,
            discretizedByPath,
            rMinDragTargets,
          }),
    world:
      stage === null
        ? null
        : getPointerWorldFromStage(stage, workspace.canvasTransform),
    waypointPoints,
    resolvedPaths,
    discretizedByPath,
    snapSettings,
    rMinDragTargets,
  };
};
