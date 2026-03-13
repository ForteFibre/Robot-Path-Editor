import { act, render, screen } from '@testing-library/react';
import { createElement, useRef, type RefObject } from 'react';
import type Konva from 'konva';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiscretizedPath } from '../../domain/interpolation';
import type { PathModel } from '../../domain/models';
import type { ResolvedPathModel } from '../../domain/pointResolution';
import { useLibraryPointDrop } from '../../features/canvas/hooks/useLibraryPointDrop';

const {
  mockGetPointerWorldFromStage,
  mockResolveDropInsertionAfterWaypointId,
} = vi.hoisted(() => ({
  mockGetPointerWorldFromStage: vi.fn(),
  mockResolveDropInsertionAfterWaypointId: vi.fn(),
}));

vi.mock('../../features/canvas/hooks/canvasHitTesting', () => ({
  getPointerWorldFromStage: mockGetPointerWorldFromStage,
}));

vi.mock('../../features/canvas/dropInsertion', () => ({
  resolveDropInsertionAfterWaypointId: mockResolveDropInsertionAfterWaypointId,
}));

const createActivePath = (): PathModel => ({
  id: 'path-1',
  name: 'Path 1',
  color: '#2563eb',
  visible: true,
  waypoints: [
    {
      id: 'waypoint-1',
      pointId: 'point-1',
      libraryPointId: null,
      pathHeading: 0,
    },
    {
      id: 'waypoint-2',
      pointId: 'point-2',
      libraryPointId: null,
      pathHeading: 90,
    },
  ],
  headingKeyframes: [],
  sectionRMin: [2],
});

const createResolvedPath = (): ResolvedPathModel => ({
  id: 'path-1',
  name: 'Path 1',
  color: '#2563eb',
  visible: true,
  waypoints: [
    {
      id: 'waypoint-1',
      pointId: 'point-1',
      libraryPointId: null,
      name: 'WP 1',
      pathHeading: 0,
      point: {
        id: 'point-1',
        x: 0,
        y: 0,
        robotHeading: null,
        isLibrary: false,
        name: 'WP 1',
      },
      libraryPoint: null,
      x: 0,
      y: 0,
    },
    {
      id: 'waypoint-2',
      pointId: 'point-2',
      libraryPointId: null,
      name: 'WP 2',
      pathHeading: 90,
      point: {
        id: 'point-2',
        x: 4,
        y: 4,
        robotHeading: null,
        isLibrary: false,
        name: 'WP 2',
      },
      libraryPoint: null,
      x: 4,
      y: 4,
    },
  ],
  headingKeyframes: [],
  sectionRMin: [2],
});

const createNativeDragEvent = (
  type: string,
  data: Record<string, string> = {},
): DragEvent => {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
  }) as DragEvent;

  Object.defineProperty(event, 'dataTransfer', {
    configurable: true,
    value: {
      dropEffect: 'none',
      getData: (key: string) => data[key] ?? '',
    } as DataTransfer,
  });

  return event;
};

