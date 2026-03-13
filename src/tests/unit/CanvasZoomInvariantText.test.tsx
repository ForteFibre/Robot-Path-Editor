import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CanvasZoomInvariantText } from '../../features/canvas/components/CanvasZoomInvariantText';

type KonvaTextMockProps = {
  text?: string;
  fontSize?: number;
  scaleX?: number;
  scaleY?: number;
};

const readKonvaTextMockProps = (props: unknown): KonvaTextMockProps => {
  return (props ?? {}) as KonvaTextMockProps;
};

vi.mock('react-konva', async () => {
  const React = await import('react');

  return {
    Text: (props: unknown) => {
      const resolvedProps = readKonvaTextMockProps(props);

      return React.createElement('div', {
        'data-testid': 'konva-text',
        'data-text': resolvedProps.text ?? '',
        'data-font-size': resolvedProps.fontSize?.toString() ?? '',
        'data-scale-x': resolvedProps.scaleX?.toString() ?? '',
        'data-scale-y': resolvedProps.scaleY?.toString() ?? '',
      });
    },
  };
});

describe('CanvasZoomInvariantText', () => {
  it('uses fixed default font size and cancels parent zoom scale', () => {
    render(<CanvasZoomInvariantText k={200} x={10} y={20} text="WP" />);

    const text = screen.getByTestId('konva-text');

    expect(text).toHaveAttribute('data-text', 'WP');
    expect(text).toHaveAttribute('data-font-size', '12');
    expect(Number(text.dataset.scaleX)).toBeCloseTo(1 / 200);
    expect(Number(text.dataset.scaleY)).toBeCloseTo(1 / 200);
  });

  it('respects explicit font size while keeping zoom cancelation', () => {
    render(
      <CanvasZoomInvariantText
        k={80}
        x={10}
        y={20}
        text="guide"
        fontSize={16}
      />,
    );

    const text = screen.getByTestId('konva-text');

    expect(text).toHaveAttribute('data-font-size', '16');
    expect(Number(text.dataset.scaleX)).toBeCloseTo(1 / 80);
    expect(Number(text.dataset.scaleY)).toBeCloseTo(1 / 80);
  });
});
