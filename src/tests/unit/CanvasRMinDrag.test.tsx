import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CanvasRMinDrag } from '../../features/canvas/components/CanvasRMinDrag';

type KonvaCircleMockProps = {
  radius?: number;
};

const readKonvaCircleMockProps = (props: unknown): KonvaCircleMockProps => {
  return (props ?? {}) as KonvaCircleMockProps;
};

vi.mock('react-konva', async () => {
  const React = await import('react');

  return {
    Circle: (props: unknown) => {
      const resolvedProps = readKonvaCircleMockProps(props);

      return React.createElement('div', {
        'data-testid': 'konva-circle',
        'data-radius': resolvedProps.radius?.toString() ?? '',
      });
    },
    Line: () => React.createElement('div', { 'data-testid': 'konva-line' }),
    Text: () => React.createElement('div', { 'data-testid': 'konva-text' }),
  };
});

describe('CanvasRMinDrag', () => {
  it('passes Konva Circle radius props so the rMin handle renders', () => {
    render(
      <CanvasRMinDrag
        rMinDragTarget={{
          pathId: 'path-1',
          sectionIndex: 0,
          center: { x: 0, y: 0 },
          waypointPoint: { x: 1, y: 0 },
          rMin: 2,
          isAuto: false,
        }}
        k={1}
      />,
    );

    const circles = screen.getAllByTestId('konva-circle');

    expect(circles).toHaveLength(2);
    expect(circles[0]).toHaveAttribute('data-radius', '2');
    expect(circles[1]).toHaveAttribute('data-radius', '5');
  });
});
