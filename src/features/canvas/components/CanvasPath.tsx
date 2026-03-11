import type { ResolvedPathModel } from '../../../domain/pointResolution';
import { worldToCanvasPoint, type Point } from '../../../domain/geometry';
import type { HeadingSample } from '../../../domain/interpolation';
import type { PathGeometrySegment } from '../../../domain/pathTimingSegments';
import type { Workspace } from '../../../domain/models';
import { type ReactElement } from 'react';
import { Line, Shape } from 'react-konva';

export type CanvasPathSegmentRenderData =
  | {
      kind: 'line';
      points: number[];
    }
  | {
      kind: 'arc';
      center: Point;
      radius: number;
      startAngle: number;
      endAngle: number;
      anticlockwise: boolean;
    };

export const toCanvasPathSegmentRenderData = (
  segment: PathGeometrySegment,
): CanvasPathSegmentRenderData => {
  if (segment.kind === 'line') {
    const start = worldToCanvasPoint({ x: segment.startX, y: segment.startY });
    const end = worldToCanvasPoint({ x: segment.endX, y: segment.endY });

    return {
      kind: 'line',
      points: [start.x, start.y, end.x, end.y],
    };
  }

  const center = worldToCanvasPoint({ x: segment.centerX, y: segment.centerY });
  const startAngle = -segment.startAngleRad - Math.PI / 2;
  const sweep = -segment.sweepRad;

  return {
    kind: 'arc',
    center,
    radius: segment.turningRadius,
    startAngle,
    endAngle: startAngle + sweep,
    anticlockwise: sweep < 0,
  };
};

type CanvasPathProps = {
  path: ResolvedPathModel;
  geometrySegments: PathGeometrySegment[];
  discretizedSamples: HeadingSample[];
  k: number;
  isActive: boolean;
  mode: Workspace['mode'];
};

const buildHeadingLines = (params: {
  path: ResolvedPathModel;
  discretizedSamples: HeadingSample[];
  k: number;
  isActive: boolean;
  mode: Workspace['mode'];
}): ReactElement[] => {
  const { path, discretizedSamples, k, isActive, mode } = params;
  if (mode !== 'heading' || discretizedSamples.length < 2) {
    return [];
  }

  const headingLines: ReactElement[] = [];
  const minSpacingPx = 80;
  const minSpacingWorld = minSpacingPx / k;
  let accumulatedDistance = minSpacingWorld;

  for (let index = 0; index < discretizedSamples.length; index += 1) {
    const sample = discretizedSamples[index];
    if (sample === undefined) {
      continue;
    }

    if (index > 0) {
      const previousSample = discretizedSamples[index - 1];
      if (previousSample !== undefined) {
        accumulatedDistance += Math.hypot(
          sample.x - previousSample.x,
          sample.y - previousSample.y,
        );
      }
    }

    if (accumulatedDistance < minSpacingWorld) {
      continue;
    }

    const sizeWorld = 24 / k;
    const rad = (sample.robotHeading * Math.PI) / 180;

    const pFront = worldToCanvasPoint({
      x: sample.x + Math.cos(rad) * sizeWorld * 0.5,
      y: sample.y + Math.sin(rad) * sizeWorld * 0.5,
    });
    const pLeft = worldToCanvasPoint({
      x: sample.x + Math.cos(rad + Math.PI * 0.8) * sizeWorld * 0.5,
      y: sample.y + Math.sin(rad + Math.PI * 0.8) * sizeWorld * 0.5,
    });
    const pBack = worldToCanvasPoint({
      x: sample.x + Math.cos(rad + Math.PI) * sizeWorld * 0.1,
      y: sample.y + Math.sin(rad + Math.PI) * sizeWorld * 0.1,
    });
    const pRight = worldToCanvasPoint({
      x: sample.x + Math.cos(rad - Math.PI * 0.8) * sizeWorld * 0.5,
      y: sample.y + Math.sin(rad - Math.PI * 0.8) * sizeWorld * 0.5,
    });

    headingLines.push(
      <Line
        key={`heading-${path.id}-${index}`}
        points={[
          pFront.x,
          pFront.y,
          pLeft.x,
          pLeft.y,
          pBack.x,
          pBack.y,
          pRight.x,
          pRight.y,
        ]}
        closed
        fill={path.color}
        opacity={isActive ? 0.9 : 0.25}
        listening={false}
      />,
    );
    accumulatedDistance = 0;
  }

  return headingLines;
};

const renderVisibleSegments = (params: {
  path: ResolvedPathModel;
  geometrySegments: PathGeometrySegment[];
  k: number;
  isActive: boolean;
}): ReactElement[] => {
  const { path, geometrySegments, k, isActive } = params;

  return geometrySegments.map((segment, index) => {
    const renderData = toCanvasPathSegmentRenderData(segment);

    if (renderData.kind === 'line') {
      return (
        <Line
          key={`${path.id}-segment-line-${segment.sectionIndex}-${index}`}
          points={renderData.points}
          stroke={path.color}
          strokeWidth={(isActive ? 3 : 2) / k}
          opacity={isActive ? 0.5 : 0.4}
          lineJoin="round"
          lineCap="round"
          listening={false}
        />
      );
    }

    return (
      <Shape
        key={`${path.id}-segment-arc-${segment.sectionIndex}-${index}`}
        sceneFunc={(context, shape) => {
          context.beginPath();
          context.arc(
            renderData.center.x,
            renderData.center.y,
            renderData.radius,
            renderData.startAngle,
            renderData.endAngle,
            renderData.anticlockwise,
          );
          context.strokeShape(shape);
        }}
        stroke={path.color}
        strokeWidth={(isActive ? 3 : 2) / k}
        opacity={isActive ? 0.5 : 0.4}
        lineJoin="round"
        lineCap="round"
        listening={false}
      />
    );
  });
};

export const CanvasPath = ({
  path,
  geometrySegments,
  discretizedSamples,
  k,
  isActive,
  mode,
}: CanvasPathProps): ReactElement | null => {
  if (!path.visible) {
    return null;
  }

  const headingLines = buildHeadingLines({
    path,
    discretizedSamples,
    k,
    isActive,
    mode,
  });
  const visibleSegments = renderVisibleSegments({
    path,
    geometrySegments,
    k,
    isActive,
  });

  return (
    <>
      {visibleSegments}
      {discretizedSamples.length >= 2 ? headingLines : null}
    </>
  );
};
