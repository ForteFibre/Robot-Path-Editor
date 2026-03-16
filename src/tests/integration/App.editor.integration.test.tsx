import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { vi } from 'vitest';
import App from '../../App';
import * as interpolation from '../../domain/interpolation';
import * as pwaController from '../../pwa/usePwaController';
import { THEME_PREFERENCE_STORAGE_KEY } from '../../features/theme/themePreference';
import { useWorkspaceStore } from '../../store/workspaceStore';
import {
  addLibraryPointToPath,
  canvasClick,
  getBackgroundImageDragStartPoint,
  getCanvas,
  getDisplayedTotalSeconds,
  getVelocityOverlays,
  openFileMenu,
  openSettingsMenu,
  setupIntegrationTestLifecycle,
  stubAnimationFrames,
  confirmDialog,
} from './helpers';

setupIntegrationTestLifecycle();

type ThemeMatchMediaListener = (event: MediaQueryListEvent) => void;

const createThemeMatchMediaController = (initialMatches = false) => {
  let matches = initialMatches;
  const listeners = new Set<ThemeMatchMediaListener>();

  const mediaQueryList = {
    media: '(prefers-color-scheme: dark)',
    get matches() {
      return matches;
    },
    onchange: null,
    addEventListener: vi.fn(
      (_eventName: 'change', listener: ThemeMatchMediaListener) => {
        listeners.add(listener);
      },
    ),
    removeEventListener: vi.fn(
      (_eventName: 'change', listener: ThemeMatchMediaListener) => {
        listeners.delete(listener);
      },
    ),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;

  Object.defineProperty(globalThis.window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn(() => mediaQueryList),
  });

  return {
    setMatches(nextMatches: boolean): void {
      matches = nextMatches;
      const event = {
        matches: nextMatches,
        media: mediaQueryList.media,
      } as MediaQueryListEvent;

      for (const listener of listeners) {
        listener(event);
      }
    },
  };
};

