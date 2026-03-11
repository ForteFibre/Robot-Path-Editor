import type {
  ResolvedPathModel,
  ResolvedWaypoint,
} from '../../../domain/pointResolution';
import type { Workspace } from '../../../domain/models';
import { type ReactElement } from 'react';
import { Circle, Group, Line, Text } from 'react-konva';
import { pointFromHeading, worldToCanvasPoint } from '../../../domain/geometry';
import { getHeadingHandleDistance } from '../../../domain/canvas';

type CanvasWaypointProps = {
  path: ResolvedPathModel;
  waypoint: ResolvedWaypoint;
  k: number;
  isSelected: boolean;
  isBreak: boolean;
  isCoordinateLocked: boolean;
  mode: Workspace['mode'];
  isActive: boolean;
  isPreview?: boolean;
  interpolatedRobotHeading?: number;
};

const resolveWaypointFill = (
  isSelected: boolean,
  isLibraryLinked: boolean,
): string => {
  if (isSelected) {
    return '#111827';
  }

  if (isLibraryLinked) {
    return '#f5f3ff';
  }

  return '#ffffff';
};

const renderLibraryLinkRing = (params: {
  isLibraryLinked: boolean;
  isSelected: boolean;
  x: number;
  y: number;
  k: number;
}): ReactElement | null => {
  const { isLibraryLinked, isSelected, x, y, k } = params;

  if (!isLibraryLinked) {
    return null;
  }

  return (
    <Circle
      x={x}
      y={y}
      radius={(isSelected ? 10 : 8) / k}
      stroke="#7c3aed"
      strokeWidth={1.5 / k}
      listening={false}
    />
  );
};

const renderRobotHeadingOverlay = (params: {
  isPreview: boolean;
  waypointCanvasPoint: { x: number; y: number };
  robotHeadingHandleCanvasPoint: { x: number; y: number };
  robotHeadingLineProps: { dash?: number[] };
  mode: Workspace['mode'];
  k: number;
}): ReactElement | null => {
  const {
    isPreview,
    waypointCanvasPoint,
    robotHeadingHandleCanvasPoint,
    robotHeadingLineProps,
    mode,
    k,
  } = params;

  if (isPreview) {
    return null;
  }

  return (
    <>
      <Line
        points={[
          waypointCanvasPoint.x,
          waypointCanvasPoint.y,
          robotHeadingHandleCanvasPoint.x,
          robotHeadingHandleCanvasPoint.y,
        ]}
        stroke="#16a34a"
        strokeWidth={2 / k}
        {...robotHeadingLineProps}
        listening={false}
      />

      <Circle
        x={robotHeadingHandleCanvasPoint.x}
        y={robotHeadingHandleCanvasPoint.y}
        radius={5 / k}
        fill="#16a34a"
        opacity={mode === 'heading' ? 1 : 0.35}
        listening={false}
      />
    </>
  );
};

export const CanvasWaypoint = ({
  path,
  waypoint,
  k,
  isSelected,
  isBreak,
  isCoordinateLocked: _isCoordinateLocked,
  mode,
  isActive,
  isPreview = false,
  interpolatedRobotHeading,
}: CanvasWaypointProps): ReactElement | null => {
  const isLibraryLinked = waypoint.libraryPoint !== null;
  const waypointFill = resolveWaypointFill(isSelected, isLibraryLinked);
  const waypointStroke = isLibraryLinked ? '#7c3aed' : path.color;

  if (!isActive) {
    const inactiveCanvasPoint = worldToCanvasPoint(waypoint);
    return (
      <Circle
        x={inactiveCanvasPoint.x}
        y={inactiveCanvasPoint.y}
        radius={4 / k}
        fill={isLibraryLinked ? '#8b5cf6' : path.color}
        opacity={0.8}
        listening={false}
      />
    );
  }

  const previewOpacity = isPreview ? 0.5 : 1;

  const headingHandleDistance = getHeadingHandleDistance(k);
  const waypointCanvasPoint = worldToCanvasPoint(waypoint);

  const pathHeadingHandle = pointFromHeading(
    waypoint,
    waypoint.pathHeading,
    headingHandleDistance,
  );
  const pathHeadingHandleCanvasPoint = worldToCanvasPoint(pathHeadingHandle);

  const effectiveRobotHeading =
    interpolatedRobotHeading ?? waypoint.pathHeading;
  const robotHeadingHandle = pointFromHeading(
    waypoint,
    effectiveRobotHeading,
    headingHandleDistance,
  );
  const robotHeadingHandleCanvasPoint = worldToCanvasPoint(robotHeadingHandle);
  const robotHeadingLineProps =
    waypoint.point.robotHeading === null ? { dash: [4 / k, 2 / k] } : {};

  return (
    <Group listening={false} opacity={previewOpacity}>
      {renderLibraryLinkRing({
        isLibraryLinked,
        isSelected,
        x: waypointCanvasPoint.x,
        y: waypointCanvasPoint.y,
        k,
      })}

      <Circle
        x={waypointCanvasPoint.x}
        y={waypointCanvasPoint.y}
        radius={(isSelected ? 8 : 6) / k}
        fill={waypointFill}
        stroke={waypointStroke}
        strokeWidth={2 / k}
      />

      <Text
        x={waypointCanvasPoint.x + 8 / k}
        y={waypointCanvasPoint.y - 8 / k}
        fontSize={12 / k}
        fill="#111827"
        text={waypoint.name}
        listening={false}
      />

      <Line
        points={[
          waypointCanvasPoint.x,
          waypointCanvasPoint.y,
          pathHeadingHandleCanvasPoint.x,
          pathHeadingHandleCanvasPoint.y,
        ]}
        stroke="#0ea5e9"
        strokeWidth={2 / k}
        listening={false}
      />

      <Circle
        x={pathHeadingHandleCanvasPoint.x}
        y={pathHeadingHandleCanvasPoint.y}
        radius={5 / k}
        fill="#0ea5e9"
        opacity={mode === 'path' ? 1 : 0.35}
        listening={false}
      />

      {renderRobotHeadingOverlay({
        isPreview,
        waypointCanvasPoint,
        robotHeadingHandleCanvasPoint,
        robotHeadingLineProps,
        mode,
        k,
      })}

      {isBreak ? (
        <Text
          x={waypointCanvasPoint.x + 12 / k}
          y={waypointCanvasPoint.y + 12 / k}
          fontSize={12 / k}
          fill="#b91c1c"
          text="⚠ break"
          listening={false}
        />
      ) : null}
    </Group>
  );
};
