import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from 'react';
import type Konva from 'konva';
import { Group, Image as KonvaImage, Layer, Line, Stage } from 'react-konva';
import {
  buildHeadingKeyframeRanges,
  discretizePathDetailed,
  getHeadingKeyframeRangePolyline,
  resolveDiscretizedHeadingKeyframes,
  type DiscretizedPath,
} from '../../domain/interpolation';
import {
  computeDubinsArcCentersForPath,
  type DubinsCenters,
} from '../../domain/dubins';
import {
  resolveSectionDubins,
  resolveSectionRMin,
} from '../../domain/sectionRadius';
import {
  createPointIndex,
  resolvePathModel,
  type ResolvedHeadingKeyframe,
  type ResolvedPathModel,
  type ResolvedWaypoint,
} from '../../domain/pointResolution';
import {
  EMPTY_SNAP_GUIDE,
  worldToCanvasPoint,
  type Point,
  type SnapGuide,
} from '../../domain/geometry';
import { computePathTiming } from '../../domain/pathTiming';
import {
  toBackgroundImageCanvasOrigin,
  toBackgroundImageCanvasRenderState,
} from '../../domain/backgroundImage';
import { getCanvasRenderStep } from '../../domain/canvas';
import { buildPathTimingGeometry } from '../../domain/pathTimingSegments';
import type { SelectionState } from '../../domain/models';
import { useWorkspaceActions } from '../../store/workspaceStore';
import {
  useActivePath,
  useBackgroundImage,
  useCanvasTransform,
  useEditorMode,
  useEditorTool,
  useLockedPointIds,
  usePoints,
  useRobotPreviewEnabled,
  usePaths,
  useRobotSettings,
  useSelection,
  useSnapPanelOpen,
  useSnapSettings,
} from '../../store/workspaceSelectors';

import { CanvasGrid } from './components/CanvasGrid';
import { CanvasGuides } from './components/CanvasGuides';
import { CanvasHeadingKeyframe } from './components/CanvasHeadingKeyframe';
import { resolveWaypointRobotHeadingHandleAngle } from './waypointHeading';
import { CanvasPath } from './components/CanvasPath';
import { CanvasPathVelocityOverlay } from './components/CanvasPathVelocityOverlay';
import {
  CanvasRMinDrag,
  type RMinDragTarget,
} from './components/CanvasRMinDrag';
import { CanvasRobotLayer } from './components/CanvasRobotLayer';
import { CanvasWaypoint } from './components/CanvasWaypoint';
import { SnapSettingsPanel } from './components/SnapSettingsPanel';
import {
  useCanvasPointerMachine,
  type CanvasDoubleClickEvent,
  type CanvasPointerEvent,
  type AddPointPreviewState,
} from './hooks/useCanvasPointerMachine';
import { getPointerWorldFromStage } from './hooks/canvasHitTesting';
import { usePathAnimation } from './hooks/usePathAnimation';
import { useCanvasWheel } from './hooks/useCanvasWheel';
import { useLoadedImage } from './hooks/useLoadedImage';
import { resolveDropInsertionAfterWaypointId } from './dropInsertion';
import styles from './PathCanvas.module.css';

