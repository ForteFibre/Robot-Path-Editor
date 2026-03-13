import { fireEvent, screen } from '@testing-library/react';
import {
  getCanvasRenderStep,
  getHeadingHandleDistance,
} from '../../../domain/canvas';
import { computeDubinsArcCentersForPath } from '../../../domain/dubins';
import {
  pointFromHeading,
  worldToScreen,
  type Point,
} from '../../../domain/geometry';
import * as interpolation from '../../../domain/interpolation';
import {
  createPointIndex,
  resolvePathModel,
} from '../../../domain/pointResolution';
import {
  resolveSectionDubins,
  resolveSectionRMin,
} from '../../../domain/sectionRadius';
import { resolveWaypointRobotHeadingHandleAngle } from '../../../features/canvas/waypointHeading';
import { useWorkspaceStore } from '../../../store/workspaceStore';

export const getCanvasHost = (): HTMLElement => {
  return screen.getByLabelText('robot path editor canvas');
};

export const getCanvas = (): HTMLElement => {
  return getCanvasHost().querySelector('canvas') ?? getCanvasHost();
};

export const getStageContent = (): HTMLElement => {
  return getCanvasHost().querySelector('.konvajs-content') ?? getCanvasHost();
};

export const getScreenPointForWorld = (point: Point): Point => {
  return worldToScreen(point, useWorkspaceStore.getState().ui.canvasTransform);
};

export const getBackgroundImageDragStartPoint = (): Point => {
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

export const getSectionScreenPoint = (
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

export const getSelectedWaypointScreenPoint = (): Point => {
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

export const getSelectedWaypointRobotHeadingHandleScreenPoint = (): Point => {
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

export const getSelectedSectionRMinHandleScreenPoint = (): Point => {
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

export const canvasClick = (
  canvas: HTMLElement,
  clientX: number,
  clientY: number,
): void => {
  fireEvent.pointerDown(canvas, { button: 0, clientX, clientY, pointerId: 1 });
  fireEvent.pointerUp(canvas, { button: 0, clientX, clientY, pointerId: 1 });
};

export const canvasDoubleClick = (
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

export const addPointWithHeadingDrag = (params: {
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

export const addLibraryPointToPath = (name: string): void => {
  fireEvent.click(
    screen.getByRole('button', {
      name: new RegExp(`insert ${name} into path`, 'i'),
    }),
  );
};

export const getSelectedWaypointPointState = (): {
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