describe('App editor integration', () => {
  it('renders main layout sections', () => {
    render(<App />);

    expect(screen.getByLabelText('top toolbar')).toBeInTheDocument();
    expect(screen.getByLabelText('editor sidebar')).toBeInTheDocument();
    expect(
      screen.getByLabelText('robot path editor canvas'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('snap settings panel')).toBeInTheDocument();
  });

  it('shows an update banner when a new service worker is waiting', () => {
    vi.spyOn(pwaController, 'usePwaController').mockReturnValue({
      applyUpdate: vi.fn(() => Promise.resolve(false)),
      canInstall: false,
      dismissUpdate: vi.fn(),
      install: vi.fn(() => Promise.resolve(false)),
      isInstalled: false,
      isOnline: true,
      isUpdateBannerVisible: true,
      isUpdateReady: true,
      registration: {
        waiting: {
          postMessage: vi.fn(() => undefined),
        } as unknown as ServiceWorker,
      } as ServiceWorkerRegistration,
    });

    render(<App />);

    expect(screen.getByText('新しいバージョンがあります')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '更新して再読み込み' }),
    ).toBeInTheDocument();
  });

  it('shows robot animation and waypoint timing details for the active path', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));

    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 360, 170);

    await waitFor(() => {
      expect(screen.getByLabelText('animated robot')).toBeInTheDocument();
    });

    expect(screen.getByText(/Total .* s/)).toBeInTheDocument();
    expect(screen.getAllByText(/通過 .* s/).length).toBeGreaterThan(0);
  });

  it('hides the robot while dragging a waypoint and restores it afterward', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));

    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 360, 170);

    await waitFor(() => {
      expect(screen.getByLabelText('animated robot')).toBeInTheDocument();
    });

    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 360,
      clientY: 170,
      pointerId: 405,
    });
    fireEvent.pointerMove(canvas, {
      clientX: 395,
      clientY: 170,
      pointerId: 405,
    });

    await waitFor(() => {
      expect(useWorkspaceStore.getState().ui.isDragging).toBe(true);
      expect(screen.queryByLabelText('animated robot')).not.toBeInTheDocument();
    });

    fireEvent.pointerUp(canvas, {
      button: 0,
      clientX: 395,
      clientY: 170,
      pointerId: 405,
    });

    await waitFor(() => {
      expect(useWorkspaceStore.getState().ui.isDragging).toBe(false);
      expect(screen.getByLabelText('animated robot')).toBeInTheDocument();
    });
  });

  it('shows velocity coloring only for the active visible path', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));

    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 360, 170);

    await waitFor(() => {
      expect(getVelocityOverlays()).toHaveLength(1);
    });

    const firstPathId = useWorkspaceStore.getState().domain.activePathId;

    act(() => {
      useWorkspaceStore.getState().addPath();
    });

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 220, 230);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 340, 230);

    await waitFor(() => {
      expect(getVelocityOverlays()).toHaveLength(1);
    });

    act(() => {
      useWorkspaceStore.getState().setActivePath(firstPathId);
    });

    await waitFor(() => {
      expect(getVelocityOverlays()).toHaveLength(1);
    });

    act(() => {
      useWorkspaceStore.getState().togglePathVisible(firstPathId);
    });

    await waitFor(() => {
      expect(getVelocityOverlays()).toHaveLength(0);
    });
  });

  it('keeps velocity coloring and timing visible while a waypoint drag is in progress', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));

    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 360, 170);

    await waitFor(() => {
      expect(getVelocityOverlays()).toHaveLength(1);
    });

    expect(getDisplayedTotalSeconds()).toBeGreaterThan(0);

    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 360,
      clientY: 170,
      pointerId: 401,
    });
    fireEvent.pointerMove(canvas, {
      clientX: 390,
      clientY: 170,
      pointerId: 401,
    });

    await waitFor(() => {
      expect(useWorkspaceStore.getState().ui.isDragging).toBe(true);
      expect(getVelocityOverlays()).toHaveLength(1);
      expect(getDisplayedTotalSeconds()).toBeGreaterThan(0);
    });

    fireEvent.pointerUp(canvas, {
      button: 0,
      clientX: 390,
      clientY: 170,
      pointerId: 401,
    });

    await waitFor(() => {
      expect(useWorkspaceStore.getState().ui.isDragging).toBe(false);
      expect(getVelocityOverlays()).toHaveLength(1);
    });
  });

  it('updates path total time after dragging a waypoint', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));

    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 360, 170);

    await waitFor(() => {
      expect(getVelocityOverlays()).toHaveLength(1);
    });

    const initialTotalSeconds = getDisplayedTotalSeconds();
    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 360,
      clientY: 170,
      pointerId: 499,
    });
    fireEvent.pointerMove(canvas, {
      clientX: 420,
      clientY: 170,
      pointerId: 499,
    });
    fireEvent.pointerUp(canvas, {
      button: 0,
      clientX: 420,
      clientY: 170,
      pointerId: 499,
    });

    await waitFor(() => {
      expect(getDisplayedTotalSeconds()).toBeGreaterThan(initialTotalSeconds);
    });
  });

  it('keeps the waypoint inspector visible while a waypoint drag is in progress', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));

    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 360, 170);

    await waitFor(() => {
      expect(screen.getByLabelText('waypoint properties')).toBeInTheDocument();
    });

    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 360,
      clientY: 170,
      pointerId: 402,
    });
    fireEvent.pointerMove(canvas, {
      clientX: 390,
      clientY: 170,
      pointerId: 402,
    });

    await waitFor(() => {
      expect(useWorkspaceStore.getState().ui.isDragging).toBe(true);
      expect(screen.getByLabelText('waypoint properties')).toBeInTheDocument();
      expect(
        screen.getByLabelText('waypoint path heading'),
      ).toBeInTheDocument();
    });

    fireEvent.pointerUp(canvas, {
      button: 0,
      clientX: 390,
      clientY: 170,
      pointerId: 402,
    });

    await waitFor(() => {
      expect(useWorkspaceStore.getState().ui.isDragging).toBe(false);
      expect(screen.getByLabelText('waypoint properties')).toBeInTheDocument();
    });
  });

  it('edits a waypoint name from the waypoint inspector', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));

    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 360, 170);

    const waypointLabelInput = await screen.findByLabelText('waypoint name');
    fireEvent.change(waypointLabelInput, { target: { value: 'Start Pose' } });

    await waitFor(() => {
      const path = useWorkspaceStore.getState().domain.paths[0];
      const waypointPointId = path?.waypoints[1]?.pointId;
      const waypointPoint = useWorkspaceStore
        .getState()
        .domain.points.find((point) => point.id === waypointPointId);

      expect(waypointPoint?.name).toBe('Start Pose');
      expect(
        screen.getByRole('button', { name: 'Select waypoint Start Pose' }),
      ).toBeInTheDocument();
    });
  });

  it('updates path total time when max velocity changes from the toolbar', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));

    const canvas = getCanvas();
    canvasClick(canvas, 220, 170);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 340, 170);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 460, 170);

    await waitFor(() => {
      expect(screen.getByText(/^Total /)).toBeInTheDocument();
    });

    const initialTotalSeconds = getDisplayedTotalSeconds();

    openSettingsMenu();
    fireEvent.change(screen.getByLabelText('Max Velocity (m/s)'), {
      target: { value: '0.2' },
    });

    await waitFor(() => {
      expect(getDisplayedTotalSeconds()).toBeGreaterThan(initialTotalSeconds);
    });
  });

  it('keeps path element selection buttons separate from reorder handles', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));

    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 360, 170);

    expect(
      screen.getByRole('list', { name: 'Path elements' }),
    ).toBeInTheDocument();

    const selectWaypointButton = screen.getByRole('button', {
      name: 'Select waypoint WP 1',
    });
    const reorderWaypointButton = screen.getByRole('button', {
      name: 'Reorder waypoint WP 1',
    });

    expect(selectWaypointButton).not.toContainElement(reorderWaypointButton);
    expect(
      screen.queryByRole('button', { name: /Move waypoint WP 1/i }),
    ).not.toBeInTheDocument();
  });

  it('does not rediscretize static path layers on robot animation frames', async () => {
    const { advanceFrames } = stubAnimationFrames();
    const discretizeSpy = vi.spyOn(interpolation, 'discretizePathDetailed');

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));

    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 360, 170);

    act(() => {
      advanceFrames(1);
    });

    await waitFor(() => {
      expect(screen.getByLabelText('animated robot')).toBeInTheDocument();
    });

    const initialDiscretizeCalls = discretizeSpy.mock.calls.length;

    act(() => {
      advanceFrames(5);
    });

    expect(discretizeSpy.mock.calls.length).toBe(initialDiscretizeCalls);
  });

  it('keeps robot animation progress when only robot geometry changes', async () => {
    const { advanceFrames } = stubAnimationFrames();

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));

    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 360, 170);

    act(() => {
      advanceFrames(10);
    });

    const animatedRobot = await screen.findByLabelText('animated robot');
    const transformBeforeGeometryChange =
      animatedRobot.getAttribute('transform');

    openSettingsMenu();
    fireEvent.change(screen.getByLabelText('Robot Length (m)'), {
      target: { value: '1.25' },
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Robot Length (m)')).toHaveValue(1.25);
    });

    expect(animatedRobot.getAttribute('transform')).toBe(
      transformBeforeGeometryChange,
    );
  });

  it('toggles robot preview from robot settings', async () => {
    const { advanceFrames } = stubAnimationFrames();

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));

    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 360, 170);

    act(() => {
      advanceFrames(1);
    });

    await waitFor(() => {
      expect(screen.getByLabelText('animated robot')).toBeInTheDocument();
    });

    openSettingsMenu();

    const robotPreviewToggle = screen.getByLabelText('Robot Preview');
    expect(robotPreviewToggle).toBeChecked();

    fireEvent.click(robotPreviewToggle);

    await waitFor(() => {
      expect(useWorkspaceStore.getState().ui.robotPreviewEnabled).toBe(false);
      expect(screen.queryByLabelText('animated robot')).not.toBeInTheDocument();
    });

    fireEvent.click(robotPreviewToggle);

    act(() => {
      advanceFrames(1);
    });

    await waitFor(() => {
      expect(useWorkspaceStore.getState().ui.robotPreviewEnabled).toBe(true);
      expect(screen.getByLabelText('animated robot')).toBeInTheDocument();
    });
  });

  it('switches appearance preference from settings and persists it', async () => {
    const matchMediaMock = vi.fn().mockImplementation((query: string) => {
      return {
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as MediaQueryList;
    });

    Object.defineProperty(globalThis.window, 'matchMedia', {
      configurable: true,
      value: matchMediaMock,
    });

    window.localStorage.removeItem(THEME_PREFERENCE_STORAGE_KEY);

    render(<App />);

    openSettingsMenu();
    fireEvent.click(screen.getByLabelText('Dark'));

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('dark');
      expect(document.documentElement.style.colorScheme).toBe('dark');
      expect(window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBe(
        'dark',
      );
    });

    fireEvent.click(screen.getByLabelText('System'));

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('light');
      expect(document.documentElement.style.colorScheme).toBe('light');
      expect(window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBe(
        'system',
      );
    });
  });

  it('follows OS theme changes only while System appearance is selected', async () => {
    const matchMediaController = createThemeMatchMediaController(true);

    window.localStorage.removeItem(THEME_PREFERENCE_STORAGE_KEY);

    render(<App />);

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('dark');
      expect(document.documentElement.style.colorScheme).toBe('dark');
    });

    openSettingsMenu();
    fireEvent.click(screen.getByLabelText('Dark'));

    await waitFor(() => {
      expect(window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBe(
        'dark',
      );
    });

    act(() => {
      matchMediaController.setMatches(false);
    });

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('dark');
      expect(document.documentElement.style.colorScheme).toBe('dark');
    });

    fireEvent.click(screen.getByLabelText('System'));

    await waitFor(() => {
      expect(window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBe(
        'system',
      );
      expect(document.documentElement.dataset.theme).toBe('light');
      expect(document.documentElement.style.colorScheme).toBe('light');
    });

    act(() => {
      matchMediaController.setMatches(true);
    });

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('dark');
      expect(document.documentElement.style.colorScheme).toBe('dark');
    });
  });

  it('keeps undo and redo stable after background image drag', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));

    const canvas = getCanvas();
    canvasClick(canvas, 300, 250);
    expect(screen.getAllByText('WP 1')[0]).toBeInTheDocument();

    act(() => {
      useWorkspaceStore.getState().setBackgroundImage({
        url: 'data:image/png;base64,dGVzdA==',
        width: 100,
        height: 50,
        x: 1,
        y: 2,
        scale: 1,
        alpha: 0.5,
      });
    });

    const transformScale = useWorkspaceStore.getState().ui.canvasTransform.k;
    const dragStart = getBackgroundImageDragStartPoint();
    act(() => {
      useWorkspaceStore.getState().setTool('edit-image');
    });

    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: dragStart.x,
      clientY: dragStart.y,
      pointerId: 302,
    });
    fireEvent.pointerMove(canvas, {
      clientX: dragStart.x + 40,
      clientY: dragStart.y - 20,
      pointerId: 302,
    });
    fireEvent.pointerUp(canvas, {
      button: 0,
      clientX: dragStart.x + 40,
      clientY: dragStart.y - 20,
      pointerId: 302,
    });

    expect(useWorkspaceStore.getState().canUndo()).toBe(true);

    const draggedBackground = useWorkspaceStore.getState().ui.backgroundImage;
    expect(draggedBackground?.x).toBeCloseTo(1 + 20 / transformScale);
    expect(draggedBackground?.y).toBeCloseTo(2 - 40 / transformScale);

    const undoBtn = screen.getByRole('button', { name: 'undo workspace' });
    expect(undoBtn).not.toBeDisabled();
    fireEvent.click(undoBtn);

    expect(screen.queryByText('WP 1')).not.toBeInTheDocument();
    expect(useWorkspaceStore.getState().ui.backgroundImage?.x).toBeCloseTo(
      draggedBackground?.x ?? 0,
    );
    expect(useWorkspaceStore.getState().ui.backgroundImage?.y).toBeCloseTo(
      draggedBackground?.y ?? 0,
    );

    fireEvent.click(screen.getByRole('button', { name: 'redo workspace' }));

    expect(screen.getAllByText('WP 1')[0]).toBeInTheDocument();
    expect(useWorkspaceStore.getState().ui.backgroundImage?.x).toBeCloseTo(
      draggedBackground?.x ?? 0,
    );
    expect(useWorkspaceStore.getState().ui.backgroundImage?.y).toBeCloseTo(
      draggedBackground?.y ?? 0,
    );
  });

  it('toggles snap settings from the panel', () => {
    render(<App />);

    const panelToggle = screen.getByRole('button', {
      name: 'toggle snap settings panel',
    });
    fireEvent.click(panelToggle);

    const alignXToggle = screen.getByLabelText('Align X');
    expect(alignXToggle).toBeChecked();

    fireEvent.click(alignXToggle);
    expect(alignXToggle).not.toBeChecked();
    fireEvent.click(panelToggle);
    expect(screen.queryByLabelText('Align X')).not.toBeInTheDocument();

    fireEvent.click(panelToggle);
    expect(screen.getByLabelText('Align X')).toBeInTheDocument();
  });

  it('switches mode and updates button state', () => {
    render(<App />);

    const headingButton = screen.getByRole('button', { name: 'Heading' });
    const pathButton = screen.getByRole('button', { name: 'Path' });

    expect(headingButton).toHaveAttribute('aria-pressed', 'false');
    expect(pathButton).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(headingButton);

    expect(headingButton).toHaveAttribute('aria-pressed', 'true');
    expect(pathButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('resets workspace from toolbar action', () => {
    render(<App />);

    addLibraryPointToPath('Slow Turn');
    expect(
      screen.getByRole('button', { name: 'Select waypoint Slow Turn' }),
    ).toBeInTheDocument();

    openFileMenu();
    fireEvent.click(screen.getByRole('button', { name: 'new workspace' }));
    confirmDialog('破棄して新規作成');
    expect(
      screen.queryByRole('button', { name: 'Select waypoint Slow Turn' }),
    ).not.toBeInTheDocument();
  });

  it('keeps the current workspace when reset confirmation is cancelled', () => {
    render(<App />);

    addLibraryPointToPath('Slow Turn');
    expect(
      screen.getByRole('button', { name: 'Select waypoint Slow Turn' }),
    ).toBeInTheDocument();

    openFileMenu();
    fireEvent.click(screen.getByRole('button', { name: 'new workspace' }));
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(
      screen.getByRole('button', { name: 'Select waypoint Slow Turn' }),
    ).toBeInTheDocument();
  });

  it('supports undo and redo from toolbar buttons', () => {
    render(<App />);

    addLibraryPointToPath('Slow Turn');
    expect(
      screen.getByRole('button', { name: 'Select waypoint Slow Turn' }),
    ).toBeInTheDocument();

    const undoBtn = screen.getByRole('button', { name: 'undo workspace' });
    expect(undoBtn).not.toBeDisabled();
    fireEvent.click(undoBtn);
    expect(
      screen.queryByRole('button', { name: 'Select waypoint Slow Turn' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'redo workspace' }));
    expect(
      screen.getByRole('button', { name: 'Select waypoint Slow Turn' }),
    ).toBeInTheDocument();
  });

  it('undo once removes inserted waypoint even after waypoint click without drag', () => {
    render(<App />);

    addLibraryPointToPath('Slow Turn');

    const canvas = getCanvas();
    expect(
      screen.getByRole('button', { name: 'Select waypoint Slow Turn' }),
    ).toBeInTheDocument();

    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 300,
      clientY: 250,
      pointerId: 11,
    });
    fireEvent.pointerUp(canvas, {
      button: 0,
      clientX: 300,
      clientY: 250,
      pointerId: 11,
    });

    const undoBtn = screen.getByRole('button', { name: 'undo workspace' });
    expect(undoBtn).not.toBeDisabled();
    fireEvent.click(undoBtn);
    expect(
      screen.queryByRole('button', { name: 'Select waypoint Slow Turn' }),
    ).not.toBeInTheDocument();
  });

  it('keeps waypoint drag as one undo step with no-op pointer-up', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));

    const canvas = getCanvas();
    canvasClick(canvas, 300, 250);

    const waypointXInput = screen.getByLabelText('waypoint x');
    const waypointYInput = screen.getByLabelText('waypoint y');
    if (
      !(waypointXInput instanceof HTMLInputElement) ||
      !(waypointYInput instanceof HTMLInputElement)
    ) {
      throw new TypeError('expected waypoint coordinate inputs');
    }

    const initialX = Number(waypointXInput.value);
    const initialY = Number(waypointYInput.value);

    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 300,
      clientY: 250,
      pointerId: 21,
    });
    fireEvent.pointerMove(canvas, {
      clientX: 340,
      clientY: 280,
      pointerId: 21,
    });
    fireEvent.pointerUp(canvas, {
      button: 0,
      clientX: 340,
      clientY: 280,
      pointerId: 21,
    });

    expect(screen.getByLabelText('waypoint x')).not.toHaveValue(initialX);
    expect(screen.getByLabelText('waypoint y')).not.toHaveValue(initialY);

    const undoButton = screen.getByRole('button', { name: 'undo workspace' });
    fireEvent.click(undoButton);

    expect(screen.getAllByText('WP 1')[0]).toBeInTheDocument();
    expect(screen.getByLabelText('waypoint x')).toHaveValue(initialX);
    expect(screen.getByLabelText('waypoint y')).toHaveValue(initialY);

    fireEvent.click(undoButton);
    expect(screen.queryByText('WP 1')).not.toBeInTheDocument();
  });

  it('supports undo and redo hotkeys', () => {
    render(<App />);

    addLibraryPointToPath('Slow Turn');
    expect(
      screen.getByRole('button', { name: 'Select waypoint Slow Turn' }),
    ).toBeInTheDocument();

    fireEvent.keyDown(globalThis.window, { key: 'z', ctrlKey: true });
    expect(
      screen.queryByRole('button', { name: 'Select waypoint Slow Turn' }),
    ).not.toBeInTheDocument();

    fireEvent.keyDown(globalThis.window, {
      key: 'z',
      ctrlKey: true,
      shiftKey: true,
    });
    expect(
      screen.getByRole('button', { name: 'Select waypoint Slow Turn' }),
    ).toBeInTheDocument();
  });
});