const resolveRMinDragTargets = (
  paths: ResolvedPathModel[],
  selection: SelectionState,
  draggingWaypointId: string | null,
  draggingPathId: string | null,
): RMinDragTarget[] => {
  const targetPathId = selection.pathId ?? draggingPathId;
  if (targetPathId === null) {
    return [];
  }

  const targetPath = paths.find((path) => path.id === targetPathId);
  if (targetPath === undefined || targetPath.waypoints.length < 2) {
    return [];
  }

  const getSectionCenters = (sectionIndex: number): DubinsCenters | null => {
    const start = targetPath.waypoints[sectionIndex];
    const end = targetPath.waypoints[sectionIndex + 1];
    if (start === undefined || end === undefined) {
      return null;
    }

    const rMin = resolveSectionRMin(targetPath, sectionIndex);
    if (rMin === null) {
      return null;
    }

    const resolved = resolveSectionDubins(
      start,
      end,
      targetPath.sectionRMin[sectionIndex] ?? null,
    );
    if (resolved === null) {
      return null;
    }

    return computeDubinsArcCentersForPath(
      { x: start.x, y: start.y, headingDeg: start.pathHeading },
      resolved.path,
      resolved.turningRadius,
    );
  };

  const mapCenters = (
    centers: DubinsCenters | null,
    startIndex: number,
  ): RMinDragTarget[] => {
    if (centers === null) {
      return [];
    }
    const start = targetPath.waypoints[startIndex];
    const end = targetPath.waypoints[startIndex + 1];
    if (start === undefined || end === undefined) {
      return [];
    }

    const rMin = resolveSectionRMin(targetPath, startIndex);
    if (rMin === null) {
      return [];
    }

    const results: RMinDragTarget[] = [];
    const firstCenter = centers.startCenter;
    const lastCenter = centers.endCenter;
    const isAuto =
      targetPath.sectionRMin[startIndex] === null ||
      targetPath.sectionRMin[startIndex] === undefined;

    if (firstCenter !== undefined) {
      results.push({
        pathId: targetPath.id,
        sectionIndex: startIndex,
        center: firstCenter,
        waypointPoint: { x: start.x, y: start.y },
        rMin,
        isAuto,
      });
    }

    if (lastCenter !== undefined) {
      results.push({
        pathId: targetPath.id,
        sectionIndex: startIndex,
        center: lastCenter,
        waypointPoint: { x: end.x, y: end.y },
        rMin,
        isAuto,
      });
    }

    return results;
  };

  if (selection.sectionIndex !== null) {
    return mapCenters(
      getSectionCenters(selection.sectionIndex),
      selection.sectionIndex,
    );
  }

  const waypointIds = new Set<string>();
  if (selection.waypointId !== null) {
    waypointIds.add(selection.waypointId);
  }
  if (draggingWaypointId !== null) {
    waypointIds.add(draggingWaypointId);
  }

  if (waypointIds.size === 0) {
    return [];
  }

  const results: RMinDragTarget[] = [];
  const existingKeys = new Set<string>();

  const addUnique = (targets: RMinDragTarget[]): void => {
    for (const target of targets) {
      const key = `${target.sectionIndex}-${target.center.x.toFixed(
        6,
      )}-${target.center.y.toFixed(6)}`;
      if (existingKeys.has(key)) {
        continue;
      }

      existingKeys.add(key);
      results.push(target);
    }
  };

  for (const waypointId of waypointIds) {
    const waypointIndex = targetPath.waypoints.findIndex(
      (waypoint) => waypoint.id === waypointId,
    );
    if (waypointIndex < 0) {
      continue;
    }

    if (waypointIndex > 0) {
      const previousSectionIndex = waypointIndex - 1;
      addUnique(
        mapCenters(
          getSectionCenters(previousSectionIndex),
          previousSectionIndex,
        ),
      );
    }

    if (waypointIndex < targetPath.waypoints.length - 1) {
      addUnique(mapCenters(getSectionCenters(waypointIndex), waypointIndex));
    }
  }

  return results;
};

const buildPreviewWaypoint = (
  preview: AddPointPreviewState,
  name: string,
): ResolvedWaypoint => {
  if (preview.kind !== 'path-waypoint') {
    throw new Error('preview waypoint requires path waypoint preview');
  }

  return {
    id: 'add-point-preview-waypoint',
    pointId: 'add-point-preview-point',
    libraryPointId: null,
    name,
    pathHeading: preview.pathHeading,
    point: {
      id: 'add-point-preview-point',
      x: preview.point.x,
      y: preview.point.y,
      robotHeading: null,
      isLibrary: false,
      name,
    },
    libraryPoint: null,
    x: preview.point.x,
    y: preview.point.y,
  };
};

