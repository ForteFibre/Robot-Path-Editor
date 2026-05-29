import { memo, type ReactElement } from 'react';
import { Group, Layer } from 'react-konva';
import type { CanvasTransform } from '../../../domain/canvasTransform';
import type { RobotMotionSettings } from '../../../domain/models';
import type { PathTiming } from '../../../domain/pathTiming';
import { usePathAnimation } from '../hooks/usePathAnimation';
import { CanvasRobotLayer } from './CanvasRobotLayer';

type CanvasRobotAnimationLayerProps = {
  timing: PathTiming | null;
  enabled: boolean;
  robotSettings: RobotMotionSettings;
  color: string | null;
  k: number;
  canvasTransform: CanvasTransform;
};

const CanvasRobotAnimationLayerComponent = ({
  timing,
  enabled,
  robotSettings,
  color,
  k,
  canvasTransform,
}: CanvasRobotAnimationLayerProps): ReactElement => {
  const robotAnimation = usePathAnimation(timing, enabled);

  return (
    <Layer listening={false}>
      <Group
        x={canvasTransform.x}
        y={canvasTransform.y}
        scaleX={k}
        scaleY={k}
        listening={false}
      >
        <CanvasRobotLayer
          timing={timing}
          pose={robotAnimation.pose}
          robotSettings={robotSettings}
          color={color}
          k={k}
          enabled={enabled}
        />
      </Group>
    </Layer>
  );
};

export const CanvasRobotAnimationLayer = memo(
  CanvasRobotAnimationLayerComponent,
);
