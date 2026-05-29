import type { Point as GeometryPoint } from '../../domain/geometry';
import type { BackgroundImage, PathModel, Point } from '../../domain/models';
import type { WorkspaceDomainState } from '../../domain/workspaceContract';
import {
  setSectionRMin,
  updateHeadingKeyframe,
  updateWaypoint,
} from '../../store/domain';

export type CanvasDragPreview =
  | {
      kind: 'waypoint-position';
      pathId: string;
      waypointId: string;
      point: GeometryPoint;
    }
  | {
      kind: 'waypoint-path-heading';
      pathId: string;
      waypointId: string;
      pathHeading: number;
    }
  | {
      kind: 'waypoint-robot-heading';
      pathId: string;
      waypointId: string;
      robotHeading: number | null;
    }
  | {
      kind: 'heading-keyframe-position';
      pathId: string;
      headingKeyframeId: string;
      sectionIndex: number;
      sectionRatio: number;
    }
  | {
      kind: 'heading-keyframe-heading';
      pathId: string;
      headingKeyframeId: string;
      robotHeading: number;
    }
  | {
      kind: 'section-rmin';
      pathId: string;
      sectionIndex: number;
      rMin: number | null;
    }
  | {
      kind: 'background-image';
      updates: Pick<BackgroundImage, 'x' | 'y'>;
    };

type ApplyCanvasDragPreviewParams = {
  preview: CanvasDragPreview | null;
  paths: PathModel[];
  points: Point[];
  lockedPointIds: string[];
  activePathId: string;
  backgroundImage: BackgroundImage | null;
};

type CanvasDragPreviewWorkspace = {
  paths: PathModel[];
  points: Point[];
  backgroundImage: BackgroundImage | null;
};

const applyPreviewToDomain = (
  domain: WorkspaceDomainState,
  preview: CanvasDragPreview,
): WorkspaceDomainState => {
  switch (preview.kind) {
    case 'waypoint-position':
      return updateWaypoint(
        domain,
        preview.pathId,
        preview.waypointId,
        {
          x: preview.point.x,
          y: preview.point.y,
        },
        'path',
      );
    case 'waypoint-path-heading':
      return updateWaypoint(
        domain,
        preview.pathId,
        preview.waypointId,
        {
          pathHeading: preview.pathHeading,
        },
        'path',
      );
    case 'waypoint-robot-heading':
      return updateWaypoint(
        domain,
        preview.pathId,
        preview.waypointId,
        {
          robotHeading: preview.robotHeading,
        },
        'heading',
      );
    case 'heading-keyframe-position':
      return updateHeadingKeyframe(
        domain,
        preview.pathId,
        preview.headingKeyframeId,
        {
          sectionIndex: preview.sectionIndex,
          sectionRatio: preview.sectionRatio,
        },
      );
    case 'heading-keyframe-heading':
      return updateHeadingKeyframe(
        domain,
        preview.pathId,
        preview.headingKeyframeId,
        {
          robotHeading: preview.robotHeading,
        },
      );
    case 'section-rmin':
      return setSectionRMin(
        domain,
        preview.pathId,
        preview.sectionIndex,
        preview.rMin,
      );
    case 'background-image':
      return domain;
  }
};

export const applyCanvasDragPreview = ({
  preview,
  paths,
  points,
  lockedPointIds,
  activePathId,
  backgroundImage,
}: ApplyCanvasDragPreviewParams): CanvasDragPreviewWorkspace => {
  if (preview === null) {
    return {
      paths,
      points,
      backgroundImage,
    };
  }

  const domain: WorkspaceDomainState = {
    paths,
    points,
    lockedPointIds,
    activePathId,
  };
  const nextDomain = applyPreviewToDomain(domain, preview);

  return {
    paths: nextDomain.paths,
    points: nextDomain.points,
    backgroundImage:
      preview.kind === 'background-image' && backgroundImage !== null
        ? {
            ...backgroundImage,
            ...preview.updates,
          }
        : backgroundImage,
  };
};