const toCanvasPointNumbers = (polyline: Point[]): number[] => {
  return polyline.flatMap((point) => {
    const canvasPoint = worldToCanvasPoint(point);
    return [canvasPoint.x, canvasPoint.y];
  });
};

const renderPreviewGuideLine = (
  sourcePoint: Point | null,
  destinationPoint: Point,
  color: string,
  k: number,
): ReactElement | null => {
  if (sourcePoint === null) {
    return null;
  }

  const source = worldToCanvasPoint(sourcePoint);
  const destination = worldToCanvasPoint(destinationPoint);

  return (
    <Line
      points={[source.x, source.y, destination.x, destination.y]}
      stroke={color}
      strokeWidth={1.5 / k}
      dash={[6 / k, 4 / k]}
      opacity={0.5}
      listening={false}
    />
  );
};

type CanvasPreviewOverlayProps = {
  addPointPreview: AddPointPreviewState | null;
  addPointPreviewPath: ResolvedPathModel | null;
  addPointPreviewWaypoint: ResolvedWaypoint | null;
  addPointPreviewHeadingKeyframe: ResolvedHeadingKeyframe | null;
  k: number;
  mode: 'path' | 'heading';
};

const CanvasPreviewOverlay = ({
  addPointPreview,
  addPointPreviewPath,
  addPointPreviewWaypoint,
  addPointPreviewHeadingKeyframe,
  k,
  mode,
}: CanvasPreviewOverlayProps): ReactElement | null => {
  if (
    addPointPreviewPath === null ||
    (addPointPreviewWaypoint === null &&
      addPointPreviewHeadingKeyframe === null)
  ) {
    return null;
  }

  return (
    <Group listening={false}>
      {addPointPreview?.kind === 'path-waypoint' &&
      addPointPreviewWaypoint !== null ? (
        <>
          {renderPreviewGuideLine(
            addPointPreview.sourcePoint,
            addPointPreview.point,
            addPointPreviewPath.color,
            k,
          )}
          {renderPreviewGuideLine(
            addPointPreview.nextPoint,
            addPointPreview.point,
            addPointPreviewPath.color,
            k,
          )}
          <CanvasWaypoint
            path={addPointPreviewPath}
            waypoint={addPointPreviewWaypoint}
            k={k}
            isSelected={false}
            isBreak={false}
            isCoordinateLocked={false}
            mode={mode}
            isActive={true}
            isPreview={true}
          />
        </>
      ) : null}

      {addPointPreview?.kind === 'heading-keyframe' &&
      addPointPreviewHeadingKeyframe !== null ? (
        <CanvasHeadingKeyframe
          path={addPointPreviewPath}
          headingKeyframe={addPointPreviewHeadingKeyframe}
          k={k}
          isSelected={false}
          mode={mode}
          isActive={true}
          isPreview={true}
        />
      ) : null}
    </Group>
  );
};

type CanvasResolvedPathLayerProps = {
  path: ResolvedPathModel;
  detail: DiscretizedPath | undefined;
  geometrySegments: ReturnType<typeof buildPathTimingGeometry>['segments'];
  selection: SelectionState;
  lockedPointIds: string[];
  activePathId: string | null;
  mode: 'path' | 'heading';
  k: number;
  rMinDragTargets: RMinDragTarget[];
};

