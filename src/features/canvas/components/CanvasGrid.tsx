import { type ReactElement } from 'react';
import { Line, Text } from 'react-konva';
import { getCanvasGridSize, getCanvasGridValues } from '../../../domain/canvas';
import { canvasToWorldPoint } from '../../../domain/geometry';
import {
  formatMetricValue,
  getMetricStepDecimals,
  WORLD_GUIDE_EXTENT,
} from '../../../domain/metricScale';
import type { CanvasTransform } from '../../../domain/canvasTransform';

const LABEL_SCREEN_PADDING = 12;
const GRID_LINE_COLOR = '#e5e7eb';
const ORIGIN_AXIS_COLOR = '#cbd5e1';
const GRID_LABEL_COLOR = '#94a3b8';

type CanvasGridProps = {
  canvasTransform: CanvasTransform;
  k: number;
  viewportWidth: number;
  viewportHeight: number;
};

export const CanvasGrid = ({
  canvasTransform,
  k,
  viewportWidth,
  viewportHeight,
}: CanvasGridProps): ReactElement => {
  const gridSize = getCanvasGridSize(k);
  const minCanvasX = -canvasTransform.x / k;
  const minCanvasY = -canvasTransform.y / k;
  const maxCanvasX = (viewportWidth - canvasTransform.x) / k;
  const maxCanvasY = (viewportHeight - canvasTransform.y) / k;
  const visibleWorldCorners = [
    canvasToWorldPoint({ x: minCanvasX, y: minCanvasY }),
    canvasToWorldPoint({ x: maxCanvasX, y: minCanvasY }),
    canvasToWorldPoint({ x: minCanvasX, y: maxCanvasY }),
    canvasToWorldPoint({ x: maxCanvasX, y: maxCanvasY }),
  ];
  const worldXValues = visibleWorldCorners.map((point) => point.x);
  const worldYValues = visibleWorldCorners.map((point) => point.y);
  const minWorldX = Math.min(...worldXValues);
  const maxWorldX = Math.max(...worldXValues);
  const minWorldY = Math.min(...worldYValues);
  const maxWorldY = Math.max(...worldYValues);
  const labelCanvasX = minCanvasX + LABEL_SCREEN_PADDING / k;
  const labelCanvasY = minCanvasY + LABEL_SCREEN_PADDING / k;
  const xValues = getCanvasGridValues(minWorldX, maxWorldX, gridSize);
  const yValues = getCanvasGridValues(minWorldY, maxWorldY, gridSize);
  const gridExtent = Math.max(
    WORLD_GUIDE_EXTENT,
    Math.abs(minCanvasX),
    Math.abs(minCanvasY),
    Math.abs(maxCanvasX),
    Math.abs(maxCanvasY),
  );
  const labelDecimals = getMetricStepDecimals(gridSize);

  return (
    <>
      {xValues.map((value) => (
        <Line
          key={`grid-line-x-${value}`}
          points={[-gridExtent, -value, gridExtent, -value]}
          stroke={GRID_LINE_COLOR}
          strokeWidth={1 / k}
          listening={false}
        />
      ))}

      {yValues.map((value) => (
        <Line
          key={`grid-line-y-${value}`}
          points={[-value, -gridExtent, -value, gridExtent]}
          stroke={GRID_LINE_COLOR}
          strokeWidth={1 / k}
          listening={false}
        />
      ))}

      <Line
        points={[0, -gridExtent, 0, gridExtent]}
        stroke={ORIGIN_AXIS_COLOR}
        strokeWidth={1.25 / k}
        listening={false}
      />
      <Line
        points={[-gridExtent, 0, gridExtent, 0]}
        stroke={ORIGIN_AXIS_COLOR}
        strokeWidth={1.25 / k}
        listening={false}
      />

      {xValues.map((value) => (
        <Text
          key={`grid-x-${value}`}
          x={labelCanvasX}
          y={-value - 4 / k}
          text={formatMetricValue(value, labelDecimals)}
          fontSize={12 / k}
          fill={GRID_LABEL_COLOR}
          listening={false}
        />
      ))}

      {yValues.map((value) => (
        <Text
          key={`grid-y-${value}`}
          x={-value + 4 / k}
          y={labelCanvasY}
          text={formatMetricValue(value, labelDecimals)}
          fontSize={12 / k}
          fill={GRID_LABEL_COLOR}
          listening={false}
        />
      ))}
    </>
  );
};
