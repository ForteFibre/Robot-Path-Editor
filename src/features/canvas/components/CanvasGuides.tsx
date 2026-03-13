import { worldToCanvasPoint, type SnapGuide } from '../../../domain/geometry';
import { type ReactElement } from 'react';
import { Circle, Line } from 'react-konva';
import { WORLD_GUIDE_EXTENT } from '../../../domain/metricScale';
import { canvasTheme } from '../canvasTheme';
import { CanvasZoomInvariantText } from './CanvasZoomInvariantText';

type CanvasGuidesProps = {
  snapGuide: SnapGuide;
  k: number;
};

export const CanvasGuides = ({
  snapGuide,
  k,
}: CanvasGuidesProps): ReactElement => {
  const snapGuideLineStart =
    snapGuide.line === null ? null : worldToCanvasPoint(snapGuide.line.start);
  const snapGuideLineEnd =
    snapGuide.line === null ? null : worldToCanvasPoint(snapGuide.line.end);
  const snapGuidePoint =
    snapGuide.point === null ? null : worldToCanvasPoint(snapGuide.point);

  return (
    <>
      {snapGuide.x === null ? null : (
        <Line
          points={[
            -WORLD_GUIDE_EXTENT,
            -snapGuide.x,
            WORLD_GUIDE_EXTENT,
            -snapGuide.x,
          ]}
          stroke={canvasTheme.guides.lineStroke}
          strokeWidth={2 / k}
          dash={[8 / k, 4 / k]}
          listening={false}
        />
      )}

      {snapGuide.y === null ? null : (
        <Line
          points={[
            -snapGuide.y,
            -WORLD_GUIDE_EXTENT,
            -snapGuide.y,
            WORLD_GUIDE_EXTENT,
          ]}
          stroke={canvasTheme.guides.lineStroke}
          strokeWidth={2 / k}
          dash={[8 / k, 4 / k]}
          listening={false}
        />
      )}

      {snapGuide.line === null ||
      snapGuideLineStart === null ||
      snapGuideLineEnd === null ? null : (
        <Line
          points={[
            snapGuideLineStart.x,
            snapGuideLineStart.y,
            snapGuideLineEnd.x,
            snapGuideLineEnd.y,
          ]}
          stroke={canvasTheme.guides.lineStroke}
          strokeWidth={2 / k}
          dash={[8 / k, 4 / k]}
          listening={false}
        />
      )}

      {snapGuidePoint === null ? null : (
        <Circle
          x={snapGuidePoint.x}
          y={snapGuidePoint.y}
          radius={5 / k}
          fill={canvasTheme.guides.pointFill}
          listening={false}
        />
      )}

      {snapGuide.label === null || snapGuidePoint === null ? null : (
        <CanvasZoomInvariantText
          k={k}
          x={snapGuidePoint.x + 10 / k}
          y={snapGuidePoint.y - 10 / k}
          fill={canvasTheme.guides.labelFill}
          fontSize={12}
          fontStyle="bold"
          text={snapGuide.label}
          listening={false}
        />
      )}
    </>
  );
};
