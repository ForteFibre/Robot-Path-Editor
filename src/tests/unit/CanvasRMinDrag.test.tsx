import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CanvasRMinDrag } from '../../features/canvas/components/CanvasRMinDrag';

type KonvaCircleMockProps = {
  radius?: number;
};

type KonvaTextMockProps = {
  text?: string;
  fontSize?: number;
  scaleX?: number;
  scaleY?: number;
  offsetY?: number;
};

const readKonvaCircleMockProps = (props: unknown): KonvaCircleMockProps => {
  return (props ?? {}) as KonvaCircleMockProps;
};

const readKonvaTextMockProps = (props: unknown): KonvaTextMockProps => {
  return (props ?? {}) as KonvaTextMockProps;
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
    Text: (props: unknown) => {
      const resolvedProps = readKonvaTextMockProps(props);

      return React.createElement('div', {
        'data-testid': 'konva-text',
        'data-text': resolvedProps.text ?? '',
        'data-font-size': resolvedProps.fontSize?.toString() ?? '',
        'data-scale-x': resolvedProps.scaleX?.toString() ?? '',
        'data-scale-y': resolvedProps.scaleY?.toString() ?? '',
        'data-offset-y': resolvedProps.offsetY?.toString() ?? '',
      });
    },
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

  it('renders label text with zoom-invariant scaling', () => {
    render(
      <CanvasRMinDrag
        rMinDragTarget={{
          pathId: 'path-1',
          sectionIndex: 0,
          center: { x: 0, y: 0 },
          waypointPoint: { x: 1, y: 0 },
          rMin: 2,
          isAuto: true,
        }}
        k={250}
      />,
    );

    const label = screen.getByTestId('konva-text');

    expect(label.dataset.text).toContain('r: Auto(');
    expect(label).toHaveAttribute('data-font-size', '12');
    expect(Number(label.dataset.scaleX)).toBeCloseTo(1 / 250);
    expect(Number(label.dataset.scaleY)).toBeCloseTo(1 / 250);
    expect(label).toHaveAttribute('data-offset-y', '6');
  });
});
