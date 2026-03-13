import { type ReactElement } from 'react';
import { Circle, Line } from 'react-konva';
import { worldToCanvasPoint } from '../../../domain/geometry';
import { formatMetricValue } from '../../../domain/metricScale';
import { canvasTheme } from '../canvasTheme';
import type { RMinDragTarget } from '../types/rMinDragTarget';
import { CanvasZoomInvariantText } from './CanvasZoomInvariantText';

type CanvasRMinDragProps = {
  rMinDragTarget: RMinDragTarget;
  k: number;
};

export const CanvasRMinDrag = ({
  rMinDragTarget,
  k,
}: CanvasRMinDragProps): ReactElement => {
  const centerCanvasPoint = worldToCanvasPoint(rMinDragTarget.center);
  const waypointCanvasPoint = worldToCanvasPoint(rMinDragTarget.waypointPoint);

  return (
    <>
      <Circle
        x={centerCanvasPoint.x}
        y={centerCanvasPoint.y}
        radius={rMinDragTarget.rMin}
        fill="transparent"
        stroke={canvasTheme.rMinDrag.ringStroke}
        strokeWidth={1.5 / k}
        dash={[6 / k, 4 / k]}
        listening={false}
      />

      <Line
        points={[
          centerCanvasPoint.x,
          centerCanvasPoint.y,
          waypointCanvasPoint.x,
          waypointCanvasPoint.y,
        ]}
        stroke={canvasTheme.rMinDrag.lineStroke}
        strokeWidth={1 / k}
        listening={false}
      />

      <CanvasZoomInvariantText
        k={k}
        x={(centerCanvasPoint.x + waypointCanvasPoint.x) / 2}
        y={(centerCanvasPoint.y + waypointCanvasPoint.y) / 2}
        offsetY={6}
        fill={canvasTheme.rMinDrag.labelFill}
        fontSize={12}
        align="center"
        text={`r: ${
          rMinDragTarget.isAuto
            ? `Auto(${formatMetricValue(rMinDragTarget.rMin)})`
            : formatMetricValue(rMinDragTarget.rMin)
        }`}
        listening={false}
      />

      <Circle
        x={centerCanvasPoint.x}
        y={centerCanvasPoint.y}
        radius={5 / k}
        fill={canvasTheme.rMinDrag.centerFill}
        listening={false}
      />
    </>
  );
};
