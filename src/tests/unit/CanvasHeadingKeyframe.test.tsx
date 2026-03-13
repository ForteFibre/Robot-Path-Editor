import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  ResolvedHeadingKeyframe,
  ResolvedPathModel,
} from '../../domain/pointResolution';
import { CanvasHeadingKeyframe } from '../../features/canvas/components/CanvasHeadingKeyframe';

type KonvaTextMockProps = {
  text?: string;
  fontSize?: number;
  scaleX?: number;
  scaleY?: number;
  x?: number;
  y?: number;
};

const readKonvaTextMockProps = (props: unknown): KonvaTextMockProps => {
  return (props ?? {}) as KonvaTextMockProps;
};

vi.mock('react-konva', async () => {
  const React = await import('react');

  return {
    Group: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    Line: () => React.createElement('div', { 'data-testid': 'konva-line' }),
    Circle: () => React.createElement('div', { 'data-testid': 'konva-circle' }),
    Text: (props: unknown) => {
      const resolvedProps = readKonvaTextMockProps(props);

      return React.createElement('div', {
        'data-testid': 'konva-text',
        'data-text': resolvedProps.text ?? '',
        'data-font-size': resolvedProps.fontSize?.toString() ?? '',
        'data-scale-x': resolvedProps.scaleX?.toString() ?? '',
        'data-scale-y': resolvedProps.scaleY?.toString() ?? '',
        'data-x': resolvedProps.x?.toString() ?? '',
        'data-y': resolvedProps.y?.toString() ?? '',
      });
    },
  };
});

const path: ResolvedPathModel = {
  id: 'path-1',
  name: 'Path 1',
  color: '#2563eb',
  visible: true,
  waypoints: [],
  headingKeyframes: [],
  sectionRMin: [],
};

const headingKeyframe: ResolvedHeadingKeyframe = {
  id: 'hk-1',
  name: 'Heading 1',
  sectionIndex: 0,
  sectionRatio: 0.5,
  robotHeading: 180,
  x: 0,
  y: 0,
  pathHeading: 0,
};

describe('CanvasHeadingKeyframe', () => {
  it('renders heading label with zoom-invariant text scaling', () => {
    render(
      <CanvasHeadingKeyframe
        path={path}
        headingKeyframe={headingKeyframe}
        k={200}
        isSelected={false}
        mode="heading"
        isActive={true}
      />,
    );

    const label = screen.getByTestId('konva-text');

    expect(label).toHaveAttribute('data-text', 'Heading 1');
    expect(label).toHaveAttribute('data-font-size', '12');
    expect(Number(label.dataset.scaleX)).toBeCloseTo(1 / 200);
    expect(Number(label.dataset.scaleY)).toBeCloseTo(1 / 200);
  });

  it('keeps label screen offset constant across zoom levels', () => {
    const { rerender } = render(
      <CanvasHeadingKeyframe
        path={path}
        headingKeyframe={headingKeyframe}
        k={100}
        isSelected={false}
        mode="heading"
        isActive={true}
      />,
    );

    const labelAt100 = screen.getByTestId('konva-text');
    const xAt100 = Number(labelAt100.dataset.x);
    const yAt100 = Number(labelAt100.dataset.y);

    rerender(
      <CanvasHeadingKeyframe
        path={path}
        headingKeyframe={headingKeyframe}
        k={250}
        isSelected={false}
        mode="heading"
        isActive={true}
      />,
    );

    const labelAt250 = screen.getByTestId('konva-text');
    const xAt250 = Number(labelAt250.dataset.x);
    const yAt250 = Number(labelAt250.dataset.y);

    expect(xAt100 * 100).toBeCloseTo(8);
    expect(yAt100 * 100).toBeCloseTo(-8);
    expect(xAt250 * 250).toBeCloseTo(8);
    expect(yAt250 * 250).toBeCloseTo(-8);
  });
});
