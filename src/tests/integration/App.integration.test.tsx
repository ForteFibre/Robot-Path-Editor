import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import App from '../../App';
import {
  getCanvasRenderStep,
  getHeadingHandleDistance,
} from '../../domain/canvas';
import { computeDubinsArcCentersForPath } from '../../domain/dubins';
import {
  pointFromHeading,
  worldToScreen,
  type Point,
} from '../../domain/geometry';
import * as interpolation from '../../domain/interpolation';
import {
  resolveSectionDubins,
  resolveSectionRMin,
} from '../../domain/sectionRadius';
import type { CsvTarget } from '../../io/csv';
import {
  createPointIndex,
  resolvePathModel,
} from '../../domain/pointResolution';
import { resolveWaypointRobotHeadingHandleAngle } from '../../features/canvas/waypointHeading';
import * as workspaceIO from '../../io/workspaceIO';
import {
  getWorkspacePersistedState,
  useWorkspaceStore,
} from '../../store/workspaceStore';

const stubBackgroundImageFileLoad = (params: {
  dataUrl: string;
  width: number;
  height: number;
}): void => {
  const { dataUrl, width, height } = params;

  class MockFileReader {
    public onload: ((event: ProgressEvent<FileReader>) => void) | null = null;

    public readAsDataURL(_file: Blob): void {
      this.onload?.({
        target: {
          result: dataUrl,
        },
      } as ProgressEvent<FileReader>);
    }
  }

  class MockImage {
    public onload: (() => void) | null = null;
    public width = width;
    public height = height;

    set src(_value: string) {
      this.onload?.();
    }
  }

  vi.stubGlobal('FileReader', MockFileReader);
  vi.stubGlobal('Image', MockImage);
};

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    mode?: 'read' | 'readwrite';
  }) => Promise<FileSystemDirectoryHandle>;
};

