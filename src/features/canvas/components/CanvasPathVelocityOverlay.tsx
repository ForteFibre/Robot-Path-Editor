import { useMemo, type ReactElement } from 'react';
import { Line, Shape } from 'react-konva';
import { worldToCanvasPoint } from '../../../domain/geometry';
import type { PathTiming } from '../../../domain/pathTiming';
import { buildVelocityPolylines } from './pathVelocitySegments';

type CanvasPathVelocityOverlayProps = {
  timing: PathTiming;
  k: number;
};

export const CanvasPathVelocityOverlay = ({
  timing,
  k,
}: CanvasPathVelocityOverlayProps): ReactElement | null => {
  const numBins = Math.ceil(24 * Math.max(1, k));
  const maxWorldStepLength = 0.1 / Math.max(1, k);

  const segments = useMemo(
    () =>
      buildVelocityPolylines(
        timing.segments,
        timing.maxVelocity,
        numBins,
        maxWorldStepLength,
      ),
    [maxWorldStepLength, numBins, timing.maxVelocity, timing.segments],
  );

  if (segments.length === 0) {
    return null;
  }

  return (
    <>
      {segments.map((segment) => {
        if (segment.kind === 'line') {
          const start = worldToCanvasPoint(segment.start);
          const end = worldToCanvasPoint(segment.end);
          const key = [
            'velocity-line',
            segment.color,
            segment.start.x.toFixed(6),
            segment.start.y.toFixed(6),
            segment.end.x.toFixed(6),
            segment.end.y.toFixed(6),
          ].join('-');

          return (
            <Line
              key={key}
              points={[start.x, start.y, end.x, end.y]}
              stroke={segment.color}
              strokeWidth={2 / k}
              lineCap="round"
              lineJoin="round"
              opacity={0.55}
              listening={false}
            />
          );
        }

        const center = worldToCanvasPoint(segment.center);
        const startAngle = -segment.startAngleRad - Math.PI / 2;
        const sweep = -segment.sweepRad;
        const key = [
          'velocity-arc',
          segment.color,
          segment.center.x.toFixed(6),
          segment.center.y.toFixed(6),
          segment.radius.toFixed(6),
          segment.startAngleRad.toFixed(6),
          segment.sweepRad.toFixed(6),
        ].join('-');

        return (
          <Shape
            key={key}
            sceneFunc={(context, shape) => {
              context.beginPath();
              context.arc(
                center.x,
                center.y,
                segment.radius,
                startAngle,
                startAngle + sweep,
                sweep < 0,
              );
              context.strokeShape(shape);
            }}
            stroke={segment.color}
            strokeWidth={2 / k}
            lineCap="round"
            lineJoin="round"
            opacity={0.55}
            listening={false}
          />
        );
      })}
    </>
  );
};
