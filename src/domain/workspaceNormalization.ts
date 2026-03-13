import { type PathModel, type Point, type SelectionState } from './models';
import { createPath } from './factories';
import {
  normalizePathSections,
  normalizeRobotMotionSettings,
} from './modelNormalization';
import { collectReferencedPointIds } from './pointResolution';
import type {
  NormalizedWorkspaceAutosavePayload,
  NormalizedWorkspaceSession,
  WorkspaceAutosavePayload,
  WorkspaceDocument,
  WorkspaceDomainState,
  WorkspaceSession,
} from './workspaceContract';

const cloneWorkspaceDomainState = (
  domain: WorkspaceDomainState,
): WorkspaceDomainState => {
  return {
    ...domain,
    paths: domain.paths.map((path) => ({
      ...path,
      waypoints: path.waypoints.map((waypoint) => ({ ...waypoint })),
      headingKeyframes: path.headingKeyframes.map((keyframe) => ({
        ...keyframe,
      })),
      sectionRMin: [...path.sectionRMin],
    })),
    points: domain.points.map((point) => ({
      id: point.id,
      x: point.x,
      y: point.y,
      robotHeading: point.robotHeading,
      isLibrary: point.isLibrary,
      name: point.name,
    })),
    lockedPointIds: [...domain.lockedPointIds],
  };
};

const cloneBackgroundImage = (
  backgroundImage: WorkspaceDocument['backgroundImage'] | null | undefined,
): WorkspaceDocument['backgroundImage'] => {
  if (backgroundImage === null || backgroundImage === undefined) {
    return null;
  }

  return {
    url: backgroundImage.url,
    width: backgroundImage.width,
    height: backgroundImage.height,
    x: backgroundImage.x,
    y: backgroundImage.y,
    scale: backgroundImage.scale,
    alpha: backgroundImage.alpha,
  };
};

const cloneWorkspaceDocument = (
  document: WorkspaceDocument,
): WorkspaceDocument => {
  return {
    domain: cloneWorkspaceDomainState(document.domain),
    backgroundImage: cloneBackgroundImage(document.backgroundImage),
    robotSettings: {
      length: document.robotSettings.length,
      width: document.robotSettings.width,
      acceleration: document.robotSettings.acceleration,
      deceleration: document.robotSettings.deceleration,
      maxVelocity: document.robotSettings.maxVelocity,
      centripetalAcceleration: document.robotSettings.centripetalAcceleration,
    },
  };
};

const cloneWorkspaceSession = (session: WorkspaceSession): WorkspaceSession => {
  const clonedSession: WorkspaceSession = {
    mode: session.mode,
    tool: session.tool,
    selection: {
      pathId: session.selection.pathId,
      waypointId: session.selection.waypointId,
      headingKeyframeId: session.selection.headingKeyframeId,
      sectionIndex: session.selection.sectionIndex,
    },
    canvasTransform: {
      x: session.canvasTransform.x,
      y: session.canvasTransform.y,
      k: session.canvasTransform.k,
    },
  };

  if (session.robotPreviewEnabled !== undefined) {
    clonedSession.robotPreviewEnabled = session.robotPreviewEnabled;
  }

  return clonedSession;
};

const createEmptySelection = (): SelectionState => {
  return {
    pathId: null,
    waypointId: null,
    headingKeyframeId: null,
    sectionIndex: null,
  };
};

const resolveValidSelection = (
  domain: WorkspaceDomainState,
  selection: SelectionState,
): SelectionState => {
  if (selection.pathId === null) {
    return createEmptySelection();
  }

  const selectedPath = domain.paths.find(
    (path) => path.id === selection.pathId,
  );
  if (selectedPath === undefined) {
    return {
      pathId: domain.activePathId,
      waypointId: null,
      headingKeyframeId: null,
      sectionIndex: null,
    };
  }

  const headingKeyframeId =
    selection.headingKeyframeId === null ||
    selectedPath.headingKeyframes.some(
      (keyframe) => keyframe.id === selection.headingKeyframeId,
    )
      ? selection.headingKeyframeId
      : null;

  const waypointId =
    selection.waypointId === null ||
    selectedPath.waypoints.some(
      (waypoint) => waypoint.id === selection.waypointId,
    )
      ? selection.waypointId
      : null;

  const sectionIndex =
    selection.sectionIndex !== null &&
    selection.sectionIndex >= 0 &&
    selection.sectionIndex < selectedPath.waypoints.length - 1 &&
    waypointId === null &&
    headingKeyframeId === null
      ? selection.sectionIndex
      : null;

  return {
    pathId: selectedPath.id,
    waypointId,
    headingKeyframeId,
    sectionIndex,
  };
};

