import type {
  ResolvedPathModel,
  ResolvedWaypoint,
} from '../../../domain/pointResolution';
import type { EditorMode } from '../../../domain/models';
import { type ReactElement } from 'react';
import { Circle, Group, Line } from 'react-konva';
import { pointFromHeading, worldToCanvasPoint } from '../../../domain/geometry';
import { getHeadingHandleDistance } from '../../../domain/canvas';
import { canvasTheme } from '../canvasTheme';
import { CanvasZoomInvariantText } from './CanvasZoomInvariantText';

type CanvasWaypointProps = {
  path: ResolvedPathModel;
  waypoint: ResolvedWaypoint;
  k: number;
  isSelected: boolean;
  isBreak: boolean;
  isCoordinateLocked: boolean;
  mode: EditorMode;
  isActive: boolean;
  isPreview?: boolean;
  interpolatedRobotHeading?: number;
};

const resolveWaypointFill = (
  isSelected: boolean,
  isLibraryLinked: boolean,
): string => {
  if (isSelected) {
    return canvasTheme.waypoint.selectedFill;
  }

  if (isLibraryLinked) {
    return canvasTheme.waypoint.libraryLinkedFill;
  }

  return canvasTheme.waypoint.defaultFill;
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
      stroke={canvasTheme.waypoint.libraryLinkedStroke}
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
  mode: EditorMode;
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
        stroke={canvasTheme.waypoint.robotHeadingStroke}
        strokeWidth={2 / k}
        {...robotHeadingLineProps}
        listening={false}
      />

      <Circle
        x={robotHeadingHandleCanvasPoint.x}
        y={robotHeadingHandleCanvasPoint.y}
        radius={5 / k}
        fill={canvasTheme.waypoint.robotHeadingStroke}
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
  const waypointStroke = isLibraryLinked
    ? canvasTheme.waypoint.libraryLinkedStroke
    : path.color;

  if (!isActive) {
    const inactiveCanvasPoint = worldToCanvasPoint(waypoint);
    return (
      <Circle
        x={inactiveCanvasPoint.x}
        y={inactiveCanvasPoint.y}
        radius={4 / k}
        fill={
          isLibraryLinked
            ? canvasTheme.waypoint.inactiveLibraryLinkedFill
            : path.color
        }
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

      <CanvasZoomInvariantText
        k={k}
        x={waypointCanvasPoint.x + 8 / k}
        y={waypointCanvasPoint.y - 8 / k}
        fontSize={12}
        fill={canvasTheme.waypoint.labelFill}
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
        stroke={canvasTheme.waypoint.pathHeadingStroke}
        strokeWidth={2 / k}
        listening={false}
      />

      <Circle
        x={pathHeadingHandleCanvasPoint.x}
        y={pathHeadingHandleCanvasPoint.y}
        radius={5 / k}
        fill={canvasTheme.waypoint.pathHeadingStroke}
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
        <CanvasZoomInvariantText
          k={k}
          x={waypointCanvasPoint.x + 12 / k}
          y={waypointCanvasPoint.y + 12 / k}
          fontSize={12}
          fill={canvasTheme.waypoint.breakLabelFill}
          text="⚠ break"
          listening={false}
        />
      ) : null}
    </Group>
  );
};
