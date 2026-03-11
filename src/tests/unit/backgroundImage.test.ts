import {
  moveBackgroundImageAnchorByScreenDelta,
  toBackgroundImageCanvasOrigin,
  toBackgroundImageCanvasRenderState,
  toBackgroundImageWorldDeltaFromScreenDelta,
} from '../../domain/backgroundImage';

describe('background image geometry', () => {
  it('converts world origin to canvas origin in ROS x-up/y-left coordinates', () => {
    expect(toBackgroundImageCanvasOrigin({ x: 4, y: -3 })).toEqual({
      x: 3,
      y: -4,
    });
  });

  it('renders the image from a bottom-left world origin with 90 degree rotation', () => {
    expect(
      toBackgroundImageCanvasRenderState({
        url: 'data:image/png;base64,dGVzdA==',
        width: 100,
        height: 50,
        x: 1,
        y: 2,
        scale: 1,
        alpha: 0.5,
      }),
    ).toEqual({
      width: 100,
      height: 50,
      transform: 'matrix(0 -1 1 0 -52 -1)',
    });
  });

  it('maps screen drag delta to world delta using ROS axes', () => {
    expect(
      toBackgroundImageWorldDeltaFromScreenDelta({ x: 40, y: 0 }, 20),
    ).toEqual({
      x: 0,
      y: -2,
    });

    expect(
      toBackgroundImageWorldDeltaFromScreenDelta({ x: 0, y: -60 }, 20),
    ).toEqual({
      x: 3,
      y: 0,
    });
  });

  it('moves image anchor with consistent world-axis updates', () => {
    expect(
      moveBackgroundImageAnchorByScreenDelta(
        { x: 1, y: 2 },
        { x: 20, y: -40 },
        20,
      ),
    ).toEqual({
      x: 3,
      y: 1,
    });
  });
});
