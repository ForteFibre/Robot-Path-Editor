import { type ReactElement } from 'react';
import { Circle, Line, Text } from 'react-konva';
import { worldToCanvasPoint, type Point } from '../../../domain/geometry';
import { formatMetricValue } from '../../../domain/metricScale';

export type RMinDragTarget = {
  pathId: string;
  sectionIndex: number;
  center: Point;
  waypointPoint: Point;
  rMin: number;
  isAuto: boolean;
};

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
        stroke="rgba(37, 99, 235, 0.3)"
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
        stroke="rgba(37, 99, 235, 0.5)"
        strokeWidth={1 / k}
        listening={false}
      />

      <Text
        x={(centerCanvasPoint.x + waypointCanvasPoint.x) / 2}
        y={(centerCanvasPoint.y + waypointCanvasPoint.y) / 2}
        offsetY={6 / k}
        fill="rgba(37, 99, 235, 0.8)"
        fontSize={12 / k}
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
        fill="rgba(37, 99, 235, 0.6)"
        listening={false}
      />
    </>
  );
};
