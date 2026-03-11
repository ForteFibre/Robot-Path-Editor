import { memo, type ReactElement } from 'react';
import type { RobotMotionSettings } from '../../../domain/models';
import type { PathTiming, TimedPathPose } from '../../../domain/pathTiming';
import { CanvasRobot } from './CanvasRobot';

type CanvasRobotLayerProps = {
  timing: PathTiming | null;
  pose: TimedPathPose | null;
  robotSettings: RobotMotionSettings;
  color: string | null;
  k: number;
  enabled: boolean;
};

const CanvasRobotLayerComponent = ({
  timing,
  pose,
  robotSettings,
  color,
  k,
  enabled,
}: CanvasRobotLayerProps): ReactElement | null => {
  if (
    !enabled ||
    timing === null ||
    color === null ||
    timing.samples.length === 0 ||
    pose === null
  ) {
    return null;
  }

  return (
    <CanvasRobot
      pose={pose}
      robotSettings={robotSettings}
      color={color}
      k={k}
    />
  );
};

export const CanvasRobotLayer = memo(CanvasRobotLayerComponent);
