import type { Point } from './geometry';
import { worldToCanvasPoint } from './geometry';
import type { BackgroundImage } from './models';

type BackgroundImageAnchor = Pick<BackgroundImage, 'x' | 'y'>;

export type BackgroundImageRenderState = {
  width: number;
  height: number;
  transform: string;
};

const normalizeSignedZero = (value: number): number => {
  return Object.is(value, -0) ? 0 : value;
};

export const toBackgroundImageCanvasOrigin = (
  image: BackgroundImageAnchor,
): Point => {
  return worldToCanvasPoint({ x: image.x, y: image.y });
};

export const toBackgroundImageCanvasRenderState = (
  image: BackgroundImage,
): BackgroundImageRenderState => {
  const origin = toBackgroundImageCanvasOrigin(image);
  const width = image.width * image.scale;
  const height = image.height * image.scale;

  return {
    width,
    height,
    transform: `matrix(0 -1 1 0 ${normalizeSignedZero(origin.x - height)} ${origin.y})`,
  };
};

export const toBackgroundImageWorldDeltaFromScreenDelta = (
  screenDelta: Point,
  canvasScale: number,
): Point => {
  return {
    x: normalizeSignedZero(-screenDelta.y / canvasScale),
    y: normalizeSignedZero(-screenDelta.x / canvasScale),
  };
};

export const moveBackgroundImageAnchorByScreenDelta = (
  anchor: BackgroundImageAnchor,
  screenDelta: Point,
  canvasScale: number,
): BackgroundImageAnchor => {
  const worldDelta = toBackgroundImageWorldDeltaFromScreenDelta(
    screenDelta,
    canvasScale,
  );

  return {
    x: anchor.x + worldDelta.x,
    y: anchor.y + worldDelta.y,
  };
};