const setDirectoryPickerSupport = (
  picker: DirectoryPickerWindow['showDirectoryPicker'],
  isSecureContext = true,
): void => {
  Object.defineProperty(globalThis.window, 'showDirectoryPicker', {
    value: picker,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis.window, 'isSecureContext', {
    value: isSecureContext,
    configurable: true,
  });
};

const createDirectoryExportMock = (directoryName = 'exports') => {
  const write = vi.fn((_blob: Blob) => Promise.resolve(undefined));
  const close = vi.fn(() => Promise.resolve(undefined));
  const createWritable = vi.fn(() =>
    Promise.resolve({
      write,
      close,
    } as unknown as FileSystemWritableFileStream),
  );
  const getFileHandle = vi.fn(() =>
    Promise.resolve({
      createWritable,
    } as unknown as FileSystemFileHandle),
  );
  const directoryHandle = {
    name: directoryName,
    getFileHandle,
  } as unknown as FileSystemDirectoryHandle;
  const showDirectoryPicker = vi.fn(() => Promise.resolve(directoryHandle));

  setDirectoryPickerSupport(showDirectoryPicker);

  return {
    showDirectoryPicker,
    getFileHandle,
    write,
  };
};

const openFileMenu = (): void => {
  const fileMenuButton = screen.getByRole('button', { name: 'file menu' });
  if (fileMenuButton.getAttribute('aria-expanded') !== 'true') {
    fireEvent.click(fileMenuButton);
  }
};

const openSettingsMenu = (): void => {
  const settingsMenuButton = screen.getByRole('button', {
    name: 'open settings menu',
  });
  if (settingsMenuButton.getAttribute('aria-expanded') !== 'true') {
    fireEvent.click(settingsMenuButton);
  }
};

const setCsvTargetFromToolbar = (target: CsvTarget): void => {
  openFileMenu();
  fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
  fireEvent.change(screen.getByDisplayValue(/All Paths|Active Path/), {
    target: { value: target },
  });
};

const getBackgroundImageLoadInput = (): HTMLInputElement => {
  const input = document.getElementById('background-image-file-input');

  if (!(input instanceof HTMLInputElement)) {
    throw new TypeError('expected background image file input');
  }

  return input;
};

const getCanvasHost = (): HTMLElement => {
  return screen.getByLabelText('robot path editor canvas');
};

const getCanvas = (): HTMLElement => {
  return getCanvasHost().querySelector('canvas') ?? getCanvasHost();
};

const getStageContent = (): HTMLElement => {
  return getCanvasHost().querySelector('.konvajs-content') ?? getCanvasHost();
};

const getScreenPointForWorld = (point: Point): Point => {
  return worldToScreen(point, useWorkspaceStore.getState().ui.canvasTransform);
};

const getBackgroundImageDragStartPoint = (): Point => {
  const backgroundImage = useWorkspaceStore.getState().ui.backgroundImage;
  if (backgroundImage === null) {
    throw new TypeError('expected background image');
  }

  const width = backgroundImage.width * backgroundImage.scale;
  const height = backgroundImage.height * backgroundImage.scale;
  const inset = (extent: number): number => {
    return Math.min(1, Math.max(extent / 2, 0.001));
  };

  return getScreenPointForWorld({
    x: backgroundImage.x + inset(width),
    y: backgroundImage.y + inset(height),
  });
};

const getActiveResolvedPathState = (): {
  path: ReturnType<typeof resolvePathModel>;
  detail: ReturnType<typeof interpolation.discretizePathDetailed>;
} => {
  const state = useWorkspaceStore.getState();
  const activePath = state.domain.paths.find(
    (path) => path.id === state.domain.activePathId,
  );

  if (activePath === undefined) {
    throw new TypeError('expected active path');
  }

  const pointsById = createPointIndex(state.domain.points);
  const resolvedPath = resolvePathModel(activePath, pointsById);
  const detail = interpolation.discretizePathDetailed(
    activePath,
    state.domain.points,
    getCanvasRenderStep(state.ui.canvasTransform.k),
  );

  return {
    path: resolvedPath,
    detail,
  };
};

const getSectionScreenPoint = (
  sectionIndex: number,
  sampleRatio = 0.5,
): Point => {
  const { detail } = getActiveResolvedPathState();
  const range = detail.sectionSampleRanges[sectionIndex];
  if (range === undefined) {
    throw new TypeError(`expected section sample range for ${sectionIndex}`);
  }

  const clampedRatio = Math.min(Math.max(sampleRatio, 0), 1);
  const sampleOffset = Math.round(
    (range.endSampleIndex - range.startSampleIndex) * clampedRatio,
  );
  const sampleIndex = Math.min(
    range.endSampleIndex,
    range.startSampleIndex + sampleOffset,
  );
  const sample =
    detail.samples[sampleIndex] ?? detail.samples[range.startSampleIndex];

  if (sample === undefined) {
    throw new TypeError(
      `expected discretized sample for section ${sectionIndex}`,
    );
  }

  return getScreenPointForWorld({
    x: sample.x,
    y: sample.y,
  });
};

const getSelectedWaypointScreenPoint = (): Point => {
  const state = useWorkspaceStore.getState();
  const { pathId, waypointId } = state.ui.selection;
  if (pathId === null || waypointId === null) {
    throw new TypeError('expected selected waypoint');
  }

  const pointsById = createPointIndex(state.domain.points);
  const path = state.domain.paths.find((candidate) => candidate.id === pathId);
  if (path === undefined) {
    throw new TypeError('expected selected path');
  }

  const resolvedPath = resolvePathModel(path, pointsById);
  const waypoint = resolvedPath.waypoints.find(
    (candidate) => candidate.id === waypointId,
  );
  if (waypoint === undefined) {
    throw new TypeError('expected selected waypoint');
  }

  return getScreenPointForWorld({ x: waypoint.x, y: waypoint.y });
};

const getSelectedWaypointRobotHeadingHandleScreenPoint = (): Point => {
  const state = useWorkspaceStore.getState();
  const { pathId, waypointId } = state.ui.selection;
  if (pathId === null || waypointId === null) {
    throw new TypeError('expected selected waypoint');
  }

  const { path, detail } = getActiveResolvedPathState();
  if (path.id !== pathId) {
    throw new TypeError('expected selected waypoint on active path');
  }

  const waypointIndex = path.waypoints.findIndex(
    (candidate) => candidate.id === waypointId,
  );
  const waypoint = path.waypoints[waypointIndex];
  if (waypointIndex < 0 || waypoint === undefined) {
    throw new TypeError('expected selected waypoint');
  }

  const robotHeading = resolveWaypointRobotHeadingHandleAngle(
    path,
    detail,
    waypointIndex,
  );
  const handlePoint = pointFromHeading(
    waypoint,
    robotHeading,
    getHeadingHandleDistance(state.ui.canvasTransform.k),
  );

  return getScreenPointForWorld(handlePoint);
};

const getSelectedSectionRMinHandleScreenPoint = (): Point => {
  const state = useWorkspaceStore.getState();
  const { pathId, sectionIndex } = state.ui.selection;
  if (pathId === null || sectionIndex === null) {
    throw new TypeError('expected selected section');
  }

  const { path } = getActiveResolvedPathState();
  if (path.id !== pathId) {
    throw new TypeError('expected selected section on active path');
  }

  const start = path.waypoints[sectionIndex];
  const end = path.waypoints[sectionIndex + 1];
  if (start === undefined || end === undefined) {
    throw new TypeError('expected selected section endpoints');
  }

  const rMin = resolveSectionRMin(path, sectionIndex);
  if (rMin === null) {
    throw new TypeError('expected section rMin');
  }

  const resolved = resolveSectionDubins(
    start,
    end,
    path.sectionRMin[sectionIndex] ?? null,
  );
  if (resolved === null) {
    throw new TypeError('expected resolved section dubins');
  }

  const centers = computeDubinsArcCentersForPath(
    { x: start.x, y: start.y, headingDeg: start.pathHeading },
    resolved.path,
    resolved.turningRadius,
  );
  const handlePoint = centers.startCenter ?? centers.endCenter;
  if (handlePoint === undefined) {
    throw new TypeError('expected section rMin handle');
  }

  return getScreenPointForWorld(handlePoint);
};

const loadBackgroundImageFromToolbar = async (
  params: {
    dataUrl?: string;
    width?: number;
    height?: number;
  } = {},
): Promise<void> => {
  const {
    dataUrl = 'data:image/png;base64,dGVzdA==',
    width = 640,
    height = 360,
  } = params;

  stubBackgroundImageFileLoad({ dataUrl, width, height });

  openSettingsMenu();
  fireEvent.change(getBackgroundImageLoadInput(), {
    target: {
      files: [new File(['fake-image'], 'field.png', { type: 'image/png' })],
    },
  });

  await waitFor(() => {
    expect(screen.getByLabelText('X (m)')).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(useWorkspaceStore.getState().ui.backgroundImage).not.toBeNull();
    expect(getCanvasHost().querySelectorAll('canvas').length).toBeGreaterThan(
      0,
    );
  });
};

const exportWorkspaceJsonFromToolbar = (): string => {
  const downloadSpy = vi
    .spyOn(workspaceIO, 'downloadText')
    .mockImplementation(() => undefined);

  openFileMenu();
  fireEvent.click(screen.getByRole('button', { name: 'Save Workspace' }));

  const exportedJson = downloadSpy.mock.calls.at(-1)?.[1];
  if (typeof exportedJson !== 'string') {
    throw new TypeError('expected exported workspace json');
  }

  return exportedJson;
};

const importWorkspaceJson = async (json: string): Promise<void> => {
  openFileMenu();
  fireEvent.change(screen.getByLabelText('load workspace file'), {
    target: {
      files: [new File([json], 'workspace.json', { type: 'application/json' })],
    },
  });

  await waitFor(() => {
    expect(useWorkspaceStore.getState().ui.backgroundImage).not.toBeNull();
  });
};

const importWorkspaceJsonFile = async (json: string): Promise<void> => {
  openFileMenu();
  fireEvent.change(screen.getByLabelText('load workspace file'), {
    target: {
      files: [new File([json], 'workspace.json', { type: 'application/json' })],
    },
  });

  await waitFor(() => {
    expect(useWorkspaceStore.getState().canUndo()).toBe(false);
  });
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (globalThis.window as DirectoryPickerWindow).showDirectoryPicker;
  Object.defineProperty(globalThis.window, 'isSecureContext', {
    value: true,
    configurable: true,
  });
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  delete globalThis.confirm;
});

