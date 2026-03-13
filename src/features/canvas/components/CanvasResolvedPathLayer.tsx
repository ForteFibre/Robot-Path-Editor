import { type ReactElement } from 'react';
import { Group, Line } from 'react-konva';
import {
  buildHeadingKeyframeRanges,
  getHeadingKeyframeRangePolyline,
  resolveDiscretizedHeadingKeyframes,
} from '../../../domain/interpolation';
import { worldToCanvasPoint, type Point } from '../../../domain/geometry';
import { resolveWaypointRobotHeadingHandleAngle } from '../waypointHeading';
import type { RMinDragTarget } from '../types/rMinDragTarget';
import { CanvasHeadingKeyframe } from './CanvasHeadingKeyframe';
import { CanvasPath } from './CanvasPath';
import { CanvasRMinDrag } from './CanvasRMinDrag';
import { CanvasWaypoint } from './CanvasWaypoint';
import type { EditorMode } from '../../../domain/models';
import type { CanvasSceneVisiblePath } from '../hooks/canvasScene/types';

const toCanvasPointNumbers = (polyline: Point[]): number[] => {
  return polyline.flatMap((point) => {
    const canvasPoint = worldToCanvasPoint(point);
    return [canvasPoint.x, canvasPoint.y];
  });
};

type CanvasResolvedPathLayerProps = {
  visiblePath: CanvasSceneVisiblePath;
  mode: EditorMode;
  k: number;
  rMinDragTargets: RMinDragTarget[];
};

export const CanvasResolvedPathLayer = ({
  visiblePath,
  mode,
  k,
  rMinDragTargets,
}: CanvasResolvedPathLayerProps): ReactElement => {
  const {
    path,
    detail,
    geometrySegments,
    selection,
    lockedPointIds,
    isActive,
  } = visiblePath;
  const resolvedHeadingKeyframes =
    detail === undefined
      ? []
      : resolveDiscretizedHeadingKeyframes(path, detail);
  const headingRanges = buildHeadingKeyframeRanges(resolvedHeadingKeyframes);

  return (
    <Group listening={false}>
      <CanvasPath
        path={path}
        geometrySegments={geometrySegments}
        discretizedSamples={detail?.samples ?? []}
        k={k}
        isActive={isActive}
        mode={mode}
      />

      {path.waypoints.map((waypoint, waypointIndex) => (
        <CanvasWaypoint
          key={waypoint.id}
          path={path}
          waypoint={waypoint}
          k={k}
          isSelected={
            selection.pathId === path.id && selection.waypointId === waypoint.id
          }
          isBreak={false}
          isCoordinateLocked={
            waypoint.libraryPointId !== null &&
            lockedPointIds.includes(waypoint.libraryPointId)
          }
          mode={mode}
          isActive={isActive}
          interpolatedRobotHeading={resolveWaypointRobotHeadingHandleAngle(
            path,
            detail,
            waypointIndex,
          )}
        />
      ))}

      {headingRanges.map((range, index) => {
        if (detail === undefined) {
          return null;
        }

        const rangePolyline = getHeadingKeyframeRangePolyline(detail, range);
        if (rangePolyline.length < 2) {
          return null;
        }

        return (
          <Line
            key={`${path.id}-heading-keyframe-range-${index}`}
            points={toCanvasPointNumbers(rangePolyline)}
            stroke="#16a34a"
            strokeWidth={1.5 / k}
            dash={[4 / k, 2 / k]}
            lineJoin="round"
            lineCap="round"
            opacity={mode === 'heading' ? 0.65 : 0.2}
            listening={false}
          />
        );
      })}

      {resolvedHeadingKeyframes.map((headingKeyframe) => (
        <CanvasHeadingKeyframe
          key={headingKeyframe.id}
          path={path}
          headingKeyframe={headingKeyframe}
          k={k}
          isSelected={
            selection.pathId === path.id &&
            selection.headingKeyframeId === headingKeyframe.id
          }
          mode={mode}
          isActive={isActive}
        />
      ))}

      {rMinDragTargets
        .filter((target) => target.pathId === path.id && isActive)
        .map((target, index) => (
          <CanvasRMinDrag
            key={`rmin-${target.pathId}-${target.sectionIndex}-${index}`}
            rMinDragTarget={target}
            k={k}
          />
        ))}
    </Group>
  );
};
