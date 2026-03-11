import { type ReactElement } from 'react';
import { Circle, Group, Line, Text } from 'react-konva';
import { pointFromHeading, worldToCanvasPoint } from '../../../domain/geometry';
import { getHeadingHandleDistance } from '../../../domain/canvas';
import type { Workspace } from '../../../domain/models';
import type {
  ResolvedHeadingKeyframe,
  ResolvedPathModel,
} from '../../../domain/pointResolution';

type CanvasHeadingKeyframeProps = {
  path: ResolvedPathModel;
  headingKeyframe: ResolvedHeadingKeyframe;
  k: number;
  isSelected: boolean;
  mode: Workspace['mode'];
  isActive: boolean;
  isPreview?: boolean;
};

export const CanvasHeadingKeyframe = ({
  path: _path,
  headingKeyframe,
  k,
  isSelected,
  mode,
  isActive,
  isPreview = false,
}: CanvasHeadingKeyframeProps): ReactElement | null => {
  if (!isActive) {
    return null;
  }

  const headingHandleDistance = getHeadingHandleDistance(k);
  const canvasPoint = worldToCanvasPoint(headingKeyframe);
  const headingHandle = pointFromHeading(
    headingKeyframe,
    headingKeyframe.robotHeading,
    headingHandleDistance,
  );
  const headingHandleCanvasPoint = worldToCanvasPoint(headingHandle);
  const size = (isSelected ? 8 : 6) / k;
  const points = [
    canvasPoint.x,
    canvasPoint.y - size,
    canvasPoint.x + size,
    canvasPoint.y,
    canvasPoint.x,
    canvasPoint.y + size,
    canvasPoint.x - size,
    canvasPoint.y,
  ];

  return (
    <Group listening={false} opacity={isPreview ? 0.5 : 1}>
      <Line
        points={points}
        closed
        fill={isSelected ? '#14532d' : '#dcfce7'}
        stroke="#16a34a"
        strokeWidth={2 / k}
      />

      <Text
        x={canvasPoint.x + 8 / k}
        y={canvasPoint.y - 8 / k}
        fontSize={12 / k}
        fill="#14532d"
        text={headingKeyframe.name}
        listening={false}
      />

      <Line
        points={[
          canvasPoint.x,
          canvasPoint.y,
          headingHandleCanvasPoint.x,
          headingHandleCanvasPoint.y,
        ]}
        stroke="#16a34a"
        strokeWidth={2 / k}
        {...(isPreview ? { dash: [4 / k, 4 / k] } : {})}
        listening={false}
      />

      <Circle
        x={headingHandleCanvasPoint.x}
        y={headingHandleCanvasPoint.y}
        radius={5 / k}
        fill="#16a34a"
        opacity={mode === 'heading' ? 1 : 0.35}
        listening={false}
      />
    </Group>
  );
};