beforeEach(() => {
  globalThis.confirm = vi.fn().mockReturnValue(true);
  useWorkspaceStore.getState().resetWorkspace();
  useWorkspaceStore
    .getState()
    .addLibraryPoint({ name: 'Slow Turn', x: 1.2, y: 0 });
  useWorkspaceStore.temporal.getState().clear();
});

/**
 * Simulate a click on the canvas, which now uses pointer events.
 * Fires pointerDown → pointerUp in sequence.
 */
const canvasClick = (
  canvas: HTMLElement,
  clientX: number,
  clientY: number,
): void => {
  fireEvent.pointerDown(canvas, { button: 0, clientX, clientY, pointerId: 1 });
  fireEvent.pointerUp(canvas, { button: 0, clientX, clientY, pointerId: 1 });
};

const canvasDoubleClick = (
  canvas: HTMLElement,
  clientX: number,
  clientY: number,
): void => {
  fireEvent.doubleClick(canvas, {
    button: 0,
    clientX,
    clientY,
  });
};

const parseDisplayedSeconds = (text: string | null): number => {
  const matchedSeconds = text?.match(/(\d+(?:\.\d+)?) s/);

  if (matchedSeconds?.[1] === undefined) {
    throw new Error(`expected time text, received: ${text ?? 'null'}`);
  }

  return Number(matchedSeconds[1]);
};

const getDisplayedTotalSeconds = (): number => {
  return parseDisplayedSeconds(screen.getByText(/^Total /).textContent);
};

const getVelocityOverlays = (): HTMLElement[] => {
  return screen.queryAllByLabelText('path velocity overlay');
};

const addPointWithHeadingDrag = (params: {
  canvas: HTMLElement;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  pointerId?: number;
}): void => {
  const { canvas, startX, startY, endX, endY, pointerId = 91 } = params;

  fireEvent.pointerMove(canvas, {
    clientX: startX,
    clientY: startY,
    pointerId,
  });
  fireEvent.pointerDown(canvas, {
    button: 0,
    clientX: startX,
    clientY: startY,
    pointerId,
  });
  fireEvent.pointerMove(canvas, {
    clientX: endX,
    clientY: endY,
    pointerId,
  });
  fireEvent.pointerUp(canvas, {
    button: 0,
    clientX: endX,
    clientY: endY,
    pointerId,
  });
};

const addLibraryPointToPath = (name: string): void => {
  fireEvent.click(
    screen.getByRole('button', {
      name: new RegExp(`insert ${name} into path`, 'i'),
    }),
  );
};

const getSelectedWaypointPointState = (): {
  waypoint: { id: string; pointId: string; libraryPointId: string | null };
  point: { id: string; x: number; y: number; name: string };
} => {
  const state = useWorkspaceStore.getState();
  const { pathId, waypointId } = state.ui.selection;
  if (pathId === null || waypointId === null) {
    throw new TypeError('expected selected waypoint');
  }

  const path = state.domain.paths.find((candidate) => candidate.id === pathId);
  const waypoint = path?.waypoints.find(
    (candidate) => candidate.id === waypointId,
  );
  if (waypoint === undefined) {
    throw new TypeError('expected waypoint state');
  }

  const point = state.domain.points.find(
    (candidate) => candidate.id === waypoint.pointId,
  );
  if (point === undefined) {
    throw new TypeError('expected waypoint point state');
  }

  return {
    waypoint,
    point,
  };
};

const stubAnimationFrames = (): {
  advanceFrames: (count: number, frameDurationMs?: number) => void;
} => {
  let now = 0;
  let nextId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();

  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextId;
    nextId += 1;
    callbacks.set(id, callback);
    return id;
  });

  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    callbacks.delete(id);
  });

  return {
    advanceFrames: (count: number, frameDurationMs = 16) => {
      for (let frameIndex = 0; frameIndex < count; frameIndex += 1) {
        now += frameDurationMs;
        const scheduledCallbacks = [...callbacks.entries()].sort(
          ([leftId], [rightId]) => leftId - rightId,
        );
        callbacks.clear();

        for (const [, callback] of scheduledCallbacks) {
          callback(now);
        }
      }
    },
  };
};

