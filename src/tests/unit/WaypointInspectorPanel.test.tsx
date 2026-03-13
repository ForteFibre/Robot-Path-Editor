import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ResolvedPathModel } from '../../domain/pointResolution';
import type { WaypointSelection } from '../../features/floating/floatingInspectorModel';
import { WaypointInspectorPanel } from '../../features/floating/WaypointInspectorPanel';

const makePoint = (id: string) => ({
  id,
  x: 1,
  y: 2,
  robotHeading: null as number | null,
  isLibrary: false,
  name: id,
});

const mockWaypoint: WaypointSelection = {
  id: 'wp1',
  pointId: 'p1',
  libraryPointId: null,
  pathHeading: 0,
  point: makePoint('p1'),
  libraryPoint: null,
  name: 'WP 1',
  x: 1,
  y: 2,
  interpolatedRobotHeading: 0,
  linkedWaypointCount: 0,
};

const mockPath: ResolvedPathModel = {
  id: 'path1',
  name: 'Test Path',
  color: '#ff0000',
  visible: true,
  waypoints: [mockWaypoint],
  headingKeyframes: [],
  sectionRMin: [],
};

const defaultProps = {
  style: {},
  path: mockPath,
  waypoint: mockWaypoint,
  isLibraryPointLocked: false,
  setSelectedLibraryPointId: vi.fn(),
  addLibraryPointFromSelection: vi.fn(),
  deleteWaypoint: vi.fn(),
  unlinkWaypointPoint: vi.fn(),
  updateWaypoint: vi.fn(),
};

describe('WaypointInspectorPanel', () => {
  it('renders the waypoint properties panel', () => {
    render(<WaypointInspectorPanel {...defaultProps} />);
    expect(screen.getByLabelText('waypoint properties')).toBeInTheDocument();
  });

  it('displays the path and waypoint name in the header', () => {
    render(<WaypointInspectorPanel {...defaultProps} />);
    expect(screen.getByText('Waypoint Inspector')).toBeInTheDocument();
    expect(screen.getByText('Test Path / WP 1')).toBeInTheDocument();
  });

  it('renders the waypoint name input', () => {
    render(<WaypointInspectorPanel {...defaultProps} />);
    expect(
      screen.getByRole('textbox', { name: 'waypoint name' }),
    ).toBeInTheDocument();
  });

  it('clicking delete waypoint calls deleteWaypoint with correct args', () => {
    const deleteWaypoint = vi.fn();
    render(
      <WaypointInspectorPanel
        {...defaultProps}
        deleteWaypoint={deleteWaypoint}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'delete waypoint' }));
    expect(deleteWaypoint).toHaveBeenCalledWith('path1', 'wp1');
  });

  it('calls updateWaypoint when name input changes', () => {
    const updateWaypoint = vi.fn();
    render(
      <WaypointInspectorPanel
        {...defaultProps}
        updateWaypoint={updateWaypoint}
      />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'waypoint name' }), {
      target: { value: 'New Name' },
    });
    expect(updateWaypoint).toHaveBeenCalledWith('path1', 'wp1', {
      name: 'New Name',
    });
  });

  it('shows "Save to Library" button for non-library waypoints', () => {
    render(<WaypointInspectorPanel {...defaultProps} />);
    expect(
      screen.getByRole('button', { name: 'save to library' }),
    ).toBeInTheDocument();
  });

  it('x and y inputs are disabled when library point is locked', () => {
    render(
      <WaypointInspectorPanel {...defaultProps} isLibraryPointLocked={true} />,
    );
    expect(
      screen.getByRole('spinbutton', { name: 'waypoint x' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('spinbutton', { name: 'waypoint y' }),
    ).toBeDisabled();
  });
});
