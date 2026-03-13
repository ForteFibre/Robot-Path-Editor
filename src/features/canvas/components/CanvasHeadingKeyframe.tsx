import { type ReactElement } from 'react';
import { Circle, Group, Line } from 'react-konva';
import { pointFromHeading, worldToCanvasPoint } from '../../../domain/geometry';
import { getHeadingHandleDistance } from '../../../domain/canvas';
import type { EditorMode } from '../../../domain/models';
import type {
  ResolvedHeadingKeyframe,
  ResolvedPathModel,
} from '../../../domain/pointResolution';
import { canvasTheme } from '../canvasTheme';
import { CanvasZoomInvariantText } from './CanvasZoomInvariantText';

type CanvasHeadingKeyframeProps = {
  path: ResolvedPathModel;
  headingKeyframe: ResolvedHeadingKeyframe;
  k: number;
  isSelected: boolean;
  mode: EditorMode;
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
        fill={
          isSelected
            ? canvasTheme.headingKeyframe.selectedFill
            : canvasTheme.headingKeyframe.defaultFill
        }
        stroke={canvasTheme.headingKeyframe.stroke}
        strokeWidth={2 / k}
      />

      <CanvasZoomInvariantText
        k={k}
        x={canvasPoint.x + 8 / k}
        y={canvasPoint.y - 8 / k}
        fontSize={12}
        fill={canvasTheme.headingKeyframe.labelFill}
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
        stroke={canvasTheme.headingKeyframe.stroke}
        strokeWidth={2 / k}
        {...(isPreview ? { dash: [4 / k, 4 / k] } : {})}
        listening={false}
      />

      <Circle
        x={headingHandleCanvasPoint.x}
        y={headingHandleCanvasPoint.y}
        radius={5 / k}
        fill={canvasTheme.headingKeyframe.handleFill}
        opacity={mode === 'heading' ? 1 : 0.35}
        listening={false}
      />
    </Group>
  );
};