describe('App integration', () => {
  it('renders main layout sections', () => {
    render(<App />);

    expect(screen.getByLabelText('top toolbar')).toBeInTheDocument();
    expect(screen.getByLabelText('editor sidebar')).toBeInTheDocument();
    expect(
      screen.getByLabelText('robot path editor canvas'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('snap settings panel')).toBeInTheDocument();
  });

  it('renders and drags background image with ROS x-up / y-left mapping', () => {
    render(<App />);

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

    const canvas = getCanvas();
    const dragStart = getBackgroundImageDragStartPoint();
    expect(useWorkspaceStore.getState().ui.backgroundImage).not.toBeNull();
    expect(getCanvasHost().querySelectorAll('canvas').length).toBeGreaterThan(
      0,
    );

    const transformScale = useWorkspaceStore.getState().ui.canvasTransform.k;

    act(() => {
      useWorkspaceStore.getState().setTool('edit-image');
    });

    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: dragStart.x,
      clientY: dragStart.y,
      pointerId: 301,
    });
    fireEvent.pointerMove(canvas, {
      clientX: dragStart.x + 40,
      clientY: dragStart.y - 20,
      pointerId: 301,
    });
    fireEvent.pointerUp(canvas, {
      button: 0,
      clientX: dragStart.x + 40,
      clientY: dragStart.y - 20,
      pointerId: 301,
    });

    const updatedBackground = useWorkspaceStore.getState().ui.backgroundImage;
    expect(updatedBackground).not.toBeNull();
    expect(updatedBackground?.x).toBeCloseTo(1 + 20 / transformScale);
    expect(updatedBackground?.y).toBeCloseTo(2 - 40 / transformScale);
  });

  it('round-trips background image position through App export and import', async () => {
    render(<App />);

    await loadBackgroundImageFromToolbar({
      width: 320,
      height: 180,
    });

    fireEvent.change(screen.getByLabelText('X (m)'), {
      target: { value: '1.25' },
    });
    fireEvent.change(screen.getByLabelText('Y (m)'), {
      target: { value: '-2.5' },
    });
    fireEvent.change(screen.getByLabelText('Scale'), {
      target: { value: '0.75' },
    });
    fireEvent.change(screen.getByLabelText('Opacity'), {
      target: { value: '0.35' },
    });

    const expectedBackground = useWorkspaceStore.getState().ui.backgroundImage;
    expect(expectedBackground).not.toBeNull();

    const exportedJson = exportWorkspaceJsonFromToolbar();

    openFileMenu();
    fireEvent.click(screen.getByRole('button', { name: 'new workspace' }));

    await waitFor(() => {
      expect(useWorkspaceStore.getState().ui.backgroundImage).toBeNull();
    });

    await importWorkspaceJson(exportedJson);

    const restoredBackground = useWorkspaceStore.getState().ui.backgroundImage;
    expect(restoredBackground).not.toBeNull();
    expect(restoredBackground?.x).toBeCloseTo(expectedBackground?.x ?? 0);
    expect(restoredBackground?.y).toBeCloseTo(expectedBackground?.y ?? 0);
    expect(restoredBackground?.scale).toBeCloseTo(
      expectedBackground?.scale ?? 0,
    );
    expect(restoredBackground?.alpha).toBeCloseTo(
      expectedBackground?.alpha ?? 0,
    );
  });

  it('writes csv files into a user-selected directory in supported browsers', async () => {
    const directoryExport = createDirectoryExportMock('robot-csv');

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 360, 170);

    act(() => {
      useWorkspaceStore.getState().addPath();
    });

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 240, 230);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 360, 230);

    openFileMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    await waitFor(() => {
      expect(directoryExport.showDirectoryPicker).toHaveBeenCalledWith({
        mode: 'readwrite',
      });
      expect(directoryExport.getFileHandle).toHaveBeenCalledTimes(2);
    });

    expect(directoryExport.getFileHandle).toHaveBeenNthCalledWith(
      1,
      'path-1.csv',
      { create: true },
    );
    expect(directoryExport.getFileHandle).toHaveBeenNthCalledWith(
      2,
      'path-2.csv',
      { create: true },
    );
    const firstWrittenBlob = directoryExport.write.mock.calls[0]?.[0];

    expect(firstWrittenBlob).toBeInstanceOf(Blob);

    if (!(firstWrittenBlob instanceof Blob)) {
      throw new TypeError('expected csv blob');
    }

    expect(await firstWrittenBlob.text()).toContain('x,y,theta');
    expect(screen.getByText(/フォルダ「robot-csv」/)).toBeInTheDocument();
  });

  it('writes workspace json into a user-selected directory in supported browsers', async () => {
    const directoryExport = createDirectoryExportMock('workspace-export');

    render(<App />);

    openFileMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Save Workspace' }));

    await waitFor(() => {
      expect(directoryExport.showDirectoryPicker).toHaveBeenCalledWith({
        mode: 'readwrite',
      });
      expect(directoryExport.getFileHandle).toHaveBeenCalledWith(
        'workspace.json',
        { create: true },
      );
    });

    const writtenBlob = directoryExport.write.mock.calls[0]?.[0];
    expect(writtenBlob).toBeInstanceOf(Blob);

    if (!(writtenBlob instanceof Blob)) {
      throw new TypeError('expected workspace json blob');
    }

    await expect(writtenBlob.text()).resolves.toContain('"workspace"');
    expect(
      screen.getByText(/フォルダ「workspace-export」/),
    ).toBeInTheDocument();
  });

  it('falls back to download-based json export in unsupported browsers', async () => {
    setDirectoryPickerSupport(undefined, false);
    const downloadSpy = vi
      .spyOn(workspaceIO, 'downloadText')
      .mockImplementation(() => undefined);

    render(<App />);

    const expectedJson = workspaceIO.serializeWorkspace(
      getWorkspacePersistedState(),
    );

    openFileMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Save Workspace' }));

    await waitFor(() => {
      expect(downloadSpy).toHaveBeenCalledWith(
        'workspace.json',
        expectedJson,
        'application/json',
      );
    });
  });

  it('falls back to download-based csv export in unsupported browsers', async () => {
    setDirectoryPickerSupport(undefined, false);
    const downloadSpy = vi
      .spyOn(workspaceIO, 'downloadText')
      .mockImplementation(() => undefined);

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 360, 170);

    act(() => {
      useWorkspaceStore.getState().addPath();
    });

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 240, 230);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 360, 230);

    openFileMenu();

    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled();
    expect(
      screen.queryByText(/対応ブラウザでのみ利用できます/),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    await waitFor(() => {
      expect(downloadSpy).toHaveBeenCalledTimes(2);
    });

    expect(downloadSpy).toHaveBeenNthCalledWith(
      1,
      'path-1.csv',
      expect.stringContaining('x,y,theta'),
      'text/csv;charset=utf-8',
    );
    expect(downloadSpy).toHaveBeenNthCalledWith(
      2,
      'path-2.csv',
      expect.stringContaining('x,y,theta'),
      'text/csv;charset=utf-8',
    );
  });

  it('does not show a csv error banner when directory picking is cancelled', async () => {
    const showDirectoryPicker = vi.fn(() =>
      Promise.reject(
        new DOMException('The user aborted a request.', 'AbortError'),
      ),
    );
    setDirectoryPickerSupport(showDirectoryPicker);

    render(<App />);

    setCsvTargetFromToolbar('active');
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    await waitFor(() => {
      expect(showDirectoryPicker).toHaveBeenCalledWith({
        mode: 'readwrite',
      });
    });

    expect(
      screen.queryByText(/CSVの書き込みに失敗しました/),
    ).not.toBeInTheDocument();
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

  it('round-trips robot settings through App export and import', async () => {
    render(<App />);

    openSettingsMenu();
    fireEvent.change(screen.getByLabelText('Robot Length (m)'), {
      target: { value: '1.25' },
    });
    fireEvent.change(screen.getByLabelText('Robot Width (m)'), {
      target: { value: '0.92' },
    });
    fireEvent.change(screen.getByLabelText('Max Velocity (m/s)'), {
      target: { value: '3.4' },
    });
    fireEvent.click(screen.getByLabelText('Robot Preview'));

    const exportedJson = exportWorkspaceJsonFromToolbar();

    openFileMenu();
    fireEvent.click(screen.getByRole('button', { name: 'new workspace' }));
    expect(useWorkspaceStore.getState().ui.robotSettings.length).not.toBe(1.25);

    await importWorkspaceJsonFile(exportedJson);

    expect(useWorkspaceStore.getState().ui.robotSettings.length).toBeCloseTo(
      1.25,
    );
    expect(useWorkspaceStore.getState().ui.robotSettings.width).toBeCloseTo(
      0.92,
    );
    expect(useWorkspaceStore.getState().ui.robotPreviewEnabled).toBe(false);
    expect(
      useWorkspaceStore.getState().ui.robotSettings.maxVelocity,
    ).toBeCloseTo(3.4);

    openSettingsMenu();
    expect(screen.getByLabelText('Robot Preview')).not.toBeChecked();
  });

  it('does not increase canUndo when only dragging the background image', () => {
    render(<App />);

    act(() => {
      useWorkspaceStore.getState().setBackgroundImage({
        url: 'data:image/png;base64,dGVzdA==',
        width: 100,
        height: 50,
        x: 0,
        y: 0,
        scale: 1,
        alpha: 0.5,
      });
    });

    const canvas = getCanvas();
    const dragStart = getBackgroundImageDragStartPoint();
    const undoButton = screen.getByRole('button', { name: 'undo workspace' });

    expect(useWorkspaceStore.getState().canUndo()).toBe(false);
    expect(undoButton).toBeDisabled();

    act(() => {
      useWorkspaceStore.getState().setTool('edit-image');
    });

    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: dragStart.x,
      clientY: dragStart.y,
      pointerId: 303,
    });
    fireEvent.pointerMove(canvas, {
      clientX: dragStart.x + 40,
      clientY: dragStart.y - 20,
      pointerId: 303,
    });
    fireEvent.pointerUp(canvas, {
      button: 0,
      clientX: dragStart.x + 40,
      clientY: dragStart.y - 20,
      pointerId: 303,
    });

    expect(useWorkspaceStore.getState().ui.backgroundImage?.x).not.toBe(0);
    expect(useWorkspaceStore.getState().ui.backgroundImage?.y).not.toBe(0);
    expect(useWorkspaceStore.getState().canUndo()).toBe(false);
    expect(undoButton).toBeDisabled();
  });

  it.each(['pointercancel', 'pointerleave'] as const)(
    'safely stops background image drag on %s',
    (finishEvent) => {
      render(<App />);

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

      const canvas = getCanvas();
      const stageContent = getStageContent();
      const dragStart = getBackgroundImageDragStartPoint();

      act(() => {
        useWorkspaceStore.getState().setTool('edit-image');
      });

      fireEvent.pointerDown(canvas, {
        button: 0,
        clientX: dragStart.x,
        clientY: dragStart.y,
        pointerId: 304,
      });
      fireEvent.pointerMove(canvas, {
        clientX: dragStart.x + 40,
        clientY: dragStart.y - 20,
        pointerId: 304,
      });

      const draggedBackground = useWorkspaceStore.getState().ui.backgroundImage;
      expect(draggedBackground).not.toBeNull();
      expect(useWorkspaceStore.getState().ui.isDragging).toBe(true);

      if (finishEvent === 'pointercancel') {
        fireEvent.pointerCancel(stageContent, {
          clientX: dragStart.x + 40,
          clientY: dragStart.y - 20,
          pointerId: 304,
        });
      } else {
        fireEvent.pointerLeave(stageContent, {
          clientX: dragStart.x + 40,
          clientY: dragStart.y - 20,
          pointerId: 304,
        });
      }

      expect(useWorkspaceStore.getState().ui.isDragging).toBe(false);

      fireEvent.pointerMove(canvas, {
        clientX: dragStart.x + 80,
        clientY: dragStart.y - 60,
        pointerId: 304,
      });

      expect(useWorkspaceStore.getState().ui.backgroundImage?.x).toBeCloseTo(
        draggedBackground?.x ?? 0,
      );
      expect(useWorkspaceStore.getState().ui.backgroundImage?.y).toBeCloseTo(
        draggedBackground?.y ?? 0,
      );
    },
  );

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

  it('shows a clear error when importing invalid workspace json', async () => {
    render(<App />);

    const invalidFile = new File(
      ['{"version":0,"workspace":{}}'],
      'old-workspace.json',
      {
        type: 'application/json',
      },
    );

    openFileMenu();
    fireEvent.change(screen.getByLabelText('load workspace file'), {
      target: { files: [invalidFile] },
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'JSONの読み込みに失敗しました。',
      );
    });
  });

  it('adds a library point to the active path tail', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 360, 170);

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

  it('shows heading point inspector in heading mode and keeps robot heading editable', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    const canvas = getCanvas();
    canvasClick(canvas, 260, 180);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 360, 180);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));

    fireEvent.click(screen.getByRole('button', { name: 'Heading' }));

    const headingPoint = getSectionScreenPoint(0, 0.35);

    fireEvent.pointerDown(canvas, {
      clientX: headingPoint.x,
      clientY: headingPoint.y,
      button: 0,
      pointerId: 73,
    });
    fireEvent.pointerUp(canvas, {
      clientX: headingPoint.x,
      clientY: headingPoint.y,
      button: 0,
      pointerId: 73,
    });

    expect(
      screen.getByLabelText('heading point robot heading'),
    ).not.toBeDisabled();
    expect(screen.getByText('On Path')).toBeInTheDocument();
  });

  it('edits a heading point name from the heading point inspector', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    const canvas = getCanvas();
    canvasClick(canvas, 260, 180);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 360, 180);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));

    fireEvent.click(screen.getByRole('button', { name: 'Heading' }));

    const headingPoint = getSectionScreenPoint(0, 0.35);

    fireEvent.pointerDown(canvas, {
      clientX: headingPoint.x,
      clientY: headingPoint.y,
      button: 0,
      pointerId: 91,
    });
    fireEvent.pointerUp(canvas, {
      clientX: headingPoint.x,
      clientY: headingPoint.y,
      button: 0,
      pointerId: 91,
    });

    const headingLabelInput =
      await screen.findByLabelText('heading point name');
    fireEvent.change(headingLabelInput, { target: { value: 'Aim In' } });

    await waitFor(() => {
      expect(
        useWorkspaceStore.getState().domain.paths[0]?.headingKeyframes[0]?.name,
      ).toBe('Aim In');
      expect(
        screen.getByRole('button', { name: 'Select heading keyframe Aim In' }),
      ).toBeInTheDocument();
    });
  });

  it('lets you grab the robot heading handle when the heading is auto', async () => {
    render(<App />);

    const addPointTool = screen.getByRole('button', { name: 'tool add point' });
    fireEvent.click(addPointTool);

    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(addPointTool);
    canvasClick(canvas, 360, 240);
    fireEvent.click(screen.getByRole('button', { name: 'tool select' }));

    fireEvent.pointerDown(canvas, {
      clientX: 360,
      clientY: 240,
      button: 0,
      pointerId: 81,
    });
    fireEvent.pointerUp(canvas, {
      clientX: 360,
      clientY: 240,
      button: 0,
      pointerId: 81,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Heading' }));

    const robotHeadingInput = screen.getByLabelText('waypoint robot heading');
    expect(robotHeadingInput.getAttribute('placeholder')).toMatch(/Auto/);

    const handlePoint = getSelectedWaypointRobotHeadingHandleScreenPoint();
    fireEvent.pointerDown(canvas, {
      clientX: handlePoint.x,
      clientY: handlePoint.y,
      button: 0,
      pointerId: 82,
    });
    fireEvent.pointerMove(canvas, {
      clientX: handlePoint.x - 50,
      clientY: handlePoint.y,
      pointerId: 82,
    });
    fireEvent.pointerUp(canvas, {
      clientX: handlePoint.x - 50,
      clientY: handlePoint.y,
      button: 0,
      pointerId: 82,
    });

    await waitFor(() => {
      const draggedHeading = Number(
        screen.getByLabelText<HTMLInputElement>('waypoint robot heading').value,
      );
      expect(Number.isFinite(draggedHeading)).toBe(true);
    });
    expect(
      screen.getByRole('button', { name: 'reset robot heading to auto' }),
    ).toBeInTheDocument();
  });

  it('resets a manual robot heading to auto on double click', async () => {
    render(<App />);

    const addPointTool = screen.getByRole('button', { name: 'tool add point' });
    fireEvent.click(addPointTool);

    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(addPointTool);
    canvasClick(canvas, 360, 240);
    fireEvent.click(screen.getByRole('button', { name: 'tool select' }));

    canvasClick(canvas, 360, 240);
    fireEvent.click(screen.getByRole('button', { name: 'Heading' }));

    const handlePoint = getSelectedWaypointRobotHeadingHandleScreenPoint();
    fireEvent.pointerDown(canvas, {
      clientX: handlePoint.x,
      clientY: handlePoint.y,
      button: 0,
      pointerId: 83,
    });
    fireEvent.pointerMove(canvas, {
      clientX: handlePoint.x - 50,
      clientY: handlePoint.y,
      pointerId: 83,
    });
    fireEvent.pointerUp(canvas, {
      clientX: handlePoint.x - 50,
      clientY: handlePoint.y,
      button: 0,
      pointerId: 83,
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'reset robot heading to auto' }),
      ).toBeInTheDocument();
    });

    const updatedHandlePoint =
      getSelectedWaypointRobotHeadingHandleScreenPoint();
    canvasDoubleClick(canvas, updatedHandlePoint.x, updatedHandlePoint.y);

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'reset robot heading to auto' }),
      ).not.toBeInTheDocument();
      expect(screen.getByLabelText('waypoint robot heading')).toHaveValue(null);
    });
  });

  it('adds heading points on the curved path geometry in heading mode', async () => {
    render(<App />);

    const addPointTool = screen.getByRole('button', { name: 'tool add point' });
    fireEvent.click(addPointTool);

    const canvas = getCanvas();
    addPointWithHeadingDrag({
      canvas,
      startX: 240,
      startY: 170,
      endX: 320,
      endY: 170,
      pointerId: 71,
    });

    fireEvent.click(addPointTool);
    addPointWithHeadingDrag({
      canvas,
      startX: 360,
      startY: 240,
      endX: 360,
      endY: 180,
      pointerId: 72,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Heading' }));
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));

    const curvedHeadingPoint = getSectionScreenPoint(0, 0.3);

    fireEvent.pointerDown(canvas, {
      clientX: curvedHeadingPoint.x,
      clientY: curvedHeadingPoint.y,
      button: 0,
      pointerId: 74,
    });
    fireEvent.pointerUp(canvas, {
      clientX: curvedHeadingPoint.x,
      clientY: curvedHeadingPoint.y,
      button: 0,
      pointerId: 74,
    });

    await waitFor(() => {
      expect(
        screen.getByLabelText('heading point properties'),
      ).toBeInTheDocument();
    });

    const headingPoint =
      useWorkspaceStore.getState().domain.paths[0]?.headingKeyframes[0];
    expect(headingPoint).toBeDefined();
    expect(headingPoint?.sectionRatio).not.toBeCloseTo(0.5, 2);
  });

  it('shows section rMin controls when a section is selected', async () => {
    render(<App />);

    // Switch to Add Point tool
    const addPointTool = screen.getByRole('button', { name: 'tool add point' });
    fireEvent.click(addPointTool);

    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);

    // Switch to Add Point tool again
    fireEvent.click(addPointTool);
    canvasClick(canvas, 360, 170);

    // After the second click, it automatically switches back to Select
    // but the test previously clicked selectTool explicitly, so we can keep finding it
    const selectTool = screen.getByRole('button', { name: 'tool select' });
    fireEvent.click(selectTool);

    // The test environment doesn't perfectly emulate hit detection coordinates,
    // so we simulate the pointer event with coordinates precisely matching
    // where the section is calculated to trigger `bestIndex = 0`.
    // Waypoints are at 240,170 and 360,170. Center is 300,170.
    fireEvent.pointerDown(canvas, {
      clientX: 300,
      clientY: 170,
      button: 0,
      pointerId: 1,
    });
    fireEvent.pointerUp(canvas, {
      clientX: 300,
      clientY: 170,
      button: 0,
      pointerId: 1,
    });

    await waitFor(() => {
      const sectionInput = screen.getByLabelText('section r min');
      expect(sectionInput).toBeInTheDocument();
    });
    const sectionInput = screen.getByLabelText('section r min');
    fireEvent.change(sectionInput, { target: { value: '0.077' } });
    expect(sectionInput).toHaveValue(0.077);
  });

  it('updates section rMin by typing into the input field', async () => {
    render(<App />);

    // Switch to Add Point tool
    const addPointTool = screen.getByRole('button', { name: 'tool add point' });
    fireEvent.click(addPointTool);

    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);

    // Switch to Add Point tool again
    fireEvent.click(addPointTool);
    canvasClick(canvas, 360, 170);

    // After the second click, it automatically switches back to Select
    const selectTool = screen.getByRole('button', { name: 'tool select' });
    fireEvent.click(selectTool);

    fireEvent.pointerDown(canvas, {
      clientX: 300,
      clientY: 170,
      button: 0,
      pointerId: 1,
    });
    fireEvent.pointerUp(canvas, {
      clientX: 300,
      clientY: 170,
      button: 0,
      pointerId: 1,
    });

    await waitFor(() => {
      expect(screen.getByLabelText('section r min')).toBeInTheDocument();
    });

    const sectionInput = screen.getByLabelText('section r min');
    expect(sectionInput).toHaveValue(null);
    expect(sectionInput).toHaveAttribute('placeholder');

    fireEvent.change(sectionInput, { target: { value: '0.042' } });

    const refreshedSectionInput = screen.getByLabelText('section r min');
    expect(Number((refreshedSectionInput as HTMLInputElement).value)).toBe(
      0.042,
    );
  });

  it('resets a manual section rMin to auto on double click', async () => {
    render(<App />);

    const addPointTool = screen.getByRole('button', { name: 'tool add point' });
    fireEvent.click(addPointTool);

    const canvas = getCanvas();
    addPointWithHeadingDrag({
      canvas,
      startX: 240,
      startY: 170,
      endX: 320,
      endY: 170,
      pointerId: 91,
    });

    fireEvent.click(addPointTool);
    addPointWithHeadingDrag({
      canvas,
      startX: 360,
      startY: 240,
      endX: 360,
      endY: 180,
      pointerId: 92,
    });

    fireEvent.click(screen.getByRole('button', { name: 'tool select' }));

    const sectionPoint = getSectionScreenPoint(0, 0.45);
    canvasClick(canvas, sectionPoint.x, sectionPoint.y);

    const sectionInput = await screen.findByLabelText('section r min');
    fireEvent.change(sectionInput, { target: { value: '1.25' } });

    await waitFor(() => {
      expect(screen.getByLabelText('section r min')).toHaveValue(1.25);
    });

    const handlePoint = getSelectedSectionRMinHandleScreenPoint();
    canvasDoubleClick(canvas, handlePoint.x, handlePoint.y);

    await waitFor(() => {
      expect(screen.getByLabelText('section r min')).toHaveValue(null);
      expect(
        screen.getByLabelText('section r min').getAttribute('placeholder'),
      ).toMatch(/Auto/);
    });
  });

  it('clears the section inspector when clicking canvas background', async () => {
    render(<App />);

    const addPointTool = screen.getByRole('button', { name: 'tool add point' });
    fireEvent.click(addPointTool);

    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(addPointTool);
    canvasClick(canvas, 360, 170);
    fireEvent.click(screen.getByRole('button', { name: 'tool select' }));

    fireEvent.pointerDown(canvas, {
      clientX: 300,
      clientY: 170,
      button: 0,
      pointerId: 41,
    });
    fireEvent.pointerUp(canvas, {
      clientX: 300,
      clientY: 170,
      button: 0,
      pointerId: 41,
    });

    await waitFor(() => {
      expect(screen.getByLabelText('floating inspector')).toBeInTheDocument();
    });

    canvasClick(canvas, 100, 100);

    await waitFor(() => {
      expect(
        screen.queryByLabelText('floating inspector'),
      ).not.toBeInTheDocument();
    });
  });

  it('keeps the section radius slider linear within the visible section scale', async () => {
    render(<App />);

    const addPointTool = screen.getByRole('button', { name: 'tool add point' });
    fireEvent.click(addPointTool);

    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(addPointTool);
    canvasClick(canvas, 360, 170);
    fireEvent.click(screen.getByRole('button', { name: 'tool select' }));

    fireEvent.pointerDown(canvas, {
      clientX: 300,
      clientY: 170,
      button: 0,
      pointerId: 42,
    });
    fireEvent.pointerUp(canvas, {
      clientX: 300,
      clientY: 170,
      button: 0,
      pointerId: 42,
    });

    const slider = await screen.findByLabelText('section r min slider');
    expect(slider).toHaveAttribute('step', '0.001');
    expect(Number((slider as HTMLInputElement).max)).toBeGreaterThan(1);
  });

  it('commits section slider drag as one undo step', async () => {
    render(<App />);

    const addPointTool = screen.getByRole('button', { name: 'tool add point' });
    fireEvent.click(addPointTool);

    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(addPointTool);
    canvasClick(canvas, 360, 170);
    fireEvent.click(screen.getByRole('button', { name: 'tool select' }));

    fireEvent.pointerDown(canvas, {
      clientX: 300,
      clientY: 170,
      button: 0,
      pointerId: 43,
    });
    fireEvent.pointerUp(canvas, {
      clientX: 300,
      clientY: 170,
      button: 0,
      pointerId: 43,
    });

    const slider = await screen.findByLabelText<HTMLInputElement>(
      'section r min slider',
    );
    const undoButton = screen.getByRole('button', { name: 'undo workspace' });
    const initialSliderValue = Number(slider.value);

    act(() => {
      useWorkspaceStore.getState().clear();
    });

    expect(undoButton).toBeDisabled();
    expect(slider.value).toBe(String(initialSliderValue));

    fireEvent.pointerDown(slider, { pointerId: 44, button: 0 });
    fireEvent.change(slider, { target: { value: '1.2' } });
    fireEvent.change(slider, { target: { value: '1.4' } });

    expect(slider.value).toBe('1.4');
    expect(undoButton).toBeDisabled();

    fireEvent.pointerUp(slider, { pointerId: 44, button: 0 });

    expect(undoButton).toBeEnabled();

    fireEvent.click(undoButton);

    await waitFor(() => {
      expect(
        screen.getByLabelText<HTMLInputElement>('section r min slider').value,
      ).toBe(String(initialSliderValue));
    });

    expect(useWorkspaceStore.getState().canUndo()).toBe(false);
  });

  it('keeps section hit testing aligned with the visible curve after heading changes', async () => {
    render(<App />);

    const addPointTool = screen.getByRole('button', { name: 'tool add point' });
    fireEvent.click(addPointTool);

    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(addPointTool);
    canvasClick(canvas, 360, 240);
    fireEvent.click(screen.getByRole('button', { name: 'tool select' }));

    fireEvent.pointerDown(canvas, {
      clientX: 360,
      clientY: 240,
      button: 0,
      pointerId: 55,
    });
    fireEvent.pointerUp(canvas, {
      clientX: 360,
      clientY: 240,
      button: 0,
      pointerId: 55,
    });

    fireEvent.change(screen.getByLabelText('waypoint path heading'), {
      target: { value: '135' },
    });

    const sectionPoint = getSectionScreenPoint(0, 0.45);

    fireEvent.pointerDown(canvas, {
      clientX: sectionPoint.x,
      clientY: sectionPoint.y,
      button: 0,
      pointerId: 56,
    });
    fireEvent.pointerUp(canvas, {
      clientX: sectionPoint.x,
      clientY: sectionPoint.y,
      button: 0,
      pointerId: 56,
    });

    await waitFor(() => {
      expect(screen.getByLabelText('section r min')).toBeInTheDocument();
    });
  });

  it('keeps auto-selected curved path stable when editing around a boundary-like fixture', async () => {
    render(<App />);

    const addPointTool = screen.getByRole('button', { name: 'tool add point' });
    fireEvent.click(addPointTool);

    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(addPointTool);
    canvasClick(canvas, 360, 290);
    fireEvent.click(screen.getByRole('button', { name: 'tool select' }));

    fireEvent.pointerDown(canvas, {
      clientX: 360,
      clientY: 290,
      button: 0,
      pointerId: 61,
    });
    fireEvent.pointerUp(canvas, {
      clientX: 360,
      clientY: 290,
      button: 0,
      pointerId: 61,
    });

    fireEvent.change(screen.getByLabelText('waypoint path heading'), {
      target: { value: '90' },
    });

    const curvedSectionPoint = getSectionScreenPoint(0, 0.45);

    fireEvent.pointerDown(canvas, {
      clientX: curvedSectionPoint.x,
      clientY: curvedSectionPoint.y,
      button: 0,
      pointerId: 62,
    });
    fireEvent.pointerUp(canvas, {
      clientX: curvedSectionPoint.x,
      clientY: curvedSectionPoint.y,
      button: 0,
      pointerId: 62,
    });

    const sectionInput = await screen.findByLabelText('section r min');
    expect(sectionInput).toBeInTheDocument();
    expect(sectionInput).toHaveAttribute('placeholder');
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
    canvasClick(canvas, 300, 250);

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

  it('previews add point on hover and drags path heading immediately after placement', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));

    const canvas = getCanvas();
    fireEvent.pointerMove(canvas, {
      clientX: 300,
      clientY: 250,
      pointerId: 61,
    });

    expect(screen.getByLabelText('preview waypoint WP 1')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'tool add point' }),
    ).toHaveAttribute('aria-pressed', 'true');

    addPointWithHeadingDrag({
      canvas,
      startX: 300,
      startY: 250,
      endX: 360,
      endY: 250,
      pointerId: 62,
    });

    expect(
      screen.queryByLabelText('preview waypoint WP 1'),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('waypoint path heading')).toHaveValue(270);
    expect(screen.getByRole('button', { name: 'tool select' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
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

  it('prevents waypoint drag while coordinate lock is enabled', () => {
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
    const alertSpy = vi
      .spyOn(globalThis, 'alert')
      .mockImplementation(() => undefined);

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
    expect(alertSpy).toHaveBeenCalled();
  });

  it('resets workspace from toolbar action', () => {
    render(<App />);

    addLibraryPointToPath('Slow Turn');
    expect(
      screen.getByRole('button', { name: 'Select waypoint Slow Turn' }),
    ).toBeInTheDocument();

    openFileMenu();
    fireEvent.click(screen.getByRole('button', { name: 'new workspace' }));
    expect(
      screen.queryByRole('button', { name: 'Select waypoint Slow Turn' }),
    ).not.toBeInTheDocument();
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
