import type { ReactElement } from 'react';
import { Circle, Group, Line, Rect } from 'react-konva';
import { worldToCanvasPoint } from '../../../domain/geometry';
import type { RobotMotionSettings } from '../../../domain/models';
import type { TimedPathPose } from '../../../domain/pathTiming';
import { canvasTheme } from '../canvasTheme';

type CanvasRobotProps = {
  pose: TimedPathPose;
  robotSettings: RobotMotionSettings;
  color: string;
  k: number;
};

const toCanvasHeadingDeg = (headingDeg: number): number => {
  return -(headingDeg + 90);
};

export const CanvasRobot = ({
  pose,
  robotSettings,
  color,
  k,
}: CanvasRobotProps): ReactElement => {
  const center = worldToCanvasPoint(pose);
  const bodyLength = robotSettings.length;
  const bodyWidth = robotSettings.width;
  const noseLength = Math.max(0.08, bodyLength * 0.22);
  const cornerRadius = Math.min(bodyLength, bodyWidth) * 0.18;
  const strokeWidth = 2 / k;
  const nosePoints = [
    bodyLength / 2,
    0,
    bodyLength / 2 - noseLength,
    bodyWidth * 0.28,
    bodyLength / 2 - noseLength,
    -bodyWidth * 0.28,
  ];

  return (
    <Group
      x={center.x}
      y={center.y}
      rotation={toCanvasHeadingDeg(pose.robotHeading)}
      listening={false}
    >
      <Rect
        x={-bodyLength / 2}
        y={-bodyWidth / 2}
        width={bodyLength}
        height={bodyWidth}
        rx={cornerRadius}
        ry={cornerRadius}
        fill={canvasTheme.robot.bodyFill}
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Line points={nosePoints} closed fill={color} opacity={0.9} />
      <Line
        points={[-bodyLength * 0.15, 0, bodyLength * 0.32, 0]}
        stroke={color}
        strokeWidth={strokeWidth}
        lineCap="round"
      />
      <Circle
        x={-bodyLength * 0.18}
        y={0}
        radius={Math.max(0.04, bodyWidth * 0.12)}
        fill={color}
        opacity={0.25}
      />
    </Group>
  );
};
