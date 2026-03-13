import { type ReactElement } from 'react';
import { Group, Line } from 'react-konva';
import { worldToCanvasPoint, type Point } from '../../../domain/geometry';
import type {
  ResolvedHeadingKeyframe,
  ResolvedPathModel,
  ResolvedWaypoint,
} from '../../../domain/pointResolution';
import type { EditorMode } from '../../../domain/models';
import { CanvasHeadingKeyframe } from './CanvasHeadingKeyframe';
import { CanvasWaypoint } from './CanvasWaypoint';
import type { AddPointPreviewState } from '../hooks/useCanvasPointerMachine';

const renderPreviewGuideLine = (
  sourcePoint: Point | null,
  destinationPoint: Point,
  color: string,
  k: number,
): ReactElement | null => {
  if (sourcePoint === null) {
    return null;
  }

  const source = worldToCanvasPoint(sourcePoint);
  const destination = worldToCanvasPoint(destinationPoint);

  return (
    <Line
      points={[source.x, source.y, destination.x, destination.y]}
      stroke={color}
      strokeWidth={1.5 / k}
      dash={[6 / k, 4 / k]}
      opacity={0.5}
      listening={false}
    />
  );
};

type CanvasPreviewOverlayProps = {
  addPointPreview: AddPointPreviewState | null;
  addPointPreviewPath: ResolvedPathModel | null;
  addPointPreviewWaypoint: ResolvedWaypoint | null;
  addPointPreviewHeadingKeyframe: ResolvedHeadingKeyframe | null;
  k: number;
  mode: EditorMode;
};

export const CanvasPreviewOverlay = ({
  addPointPreview,
  addPointPreviewPath,
  addPointPreviewWaypoint,
  addPointPreviewHeadingKeyframe,
  k,
  mode,
}: CanvasPreviewOverlayProps): ReactElement | null => {
  if (
    addPointPreviewPath === null ||
    (addPointPreviewWaypoint === null &&
      addPointPreviewHeadingKeyframe === null)
  ) {
    return null;
  }

  return (
    <Group listening={false}>
      {addPointPreview?.kind === 'path-waypoint' &&
      addPointPreviewWaypoint !== null ? (
        <>
          {renderPreviewGuideLine(
            addPointPreview.sourcePoint,
            addPointPreview.point,
            addPointPreviewPath.color,
            k,
          )}
          {renderPreviewGuideLine(
            addPointPreview.nextPoint,
            addPointPreview.point,
            addPointPreviewPath.color,
            k,
          )}
          <CanvasWaypoint
            path={addPointPreviewPath}
            waypoint={addPointPreviewWaypoint}
            k={k}
            isSelected={false}
            isBreak={false}
            isCoordinateLocked={false}
            mode={mode}
            isActive={true}
            isPreview={true}
          />
        </>
      ) : null}

      {addPointPreview?.kind === 'heading-keyframe' &&
      addPointPreviewHeadingKeyframe !== null ? (
        <CanvasHeadingKeyframe
          path={addPointPreviewPath}
          headingKeyframe={addPointPreviewHeadingKeyframe}
          k={k}
          isSelected={false}
          mode={mode}
          isActive={true}
          isPreview={true}
        />
      ) : null}
    </Group>
  );
};
