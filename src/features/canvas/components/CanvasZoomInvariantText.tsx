import { type ReactElement } from 'react';
import type { TextConfig } from 'konva/lib/shapes/Text';
import { Text } from 'react-konva';

type CanvasZoomInvariantTextProps = Omit<
  TextConfig,
  'fontSize' | 'scaleX' | 'scaleY'
> & {
  k: number;
  fontSize?: number;
};

export const CanvasZoomInvariantText = ({
  k,
  fontSize = 12,
  ...textProps
}: CanvasZoomInvariantTextProps): ReactElement => {
  return (
    <Text {...textProps} fontSize={fontSize} scaleX={1 / k} scaleY={1 / k} />
  );
};