const CanvasResolvedPathLayer = ({
  path,
  detail,
  geometrySegments,
  selection,
  lockedPointIds,
  activePathId,
  mode,
  k,
  rMinDragTargets,
}: CanvasResolvedPathLayerProps): ReactElement => {
  const resolvedHeadingKeyframes =
    detail === undefined
      ? []
      : resolveDiscretizedHeadingKeyframes(path, detail);
  const headingRanges = buildHeadingKeyframeRanges(resolvedHeadingKeyframes);

  return (
    <Group listening={false}>
      <CanvasPath
        path={path}
        geometrySegments={geometrySegments}
        discretizedSamples={detail?.samples ?? []}
        k={k}
        isActive={activePathId === path.id}
        mode={mode}
      />

      {path.waypoints.map((waypoint, waypointIndex) => (
        <CanvasWaypoint
          key={waypoint.id}
          path={path}
          waypoint={waypoint}
          k={k}
          isSelected={
            selection.pathId === path.id && selection.waypointId === waypoint.id
          }
          isBreak={false}
          isCoordinateLocked={
            waypoint.libraryPointId !== null &&
            lockedPointIds.includes(waypoint.libraryPointId)
          }
          mode={mode}
          isActive={activePathId === path.id}
          interpolatedRobotHeading={resolveWaypointRobotHeadingHandleAngle(
            path,
            detail,
            waypointIndex,
          )}
        />
      ))}

      {headingRanges.map((range, index) => {
        if (detail === undefined) {
          return null;
        }

        const rangePolyline = getHeadingKeyframeRangePolyline(detail, range);
        if (rangePolyline.length < 2) {
          return null;
        }

        return (
          <Line
            key={`${path.id}-heading-keyframe-range-${index}`}
            points={toCanvasPointNumbers(rangePolyline)}
            stroke="#16a34a"
            strokeWidth={1.5 / k}
            dash={[4 / k, 2 / k]}
            lineJoin="round"
            lineCap="round"
            opacity={mode === 'heading' ? 0.65 : 0.2}
            listening={false}
          />
        );
      })}

      {resolvedHeadingKeyframes.map((headingKeyframe) => (
        <CanvasHeadingKeyframe
          key={headingKeyframe.id}
          path={path}
          headingKeyframe={headingKeyframe}
          k={k}
          isSelected={
            selection.pathId === path.id &&
            selection.headingKeyframeId === headingKeyframe.id
          }
          mode={mode}
          isActive={activePathId === path.id}
        />
      ))}

      {rMinDragTargets
        .filter(
          (target) => target.pathId === path.id && activePathId === path.id,
        )
        .map((target, index) => (
          <CanvasRMinDrag
            key={`rmin-${target.pathId}-${target.sectionIndex}-${index}`}
            rMinDragTarget={target}
            k={k}
          />
        ))}
    </Group>
  );
};

