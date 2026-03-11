import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  ResolvedPathModel,
  ResolvedWaypoint,
} from '../../domain/pointResolution';
import { CanvasWaypoint } from '../../features/canvas/components/CanvasWaypoint';

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
    Group: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    Line: () => React.createElement('div', { 'data-testid': 'konva-line' }),
    Text: () => React.createElement('div', { 'data-testid': 'konva-text' }),
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

const waypoint: ResolvedWaypoint = {
  id: 'wp-1',
  pointId: 'pt-1',
  libraryPointId: null,
  name: 'WP 1',
  pathHeading: 0,
  point: {
    id: 'pt-1',
    x: 1,
    y: 2,
    robotHeading: 0,
    isLibrary: false,
    name: 'WP 1',
  },
  libraryPoint: null,
  x: 1,
  y: 2,
};

describe('CanvasWaypoint', () => {
  it('passes Konva Circle radius props so waypoint and handles render', () => {
    render(
      <CanvasWaypoint
        path={path}
        waypoint={waypoint}
        k={1}
        isSelected={false}
        isBreak={false}
        isCoordinateLocked={false}
        mode="path"
        isActive={true}
      />,
    );

    const circles = screen.getAllByTestId('konva-circle');

    expect(circles).toHaveLength(3);
    expect(circles[0]).toHaveAttribute('data-radius', '6');
    expect(circles[1]).toHaveAttribute('data-radius', '5');
    expect(circles[2]).toHaveAttribute('data-radius', '5');
  });
});
