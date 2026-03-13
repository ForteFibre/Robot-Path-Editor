import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PathDetailsPanelPresenter } from '../../features/path-details/PathDetailsPanelPresenter';
import type { PathItem } from '../../features/path-details/pathDetailsModel';

const makePoint = (id: string, x = 0, y = 0) => ({
  id,
  x,
  y,
  robotHeading: null as number | null,
  isLibrary: false,
  name: id,
});

const makeResolvedWaypoint = (id: string, x = 0, y = 0) => ({
  id,
  pointId: `p_${id}`,
  libraryPointId: null as string | null,
  pathHeading: 0,
  point: makePoint(`p_${id}`, x, y),
  libraryPoint: null,
  name: id,
  x,
  y,
});

const makeWaypointItem = (
  id: string,
  index: number,
): Extract<PathItem, { type: 'waypoint' }> => ({
  type: 'waypoint',
  id,
  index,
  data: makeResolvedWaypoint(id),
  timing: null,
});

const defaultProps = {
  pathName: 'Test Path',
  totalTime: 5.5,
  sequentialItems: [makeWaypointItem('w1', 0), makeWaypointItem('w2', 1)],
  selectionWaypointId: null,
  selectionHeadingKeyframeId: null,
  onSelectItem: vi.fn(),
  onDragEnd: vi.fn(),
};

describe('PathDetailsPanelPresenter', () => {
  it('renders the path details sidebar', () => {
    render(<PathDetailsPanelPresenter {...defaultProps} />);
    expect(screen.getByLabelText('path details sidebar')).toBeInTheDocument();
  });

  it('displays the path name', () => {
    render(<PathDetailsPanelPresenter {...defaultProps} />);
    expect(screen.getByText('Test Path')).toBeInTheDocument();
  });

  it('displays the total time', () => {
    render(<PathDetailsPanelPresenter {...defaultProps} />);
    expect(screen.getByText(/Total 5\.5 s/)).toBeInTheDocument();
  });

  it('renders empty state message when no items', () => {
    render(
      <PathDetailsPanelPresenter {...defaultProps} sequentialItems={[]} />,
    );
    expect(
      screen.getByText(/このパスにはポイントがありません/),
    ).toBeInTheDocument();
  });

  it('renders a list of path elements', () => {
    render(<PathDetailsPanelPresenter {...defaultProps} />);
    expect(screen.getByLabelText('Path elements')).toBeInTheDocument();
    expect(screen.getByLabelText('Select waypoint w1')).toBeInTheDocument();
    expect(screen.getByLabelText('Select waypoint w2')).toBeInTheDocument();
  });

  it('marks the selected waypoint as active', () => {
    render(
      <PathDetailsPanelPresenter {...defaultProps} selectionWaypointId="w1" />,
    );
    const btn = screen.getByLabelText('Select waypoint w1');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onSelectItem when clicking a waypoint', () => {
    const onSelectItem = vi.fn();
    render(
      <PathDetailsPanelPresenter
        {...defaultProps}
        onSelectItem={onSelectItem}
      />,
    );
    fireEvent.click(screen.getByLabelText('Select waypoint w2'));
    expect(onSelectItem).toHaveBeenCalledOnce();
    expect(onSelectItem.mock.calls[0]?.[0]).toMatchObject({
      id: 'w2',
      type: 'waypoint',
    });
  });
});
