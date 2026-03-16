import { useMemo, type ReactElement } from 'react';
import { Line, Shape } from 'react-konva';
import { worldToCanvasPoint } from '../../../domain/geometry';
import type { PathTiming } from '../../../domain/pathTiming';
import { buildVelocityPolylines } from './pathVelocitySegments';

type CanvasPathVelocityOverlayProps = {
  timing: PathTiming;
  k: number;
};

const VELOCITY_OVERLAY_STROKE_WIDTH = 3.6;
const VELOCITY_OVERLAY_BASE_BIN_COUNT = 24;
const VELOCITY_OVERLAY_MAX_BIN_COUNT = 96;
const VELOCITY_OVERLAY_TARGET_SAMPLE_STEP_PX = VELOCITY_OVERLAY_STROKE_WIDTH;
const VELOCITY_OVERLAY_MIN_WORLD_STEP_LENGTH = 0.01;
const VELOCITY_OVERLAY_MAX_WORLD_STEP_LENGTH = 2;

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const resolveVelocityOverlayBinCount = (k: number): number => {
  const safeZoom = Math.max(1, k);
  return Math.min(
    VELOCITY_OVERLAY_MAX_BIN_COUNT,
    Math.ceil(VELOCITY_OVERLAY_BASE_BIN_COUNT * safeZoom),
  );
};

const resolveVelocityOverlayMaxWorldStepLength = (k: number): number => {
  const safeZoom = Math.max(1, k);

  return clamp(
    VELOCITY_OVERLAY_TARGET_SAMPLE_STEP_PX / safeZoom,
    VELOCITY_OVERLAY_MIN_WORLD_STEP_LENGTH,
    VELOCITY_OVERLAY_MAX_WORLD_STEP_LENGTH,
  );
};

export const CanvasPathVelocityOverlay = ({
  timing,
  k,
}: CanvasPathVelocityOverlayProps): ReactElement | null => {
  const numBins = resolveVelocityOverlayBinCount(k);
  const maxWorldStepLength = resolveVelocityOverlayMaxWorldStepLength(k);

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
              strokeWidth={VELOCITY_OVERLAY_STROKE_WIDTH}
              strokeScaleEnabled={false}
              lineCap="butt"
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
            strokeWidth={VELOCITY_OVERLAY_STROKE_WIDTH}
            strokeScaleEnabled={false}
            lineCap="butt"
            lineJoin="round"
            opacity={0.55}
            listening={false}
          />
        );
      })}
    </>
  );
};
