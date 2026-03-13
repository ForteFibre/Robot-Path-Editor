import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import App from '../../App';
import { useWorkspaceStore } from '../../store/workspaceStore';
import {
  addLibraryPointToPath,
  getCanvas,
  getSelectedWaypointPointState,
  getSelectedWaypointScreenPoint,
  setupIntegrationTestLifecycle,
} from './helpers';

setupIntegrationTestLifecycle();

describe('App point library integration', () => {
  it('adds a library point to the active path tail', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    const canvas = getCanvas();
    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 240,
      clientY: 170,
      pointerId: 1,
    });
    fireEvent.pointerUp(canvas, {
      button: 0,
      clientX: 240,
      clientY: 170,
      pointerId: 1,
    });
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 360,
      clientY: 170,
      pointerId: 1,
    });
    fireEvent.pointerUp(canvas, {
      button: 0,
      clientX: 360,
      clientY: 170,
      pointerId: 1,
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Select waypoint WP 1' }),
    );

    addLibraryPointToPath('Slow Turn');

    const activePath = useWorkspaceStore.getState().domain.paths[0];
    const insertedWaypoint = activePath?.waypoints.at(-1);
    const insertedPoint = useWorkspaceStore
      .getState()
      .domain.points.find((point) => point.id === insertedWaypoint?.pointId);

    expect(activePath?.waypoints).toHaveLength(3);
    expect(insertedWaypoint?.libraryPointId).not.toBeNull();
    expect(insertedPoint?.name).toBe('Slow Turn');
  });

  it('supports insertion from point library via add button', async () => {
    render(<App />);

    const addButton = screen.getByLabelText(/insert slow turn into path/i);
    const slowTurn = useWorkspaceStore
      .getState()
      .domain.points.find(
        (point) => point.isLibrary && point.name === 'Slow Turn',
      );

    fireEvent.click(addButton);

    await waitFor(() => {
      const { waypoint, point } = getSelectedWaypointPointState();
      expect(point.x).toBeCloseTo(slowTurn?.x ?? Number.NaN);
      expect(point.y).toBeCloseTo(slowTurn?.y ?? Number.NaN);
      expect(waypoint.libraryPointId).toBe(slowTurn?.id ?? null);
    });
  });

  it('links the selected waypoint when saving it to the library', async () => {
    render(<App />);

    const addPointTool = screen.getByRole('button', { name: 'tool add point' });
    fireEvent.click(addPointTool);

    const canvas = getCanvas();
    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 300,
      clientY: 250,
      pointerId: 1,
    });
    fireEvent.pointerUp(canvas, {
      button: 0,
      clientX: 300,
      clientY: 250,
      pointerId: 1,
    });

    fireEvent.change(screen.getByLabelText('waypoint name'), {
      target: { value: 'Pickup Zone' },
    });

    const saveButton = screen.getByRole('button', {
      name: 'save to library',
    });
    expect(saveButton).toBeInTheDocument();

    fireEvent.click(saveButton);

    await waitFor(() => {
      const pickupZone = useWorkspaceStore
        .getState()
        .domain.points.find(
          (point) => point.isLibrary && point.name === 'Pickup Zone',
        );
      const { waypoint } = getSelectedWaypointPointState();

      expect(pickupZone).toBeDefined();
      expect(pickupZone?.x).toBeCloseTo(-7.5);
      expect(pickupZone?.y).toBeCloseTo(-5);
      expect(waypoint.libraryPointId).toBe(pickupZone?.id ?? null);
      expect(
        screen.getByRole('button', {
          name: 'unlink waypoint from library point',
        }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'save to library' }),
      ).not.toBeInTheDocument();
    });
  });

  it('updates a library point from a linked waypoint', async () => {
    render(<App />);

    addLibraryPointToPath('Slow Turn');

    fireEvent.change(screen.getByLabelText('waypoint x'), {
      target: { value: '4.2' },
    });
    fireEvent.change(screen.getByLabelText('waypoint y'), {
      target: { value: '-1.7' },
    });

    expect(
      screen.queryByRole('button', { name: 'update library point' }),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      const updatedLibraryPoint = useWorkspaceStore
        .getState()
        .domain.points.find(
          (point) => point.isLibrary && point.name === 'Slow Turn',
        );

      expect(updatedLibraryPoint?.x).toBeCloseTo(4.2);
      expect(updatedLibraryPoint?.y).toBeCloseTo(-1.7);
    });
  });

  it('propagates linked waypoint name edits to the library panel and other linked waypoints', async () => {
    render(<App />);

    addLibraryPointToPath('Slow Turn');
    addLibraryPointToPath('Slow Turn');

    fireEvent.change(screen.getByLabelText('waypoint name'), {
      target: { value: 'Shared Turn Name' },
    });

    await waitFor(() => {
      const linkedWaypointPoints = useWorkspaceStore
        .getState()
        .domain.points.filter(
          (point) => !point.isLibrary && point.name === 'Shared Turn Name',
        );

      expect(
        screen.getByRole('button', { name: 'edit Shared Turn Name' }),
      ).toBeInTheDocument();
      expect(
        screen.getAllByRole('button', {
          name: 'Select waypoint Shared Turn Name',
        }),
      ).toHaveLength(2);
      expect(linkedWaypointPoints).toHaveLength(2);
    });
  });

  it('propagates library panel name edits to waypoint inspector and waypoint labels', async () => {
    render(<App />);

    addLibraryPointToPath('Slow Turn');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'edit Slow Turn',
      }),
    );
    fireEvent.change(screen.getByLabelText('library point name'), {
      target: { value: 'Library Panel Rename' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'save library point' }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: 'Select waypoint Library Panel Rename',
        }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Select waypoint Library Panel Rename',
      }),
    );

    await waitFor(() => {
      expect(screen.getByLabelText('waypoint name')).toHaveValue(
        'Library Panel Rename',
      );
    });
  });

  it('shows usage count for linked waypoints', async () => {
    render(<App />);

    addLibraryPointToPath('Slow Turn');
    addLibraryPointToPath('Slow Turn');

    await waitFor(() => {
      expect(screen.getByTestId('usage-count')).toHaveTextContent('2');
    });
  });

  it('asks for confirmation before deleting a linked library point', async () => {
    render(<App />);

    addLibraryPointToPath('Slow Turn');

    fireEvent.click(screen.getByRole('button', { name: 'delete Slow Turn' }));

    expect(
      screen.getByRole('heading', {
        name: 'ライブラリポイントを削除しますか？',
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(
      screen.getByLabelText('library point Slow Turn'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'delete Slow Turn' }));
    fireEvent.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => {
      const state = useWorkspaceStore.getState();
      const activePath = state.domain.paths[0];
      const lastWaypoint = activePath?.waypoints.at(-1);

      expect(
        screen.queryByLabelText('library point Slow Turn'),
      ).not.toBeInTheDocument();
      expect(lastWaypoint?.libraryPointId).toBeNull();
      expect(
        state.domain.points.find(
          (point) => point.isLibrary && point.name === 'Slow Turn',
        ),
      ).toBeUndefined();
    });
  });

  it('highlights the linked library point when a linked waypoint is selected', async () => {
    render(<App />);

    addLibraryPointToPath('Slow Turn');
    const highlightedItem = screen.getByLabelText('library point Slow Turn');

    await waitFor(() => {
      expect(highlightedItem).toHaveAttribute('data-highlighted', 'true');
    });
  });

  it('does not add a new library point when creation is cancelled', async () => {
    render(<App />);

    const initialLibraryPointCount = useWorkspaceStore
      .getState()
      .domain.points.filter((point) => point.isLibrary).length;

    fireEvent.click(screen.getByRole('button', { name: 'new library point' }));

    fireEvent.change(screen.getByLabelText('library point name'), {
      target: { value: 'Cancelled Point' },
    });
    fireEvent.change(screen.getByLabelText('library point x'), {
      target: { value: '7' },
    });
    fireEvent.change(screen.getByLabelText('library point y'), {
      target: { value: '7.5' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'cancel library point creation' }),
    );

    await waitFor(() => {
      const libraryPoints = useWorkspaceStore
        .getState()
        .domain.points.filter((point) => point.isLibrary);

      expect(
        screen.queryByLabelText('new library point draft'),
      ).not.toBeInTheDocument();
      expect(libraryPoints).toHaveLength(initialLibraryPointCount);
      expect(
        libraryPoints.some((point) => point.name === 'Cancelled Point'),
      ).toBe(false);
    });
  });

  it('creates a new library point from the draft form', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'new library point' }));

    fireEvent.change(screen.getByLabelText('library point name'), {
      target: { value: 'Generated Point' },
    });
    fireEvent.change(screen.getByLabelText('library point x'), {
      target: { value: '7' },
    });
    fireEvent.change(screen.getByLabelText('library point y'), {
      target: { value: '7.5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'save library point' }));

    await waitFor(() => {
      expect(
        useWorkspaceStore
          .getState()
          .domain.points.find(
            (point) => point.isLibrary && point.name === 'Generated Point',
          ),
      ).toBeDefined();
    });
  });

  it('supports lock and unlink controls for library-linked waypoint', () => {
    render(<App />);

    addLibraryPointToPath('Slow Turn');

    const waypointX = screen.getByLabelText('waypoint x');
    const waypointRobotHeading = screen.getByLabelText(
      'waypoint robot heading',
    );
    expect(waypointX).toHaveValue(1.2);
    expect(screen.getByLabelText('waypoint name')).toHaveValue('Slow Turn');
    expect(waypointRobotHeading).not.toBeDisabled();

    const lockButton = screen.getByRole('button', {
      name: 'lock library point Slow Turn',
    });
    fireEvent.click(lockButton);
    expect(screen.getByLabelText('waypoint x')).toBeDisabled();
    expect(screen.getByLabelText('waypoint robot heading')).toBeDisabled();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'unlock library point Slow Turn',
      }),
    );
    expect(screen.getByLabelText('waypoint x')).not.toBeDisabled();
    expect(screen.getByLabelText('waypoint robot heading')).not.toBeDisabled();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'unlink waypoint from library point',
      }),
    );

    act(() => {
      const slowTurnId = useWorkspaceStore
        .getState()
        .domain.points.find(
          (point) => point.isLibrary && point.name === 'Slow Turn',
        )?.id;

      if (slowTurnId === undefined) {
        throw new Error('expected Slow Turn library point');
      }

      useWorkspaceStore.getState().updateLibraryPoint(slowTurnId, {
        x: 3.33,
      });
    });

    expect(screen.getByLabelText('waypoint x')).toHaveValue(1.2);
  });

  it('keeps an unlinked waypoint name independent from later library renames', async () => {
    render(<App />);

    addLibraryPointToPath('Slow Turn');

    fireEvent.change(screen.getByLabelText('waypoint name'), {
      target: { value: 'Shared Before Unlink' },
    });

    await waitFor(() => {
      expect(screen.getByLabelText('waypoint name')).toHaveValue(
        'Shared Before Unlink',
      );
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'unlink waypoint from library point',
      }),
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'edit Shared Before Unlink',
      }),
    );
    fireEvent.change(screen.getByLabelText('library point name'), {
      target: { value: 'Library After Unlink' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'save library point' }));

    await waitFor(() => {
      expect(screen.getByLabelText('waypoint name')).toHaveValue(
        'Shared Before Unlink',
      );
      expect(
        screen.getByRole('button', {
          name: 'Select waypoint Shared Before Unlink',
        }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {
          name: 'Select waypoint Library After Unlink',
        }),
      ).not.toBeInTheDocument();
    });
  });

  it('disables library point robot heading editing while the point is locked', () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'lock library point Slow Turn',
      }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'edit Slow Turn',
      }),
    );

    expect(screen.getByLabelText('library point x')).toBeDisabled();
    expect(screen.getByLabelText('library point y')).toBeDisabled();
    expect(screen.getByLabelText('library point heading')).toBeDisabled();
  });

  it('prevents waypoint drag while coordinate lock is enabled', async () => {
    render(<App />);

    addLibraryPointToPath('Slow Turn');

    const canvas = getCanvas();

    const waypointXInput = screen.getByLabelText('waypoint x');
    const waypointYInput = screen.getByLabelText('waypoint y');
    if (
      !(waypointXInput instanceof HTMLInputElement) ||
      !(waypointYInput instanceof HTMLInputElement)
    ) {
      throw new TypeError('expected waypoint coordinate inputs');
    }

    const lockedX = Number(waypointXInput.value);
    const lockedY = Number(waypointYInput.value);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'lock library point Slow Turn',
      }),
    );

    const selectedWaypointPoint = getSelectedWaypointScreenPoint();
    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: selectedWaypointPoint.x,
      clientY: selectedWaypointPoint.y,
      pointerId: 51,
    });
    fireEvent.pointerMove(canvas, {
      clientX: selectedWaypointPoint.x + 60,
      clientY: selectedWaypointPoint.y + 40,
      pointerId: 51,
    });
    fireEvent.pointerUp(canvas, {
      button: 0,
      clientX: selectedWaypointPoint.x + 60,
      clientY: selectedWaypointPoint.y + 40,
      pointerId: 51,
    });

    expect(screen.getByLabelText('waypoint x')).toHaveValue(lockedX);
    expect(screen.getByLabelText('waypoint y')).toHaveValue(lockedY);

    await waitFor(() => {
      expect(
        screen.getByText(
          'このポイントはロックされています。移動させるにはロックを解除してください。',
        ),
      ).toBeInTheDocument();
    });
  });
});