const normalizeLinkedWaypointMirrorNames = (
  paths: PathModel[],
  points: Point[],
): Point[] => {
  const pointsById = new Map(points.map((point) => [point.id, point]));
  const linkedPointNames = new Map<string, string>();

  for (const path of paths) {
    for (const waypoint of path.waypoints) {
      if (waypoint.libraryPointId === null) {
        continue;
      }

      const linkedPoint = pointsById.get(waypoint.pointId);
      const libraryPoint = pointsById.get(waypoint.libraryPointId);

      if (
        linkedPoint === undefined ||
        libraryPoint === undefined ||
        !libraryPoint.isLibrary ||
        linkedPoint.name === libraryPoint.name
      ) {
        continue;
      }

      linkedPointNames.set(linkedPoint.id, libraryPoint.name);
    }
  }

  if (linkedPointNames.size === 0) {
    return points;
  }

  return points.map((point) => {
    const mirroredName = linkedPointNames.get(point.id);

    if (mirroredName === undefined) {
      return point;
    }

    return {
      ...point,
      name: mirroredName,
    };
  });
};

const fallbackDomainState = (): WorkspaceDomainState => {
  const firstPath = createPath(0);

  return {
    paths: [firstPath],
    points: [],
    lockedPointIds: [],
    activePathId: firstPath.id,
  };
};

const normalizeWaypointsWithExistingPoints = (
  path: PathModel,
  pointsById: Set<string>,
  libraryPointIds: Set<string>,
): PathModel => {
  return normalizePathSections({
    ...path,
    waypoints: path.waypoints
      .map((waypoint) => {
        if (!pointsById.has(waypoint.pointId)) {
          return null;
        }

        return {
          ...waypoint,
          libraryPointId:
            waypoint.libraryPointId !== null &&
            libraryPointIds.has(waypoint.libraryPointId)
              ? waypoint.libraryPointId
              : null,
        };
      })
      .filter((waypoint) => waypoint !== null),
  });
};

const normalizePoints = (domain: WorkspaceDomainState): Point[] => {
  const referencedPointIds = collectReferencedPointIds(domain.paths);

  return domain.points.filter(
    (point) => point.isLibrary || referencedPointIds.has(point.id),
  );
};

export const normalizeWorkspaceDomainState = (
  domain: WorkspaceDomainState,
): WorkspaceDomainState => {
  const pointIds = new Set(domain.points.map((point) => point.id));
  const libraryPointIds = new Set(
    domain.points.filter((point) => point.isLibrary).map((point) => point.id),
  );
  const paths = domain.paths.map((path) =>
    normalizeWaypointsWithExistingPoints(path, pointIds, libraryPointIds),
  );

  const normalizedPoints = normalizePoints({
    ...domain,
    paths,
  });
  const normalizedPointIdSet = new Set(
    normalizedPoints.map((point) => point.id),
  );
  const normalizedLibraryPointIds = new Set(
    normalizedPoints
      .filter((point) => point.isLibrary)
      .map((point) => point.id),
  );

  const normalizedPaths = paths.map((path) =>
    normalizeWaypointsWithExistingPoints(
      path,
      normalizedPointIdSet,
      normalizedLibraryPointIds,
    ),
  );
  const normalizedMirroredPoints = normalizeLinkedWaypointMirrorNames(
    normalizedPaths,
    normalizedPoints,
  );

  const activePath =
    normalizedPaths.find((path) => path.id === domain.activePathId) ??
    normalizedPaths[0];

  if (activePath === undefined) {
    return fallbackDomainState();
  }

  return {
    ...domain,
    paths: normalizedPaths,
    points: normalizedMirroredPoints,
    lockedPointIds: domain.lockedPointIds.filter((pointId) =>
      normalizedMirroredPoints.some(
        (point) => point.id === pointId && point.isLibrary,
      ),
    ),
    activePathId: activePath.id,
  };
};

export const normalizeWorkspaceDocument = (
  document: WorkspaceDocument,
): WorkspaceDocument => {
  const clonedDocument = cloneWorkspaceDocument(document);

  return {
    domain: normalizeWorkspaceDomainState(clonedDocument.domain),
    backgroundImage: cloneBackgroundImage(clonedDocument.backgroundImage),
    robotSettings: normalizeRobotMotionSettings(clonedDocument.robotSettings),
  };
};

export const normalizeWorkspaceSession = (
  domain: WorkspaceDomainState,
  session: WorkspaceSession,
): NormalizedWorkspaceSession => {
  const clonedSession = cloneWorkspaceSession(session);

  return {
    mode: clonedSession.mode,
    tool: clonedSession.tool,
    selection: resolveValidSelection(domain, clonedSession.selection),
    canvasTransform: clonedSession.canvasTransform,
    robotPreviewEnabled: clonedSession.robotPreviewEnabled ?? true,
  };
};

export const normalizeWorkspaceAutosavePayload = (
  payload: WorkspaceAutosavePayload,
): NormalizedWorkspaceAutosavePayload => {
  const document = normalizeWorkspaceDocument(payload.document);

  return {
    document,
    session: normalizeWorkspaceSession(
      document.domain,
      cloneWorkspaceSession(payload.session),
    ),
  };
};