export const PathCanvas = (): ReactElement => {
  const { insertLibraryWaypoint, setSnapPanelOpen, toggleSnapSetting } =
    useWorkspaceActions();
  const mode = useEditorMode();
  const tool = useEditorTool();
  const paths = usePaths();
  const points = usePoints();
  const lockedPointIds = useLockedPointIds();
  const activePath = useActivePath();
  const selection = useSelection();
  const canvasTransform = useCanvasTransform();
  const snapSettings = useSnapSettings();
  const snapPanelOpen = useSnapPanelOpen();
  const backgroundImage = useBackgroundImage();
  const isRobotPreviewEnabled = useRobotPreviewEnabled();
  const robotSettings = useRobotSettings();

  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [addPointPreview, setAddPointPreview] =
    useState<AddPointPreviewState | null>(null);
  const [snapGuide, setSnapGuide] = useState<SnapGuide>(EMPTY_SNAP_GUIDE);
  const [libraryDropPreview, setLibraryDropPreview] = useState<{
    isActive: boolean;
    label: string | null;
  }>({
    isActive: false,
    label: null,
  });

  useEffect(() => {
    if (tool !== 'add-point') {
      setAddPointPreview(null);
      setSnapGuide(EMPTY_SNAP_GUIDE);
    }
  }, [mode, tool]);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (host === null) {
      return;
    }

    const updateViewportSize = (): void => {
      const rect = host.getBoundingClientRect();
      const parentWidth = host.parentElement?.clientWidth;
      const parentHeight = host.parentElement?.clientHeight;
      const fallbackWidth =
        parentWidth !== undefined && parentWidth > 0
          ? parentWidth
          : globalThis.innerWidth;
      const fallbackHeight =
        parentHeight !== undefined && parentHeight > 0
          ? parentHeight
          : globalThis.innerHeight;

      let width = fallbackWidth;
      if (rect.width > 0) {
        width = rect.width;
      }
      if (host.clientWidth > 0) {
        width = host.clientWidth;
      }

      let height = fallbackHeight;
      if (rect.height > 0) {
        height = rect.height;
      }
      if (host.clientHeight > 0) {
        height = host.clientHeight;
      }

      setViewportSize({
        width,
        height,
      });
    };

    updateViewportSize();

    const observer = new ResizeObserver(() => {
      updateViewportSize();
    });

    observer.observe(host);

    return () => {
      observer.disconnect();
    };
  }, []);

  const pointsById = useMemo(() => createPointIndex(points), [points]);
  const resolvedPaths = useMemo(
    () => paths.map((path) => resolvePathModel(path, pointsById)),
    [paths, pointsById],
  );
  const activeResolvedPath = useMemo(() => {
    if (activePath === null) {
      return null;
    }

    return resolvedPaths.find((path) => path.id === activePath.id) ?? null;
  }, [activePath, resolvedPaths]);

  const activePathTiming = useMemo(() => {
    if (activePath?.visible !== true) {
      return null;
    }

    return computePathTiming(activePath, points, robotSettings);
  }, [activePath, points, robotSettings]);

  const activePathAnimationColor = useMemo(() => {
    if (activePath?.visible !== true) {
      return null;
    }

    return activePath.color;
  }, [activePath]);

  const allVisibleWaypointPoints = useMemo(() => {
    const waypointPoints: (Point & { id: string })[] = [];

    for (const path of resolvedPaths) {
      if (!path.visible) {
        continue;
      }

      for (const waypoint of path.waypoints) {
        waypointPoints.push({
          id: waypoint.id,
          x: waypoint.x,
          y: waypoint.y,
        });
      }
    }

    return waypointPoints;
  }, [resolvedPaths]);

  const renderStep = getCanvasRenderStep(canvasTransform.k);
  const deferredPathsForDiscretize = useDeferredValue(paths);
  const deferredPointsForDiscretize = useDeferredValue(points);

  const discretizedByPath = useMemo(() => {
    const byPath = new Map<string, DiscretizedPath>();

    for (const path of deferredPathsForDiscretize) {
      byPath.set(
        path.id,
        discretizePathDetailed(path, deferredPointsForDiscretize, renderStep),
      );
    }

    return byPath;
  }, [deferredPathsForDiscretize, deferredPointsForDiscretize, renderStep]);

  const discretizedByPathForInteraction = useMemo(() => {
    const byPath = new Map<string, DiscretizedPath>();

    for (const path of paths) {
      byPath.set(path.id, discretizePathDetailed(path, points, renderStep));
    }

    return byPath;
  }, [paths, points, renderStep]);

  const geometryByPath = useMemo(() => {
    const byPath = new Map<
      string,
      ReturnType<typeof buildPathTimingGeometry>
    >();

    for (const path of paths) {
      if (!path.visible) {
        continue;
      }

      byPath.set(path.id, buildPathTimingGeometry(path, points));
    }

    return byPath;
  }, [paths, points]);

  const baseRMinDragTargets = useMemo(() => {
    if (mode !== 'path' || tool === 'add-point') {
      return [];
    }

    return resolveRMinDragTargets(resolvedPaths, selection, null, null);
  }, [mode, resolvedPaths, selection, tool]);

  useCanvasWheel(canvasHostRef);

  const pointerHandlers = useCanvasPointerMachine({
    stageRef,
    interactionSurfaceRef: canvasHostRef,
    allVisibleWaypointPoints,
    resolvedPaths,
    discretizedByPath: discretizedByPathForInteraction,
    snapSettings,
    rMinDragTargets: baseRMinDragTargets,
    setSnapGuide,
    setAddPointPreview,
    addPointPreview,
  });

  const { draggingWaypointId, draggingPathId, isRobotAnimationSuppressed } =
    pointerHandlers;
  const isRobotAnimationEnabled =
    !isRobotAnimationSuppressed && isRobotPreviewEnabled;
  const robotAnimation = usePathAnimation(
    activePathTiming,
    isRobotAnimationEnabled,
  );

  const addPointPreviewWaypoint = useMemo(() => {
    if (
      addPointPreview?.kind !== 'path-waypoint' ||
      activeResolvedPath === null
    ) {
      return null;
    }

    return buildPreviewWaypoint(
      addPointPreview,
      `WP ${activeResolvedPath.waypoints.length + 1}`,
    );
  }, [activeResolvedPath, addPointPreview]);

  const addPointPreviewHeadingKeyframe = useMemo(() => {
    if (
      addPointPreview?.kind !== 'heading-keyframe' ||
      activeResolvedPath === null
    ) {
      return null;
    }

    return {
      id: 'add-point-preview-heading-keyframe',
      name: `Heading ${activeResolvedPath.headingKeyframes.length + 1}`,
      sectionIndex: addPointPreview.sectionIndex,
      sectionRatio: addPointPreview.sectionRatio,
      robotHeading: addPointPreview.robotHeading,
      x: addPointPreview.point.x,
      y: addPointPreview.point.y,
      pathHeading: 0,
    } as ResolvedHeadingKeyframe;
  }, [activeResolvedPath, addPointPreview]);

  const addPointPreviewPath = useMemo(() => {
    if (
      (addPointPreviewWaypoint === null &&
        addPointPreviewHeadingKeyframe === null) ||
      activeResolvedPath === null
    ) {
      return null;
    }

    return activeResolvedPath;
  }, [
    activeResolvedPath,
    addPointPreviewWaypoint,
    addPointPreviewHeadingKeyframe,
  ]);

  const rMinDragTargets = useMemo(() => {
    if (
      mode !== 'path' ||
      (tool === 'add-point' && draggingWaypointId === null)
    ) {
      return [];
    }

    return resolveRMinDragTargets(
      resolvedPaths,
      selection,
      draggingWaypointId,
      draggingPathId,
    );
  }, [
    mode,
    resolvedPaths,
    selection,
    draggingWaypointId,
    draggingPathId,
    tool,
  ]);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (host === null) {
      return;
    }

    const handleNativeDragOver = (event: DragEvent): void => {
      event.preventDefault();
      if (event.dataTransfer !== null) {
        event.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleNativeDrop = (event: DragEvent): void => {
      event.preventDefault();
      if (
        mode !== 'path' ||
        activePath === null ||
        event.dataTransfer === null
      ) {
        return;
      }

      const libraryPointId = event.dataTransfer.getData(
        'application/x-point-library-id',
      );
      if (libraryPointId.length === 0) {
        return;
      }

      const stage = stageRef.current;
      if (stage === null) {
        return;
      }

      stage.setPointersPositions(event);
      const world = getPointerWorldFromStage(stage, canvasTransform);
      if (world === null) {
        return;
      }

      const afterWaypointId = resolveDropInsertionAfterWaypointId({
        activePath: activeResolvedPath,
        detail: discretizedByPathForInteraction.get(activePath.id),
        worldPoint: world,
      });

      insertLibraryWaypoint({
        pathId: activePath.id,
        libraryPointId,
        x: world.x,
        y: world.y,
        linkToLibrary: true,
        coordinateSource: 'library',
        afterWaypointId,
      });

      setLibraryDropPreview({
        isActive: false,
        label: null,
      });
    };

    const handleNativeDragLeave = (): void => {
      setLibraryDropPreview({
        isActive: false,
        label: null,
      });
    };

    const handleNativeDragEnter = (event: DragEvent): void => {
      const label = event.dataTransfer?.getData(
        'application/x-point-library-name',
      );

      if (label === undefined) {
        return;
      }

      setLibraryDropPreview({
        isActive: true,
        label: label.length > 0 ? label : null,
      });
    };

    host.addEventListener('dragenter', handleNativeDragEnter);
    host.addEventListener('dragover', handleNativeDragOver);
    host.addEventListener('dragleave', handleNativeDragLeave);
    host.addEventListener('drop', handleNativeDrop);

    return () => {
      host.removeEventListener('dragenter', handleNativeDragEnter);
      host.removeEventListener('dragover', handleNativeDragOver);
      host.removeEventListener('dragleave', handleNativeDragLeave);
      host.removeEventListener('drop', handleNativeDrop);
    };
  }, [
    activePath,
    activeResolvedPath,
    canvasTransform,
    discretizedByPathForInteraction,
    insertLibraryWaypoint,
    mode,
  ]);

  const k = canvasTransform.k;
  const backgroundImageRenderState =
    backgroundImage === null
      ? null
      : toBackgroundImageCanvasRenderState(backgroundImage);
  const backgroundImageCanvasOrigin =
    backgroundImage === null
      ? null
      : toBackgroundImageCanvasOrigin(backgroundImage);
  const backgroundImageElement = useLoadedImage(backgroundImage?.url ?? null);

  const forwardPointerEvent = (
    event: ReactPointerEvent<HTMLDivElement>,
    handler: (event: CanvasPointerEvent) => void,
  ): void => {
    const stage = stageRef.current;
    if (stage !== null) {
      stage.setPointersPositions(event.nativeEvent);
    }

    handler({ evt: event.nativeEvent });
  };

  const forwardDoubleClickEvent = (
    event: MouseEvent,
    handler: (event: CanvasDoubleClickEvent) => void,
  ): void => {
    const stage = stageRef.current;
    if (stage !== null) {
      stage.setPointersPositions(event);
    }

    handler({ evt: event });
  };

  useEffect(() => {
    const host = canvasHostRef.current;
    if (host === null) {
      return;
    }

    const handleDoubleClick = (event: MouseEvent): void => {
      forwardDoubleClickEvent(event, pointerHandlers.onDoubleClick);
    };

    host.addEventListener('dblclick', handleDoubleClick);
    return () => {
      host.removeEventListener('dblclick', handleDoubleClick);
    };
  }, [pointerHandlers.onDoubleClick]);

  return (
    <main className={`canvas-shell ${styles.shell}`} aria-label="main canvas">
      <div
        ref={canvasHostRef}
        className={`path-canvas ${styles.stageCanvas} ${
          mode === 'path' ? styles.editingMode : ''
        }`}
        aria-label="robot path editor canvas"
        onPointerDown={(event) => {
          forwardPointerEvent(event, pointerHandlers.onPointerDown);
        }}
        onPointerMove={(event) => {
          forwardPointerEvent(event, pointerHandlers.onPointerMove);
        }}
        onPointerUp={(event) => {
          forwardPointerEvent(event, pointerHandlers.onPointerUp);
        }}
        onPointerLeave={(event) => {
          forwardPointerEvent(event, pointerHandlers.onPointerLeave);
        }}
        onPointerCancel={(event) => {
          forwardPointerEvent(event, pointerHandlers.onPointerCancel);
        }}
        onLostPointerCapture={(event) => {
          forwardPointerEvent(event, pointerHandlers.onLostPointerCapture);
        }}
        style={{
          touchAction: 'none',
          cursor: pointerHandlers.cursorClass || undefined,
        }}
      >
        {libraryDropPreview.isActive ? (
          <div className={styles.libraryDropOverlay} aria-live="polite">
            <strong>{libraryDropPreview.label ?? 'Library Point'}</strong>{' '}
            をドロップすると、 ライブラリ座標のまま path 順序へ挿入します。
          </div>
        ) : null}

        <Stage
          ref={stageRef}
          width={viewportSize.width}
          height={viewportSize.height}
        >
          <Layer listening={false}>
            <Group
              x={canvasTransform.x}
              y={canvasTransform.y}
              scaleX={k}
              scaleY={k}
              listening={false}
            >
              {backgroundImage !== null &&
              backgroundImageRenderState !== null &&
              backgroundImageCanvasOrigin !== null &&
              backgroundImageElement !== null ? (
                <KonvaImage
                  image={backgroundImageElement}
                  x={
                    backgroundImageCanvasOrigin.x -
                    backgroundImageRenderState.height
                  }
                  y={backgroundImageCanvasOrigin.y}
                  width={backgroundImageRenderState.width}
                  height={backgroundImageRenderState.height}
                  rotation={-90}
                  opacity={backgroundImage.alpha}
                  listening={false}
                />
              ) : null}

              <CanvasGrid
                canvasTransform={canvasTransform}
                k={k}
                viewportWidth={viewportSize.width}
                viewportHeight={viewportSize.height}
              />
            </Group>
          </Layer>

          <Layer>
            <Group
              x={canvasTransform.x}
              y={canvasTransform.y}
              scaleX={k}
              scaleY={k}
            >
              {resolvedPaths
                .filter((path) => path.visible)
                .map((path) => (
                  <CanvasResolvedPathLayer
                    key={path.id}
                    path={path}
                    detail={discretizedByPath.get(path.id)}
                    geometrySegments={
                      geometryByPath.get(path.id)?.segments ?? []
                    }
                    selection={selection}
                    lockedPointIds={lockedPointIds}
                    activePathId={activePath?.id ?? null}
                    mode={mode}
                    k={k}
                    rMinDragTargets={rMinDragTargets}
                  />
                ))}

              {activePathTiming === null ? null : (
                <CanvasPathVelocityOverlay timing={activePathTiming} k={k} />
              )}

              <CanvasGuides snapGuide={snapGuide} k={k} />

              <CanvasPreviewOverlay
                addPointPreview={addPointPreview}
                addPointPreviewPath={addPointPreviewPath}
                addPointPreviewWaypoint={addPointPreviewWaypoint}
                addPointPreviewHeadingKeyframe={addPointPreviewHeadingKeyframe}
                k={k}
                mode={mode}
              />
            </Group>
          </Layer>

          <Layer listening={false}>
            <Group
              x={canvasTransform.x}
              y={canvasTransform.y}
              scaleX={k}
              scaleY={k}
              listening={false}
            >
              <CanvasRobotLayer
                timing={activePathTiming}
                pose={robotAnimation.pose}
                robotSettings={robotSettings}
                color={activePathAnimationColor}
                k={k}
                enabled={isRobotAnimationEnabled}
              />
            </Group>
          </Layer>
        </Stage>

        {addPointPreviewWaypoint === null ? null : (
          <span
            className={styles.accessibilityOnly}
            aria-label={`preview waypoint ${addPointPreviewWaypoint.name}`}
          />
        )}

        {addPointPreviewHeadingKeyframe === null ? null : (
          <span
            className={styles.accessibilityOnly}
            aria-label={`heading point ${addPointPreviewHeadingKeyframe.name}`}
          />
        )}

        {activePathTiming === null ||
        !isRobotAnimationEnabled ||
        robotAnimation.pose === null ? null : (
          <span
            className={styles.accessibilityOnly}
            aria-label="animated robot"
          />
        )}
      </div>

      {activePathTiming === null ? null : (
        <span
          className={styles.accessibilityOnly}
          aria-label="path velocity overlay"
        />
      )}

      <SnapSettingsPanel
        settings={snapSettings}
        isOpen={snapPanelOpen}
        onToggleSetting={toggleSnapSetting}
        onToggleOpen={() => {
          setSnapPanelOpen(!snapPanelOpen);
        }}
      />
    </main>
  );
};