const DropProbe = ({
  mode,
  activePath,
  resolvedPaths,
  discretizedByPathForInteraction,
  insertLibraryWaypoint,
  stageRef,
}: {
  mode: 'path' | 'heading';
  activePath: PathModel | null;
  resolvedPaths: ResolvedPathModel[];
  discretizedByPathForInteraction: Map<string, DiscretizedPath>;
  insertLibraryWaypoint: (input: {
    pathId: string;
    x: number;
    y: number;
    libraryPointId?: string;
    linkToLibrary?: boolean;
    coordinateSource?: 'input' | 'library';
    afterWaypointId?: string | null;
  }) => string | null;
  stageRef: RefObject<Konva.Stage | null>;
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const { libraryDropPreview } = useLibraryPointDrop({
    canvasHostRef: hostRef,
    stageRef,
    mode,
    activePath,
    resolvedPaths,
    discretizedByPathForInteraction,
    canvasTransform: { x: 0, y: 0, k: 1 },
    insertLibraryWaypoint,
  });

  return createElement(
    'div',
    { ref: hostRef, 'data-testid': 'host' },
    libraryDropPreview.isActive
      ? (libraryDropPreview.label ?? 'active')
      : 'inactive',
  );
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('useLibraryPointDrop', () => {
  it('shows and clears the library drop preview in path mode', async () => {
    const stageRef = {
      current: {
        setPointersPositions: vi.fn(),
      } as unknown as Konva.Stage,
    };

    render(
      createElement(DropProbe, {
        mode: 'path',
        activePath: createActivePath(),
        resolvedPaths: [createResolvedPath()],
        discretizedByPathForInteraction: new Map([
          ['path-1', {} as DiscretizedPath],
        ]),
        insertLibraryWaypoint: vi.fn(),
        stageRef,
      }),
    );

    const host = screen.getByTestId('host');
    act(() => {
      host.dispatchEvent(
        createNativeDragEvent('dragenter', {
          'application/x-point-library-name': 'Library Alpha',
        }),
      );
    });
    expect(await screen.findByText('Library Alpha')).toBeInTheDocument();

    act(() => {
      host.dispatchEvent(createNativeDragEvent('dragleave'));
    });
    expect(screen.getByText('inactive')).toBeInTheDocument();
  });

  it('does nothing outside path mode', () => {
    const insertLibraryWaypoint = vi.fn();
    const stageRef = {
      current: {
        setPointersPositions: vi.fn(),
      } as unknown as Konva.Stage,
    };

    render(
      createElement(DropProbe, {
        mode: 'heading',
        activePath: createActivePath(),
        resolvedPaths: [createResolvedPath()],
        discretizedByPathForInteraction: new Map([
          ['path-1', {} as DiscretizedPath],
        ]),
        insertLibraryWaypoint,
        stageRef,
      }),
    );

    const host = screen.getByTestId('host');
    act(() => {
      host.dispatchEvent(
        createNativeDragEvent('dragenter', {
          'application/x-point-library-name': 'Ignored',
        }),
      );
      host.dispatchEvent(
        createNativeDragEvent('drop', {
          'application/x-point-library-id': 'library-1',
        }),
      );
    });

    expect(screen.getByText('inactive')).toBeInTheDocument();
    expect(insertLibraryWaypoint).not.toHaveBeenCalled();
  });

  it('resolves insertion position and inserts the library waypoint on drop', () => {
    const activePath = createActivePath();
    const resolvedPath = createResolvedPath();
    const detailMap = new Map([['path-1', {} as DiscretizedPath]]);
    const insertLibraryWaypoint = vi.fn(() => 'inserted-waypoint');
    const setPointersPositions = vi.fn();
    const stageRef = {
      current: {
        setPointersPositions,
      } as unknown as Konva.Stage,
    };

    mockGetPointerWorldFromStage.mockReturnValue({ x: 12, y: 34 });
    mockResolveDropInsertionAfterWaypointId.mockReturnValue('waypoint-1');

    render(
      createElement(DropProbe, {
        mode: 'path',
        activePath,
        resolvedPaths: [resolvedPath],
        discretizedByPathForInteraction: detailMap,
        insertLibraryWaypoint,
        stageRef,
      }),
    );

    const host = screen.getByTestId('host');
    act(() => {
      host.dispatchEvent(
        createNativeDragEvent('dragenter', {
          'application/x-point-library-name': 'Library Point',
        }),
      );
      host.dispatchEvent(
        createNativeDragEvent('drop', {
          'application/x-point-library-id': 'library-1',
        }),
      );
    });

    expect(setPointersPositions).toHaveBeenCalled();
    expect(mockGetPointerWorldFromStage).toHaveBeenCalledWith(
      stageRef.current,
      { x: 0, y: 0, k: 1 },
    );
    expect(mockResolveDropInsertionAfterWaypointId).toHaveBeenCalledWith({
      activePath: resolvedPath,
      detail: detailMap.get('path-1'),
      worldPoint: { x: 12, y: 34 },
    });
    expect(insertLibraryWaypoint).toHaveBeenCalledWith({
      pathId: 'path-1',
      libraryPointId: 'library-1',
      x: 12,
      y: 34,
      linkToLibrary: true,
      coordinateSource: 'library',
      afterWaypointId: 'waypoint-1',
    });
    expect(screen.getByText('inactive')).toBeInTheDocument();
  });
});
