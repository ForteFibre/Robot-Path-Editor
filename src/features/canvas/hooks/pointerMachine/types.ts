import type Konva from 'konva';
import type { PointerEventHandler, RefObject } from 'react';
import type { Point, SnapGuide } from '../../../../domain/geometry';
import type { DiscretizedPath } from '../../../../domain/interpolation';
import type { BackgroundImage } from '../../../../domain/models';
import type { CanvasTransform } from '../../../../domain/canvasTransform';
import type { CanvasInteractionSnapshot } from '../../../../store/types';
import type { ResolvedPathModel } from '../../../../domain/pointResolution';
import type { AppNotification } from '../../../../errors';
import type { SnapSettings } from '../../../../domain/snapSettings';
import type { RMinDragTarget } from '../../types/rMinDragTarget';
import type { HitTarget } from '../canvasHitTesting';

export type IdleMachineState = { kind: 'idle' };

export type PendingPanState = {
  kind: 'pending-pan';
  startScreenX: number;
  startScreenY: number;
  startTx: number;
  startTy: number;
};

export type DraggingBackgroundImageState = {
  kind: 'dragging-background-image';
  startScreenX: number;
  startScreenY: number;
  startImgX: number;
  startImgY: number;
  hasMoved: boolean;
};

export type PanningState = {
  kind: 'panning';
  startScreenX: number;
  startScreenY: number;
  startTx: number;
  startTy: number;
};

export type DraggingWaypointState = {
  kind: 'dragging-waypoint';
  pathId: string;
  waypointId: string;
  startScreenX: number;
  startScreenY: number;
  hasMoved: boolean;
};

export type DraggingPathHeadingState = {
  kind: 'dragging-path-heading';
  pathId: string;
  waypointId: string;
  startScreenX: number;
  startScreenY: number;
  hasMoved: boolean;
  origin: 'existing' | 'add-point';
};

export type DraggingRobotHeadingState = {
  kind: 'dragging-robot-heading';
  pathId: string;
  waypointId: string;
  anchor: Point;
  startScreenX: number;
  startScreenY: number;
  hasMoved: boolean;
};

export type DraggingHeadingKeyframeState = {
  kind: 'dragging-heading-keyframe';
  pathId: string;
  headingKeyframeId: string;
  startScreenX: number;
  startScreenY: number;
  hasMoved: boolean;
};

export type DraggingHeadingKeyframeHeadingState = {
  kind: 'dragging-heading-keyframe-heading';
  pathId: string;
  headingKeyframeId: string;
  anchor: Point;
  startScreenX: number;
  startScreenY: number;
  hasMoved: boolean;
  origin: 'existing' | 'add-point';
};

export type DraggingRMinState = {
  kind: 'dragging-rmin';
  target: RMinDragTarget;
  startScreenX: number;
  startScreenY: number;
  startDistance: number;
  initialRMin: number;
  hasMoved: boolean;
};

export type MachineState =
  | IdleMachineState
  | PendingPanState
  | PanningState
  | DraggingBackgroundImageState
  | DraggingWaypointState
  | DraggingPathHeadingState
  | DraggingRobotHeadingState
  | DraggingHeadingKeyframeState
  | DraggingHeadingKeyframeHeadingState
  | DraggingRMinState;

export type ContinuousDomainDragState =
  | DraggingWaypointState
  | DraggingPathHeadingState
  | DraggingRobotHeadingState
  | DraggingHeadingKeyframeState
  | DraggingHeadingKeyframeHeadingState
  | DraggingRMinState;

export type ContinuousDragState =
  | ContinuousDomainDragState
  | DraggingBackgroundImageState;

export type MachineStateKind = MachineState['kind'];

export type MachineStateMetadata = {
  isDraggingInteraction: boolean;
  isContinuousDrag: boolean;
  isContinuousDomainDrag: boolean;
  suppressesRobotAnimation: boolean;
  cursorClass: '' | 'grabbing';
};

export const MACHINE_STATE_METADATA = {
  idle: {
    isDraggingInteraction: false,
    isContinuousDrag: false,
    isContinuousDomainDrag: false,
    suppressesRobotAnimation: false,
    cursorClass: '',
  },
  'pending-pan': {
    isDraggingInteraction: true,
    isContinuousDrag: false,
    isContinuousDomainDrag: false,
    suppressesRobotAnimation: false,
    cursorClass: '',
  },
  panning: {
    isDraggingInteraction: true,
    isContinuousDrag: false,
    isContinuousDomainDrag: false,
    suppressesRobotAnimation: false,
    cursorClass: 'grabbing',
  },
  'dragging-background-image': {
    isDraggingInteraction: true,
    isContinuousDrag: true,
    isContinuousDomainDrag: false,
    suppressesRobotAnimation: false,
    cursorClass: 'grabbing',
  },
  'dragging-waypoint': {
    isDraggingInteraction: true,
    isContinuousDrag: true,
    isContinuousDomainDrag: true,
    suppressesRobotAnimation: true,
    cursorClass: 'grabbing',
  },
  'dragging-path-heading': {
    isDraggingInteraction: true,
    isContinuousDrag: true,
    isContinuousDomainDrag: true,
    suppressesRobotAnimation: true,
    cursorClass: 'grabbing',
  },
  'dragging-robot-heading': {
    isDraggingInteraction: true,
    isContinuousDrag: true,
    isContinuousDomainDrag: true,
    suppressesRobotAnimation: true,
    cursorClass: 'grabbing',
  },
  'dragging-heading-keyframe': {
    isDraggingInteraction: true,
    isContinuousDrag: true,
    isContinuousDomainDrag: true,
    suppressesRobotAnimation: true,
    cursorClass: 'grabbing',
  },
  'dragging-heading-keyframe-heading': {
    isDraggingInteraction: true,
    isContinuousDrag: true,
    isContinuousDomainDrag: true,
    suppressesRobotAnimation: true,
    cursorClass: 'grabbing',
  },
  'dragging-rmin': {
    isDraggingInteraction: true,
    isContinuousDrag: true,
    isContinuousDomainDrag: true,
    suppressesRobotAnimation: true,
    cursorClass: 'grabbing',
  },
} satisfies Record<MachineStateKind, MachineStateMetadata>;

export const getMachineStateMetadata = (
  state: MachineState | MachineStateKind,
): MachineStateMetadata => {
  const kind = typeof state === 'string' ? state : state.kind;
  return MACHINE_STATE_METADATA[kind];
};

export type AddPointPreviewState =
  | {
      kind: 'path-waypoint';
      point: Point;
      pathHeading: number;
      sourcePoint: Point | null;
      nextPoint: Point | null;
    }
  | {
      kind: 'heading-keyframe';
      point: Point;
      robotHeading: number;
      sectionIndex: number;
      sectionRatio: number;
    };

export type CanvasPointerEvent = {
  evt: PointerEvent;
};

export type CanvasDoubleClickEvent = {
  evt: MouseEvent;
};

export type PointerMachineEvent =
  | { type: 'pointer-down' }
  | { type: 'pointer-move' }
  | {
      type: 'pointer-finish';
      reason:
        | 'pointer-up'
        | 'pointer-leave'
        | 'pointer-cancel'
        | 'lost-pointer-capture';
    }
  | { type: 'double-click' };

export type PointerSnapshot = {
  pointerId: number;
  button: number;
  clientX: number;
  clientY: number;
  shiftKey: boolean;
  altKey: boolean;
  workspace: CanvasInteractionSnapshot;
  hit: HitTarget;
  world: Point | null;
  waypointPoints: (Point & { id: string })[];
  resolvedPaths: ResolvedPathModel[];
  discretizedByPath: Map<string, DiscretizedPath>;
  snapSettings: SnapSettings;
  rMinDragTargets: RMinDragTarget[];
};

export type LocalTransitionEffect =
  | { kind: 'local.set-snap-guide'; guide: SnapGuide }
  | {
      kind: 'local.set-add-point-preview';
      preview: AddPointPreviewState | null;
    }
  | { kind: 'local.capture-pointer'; pointerId: number }
  | { kind: 'local.release-pointer'; pointerId: number }
  | { kind: 'local.notify'; notification: AppNotification };

export type CanvasCommandTransitionEffect =
  | {
      kind: 'command.execute-add-waypoint';
      params: {
        pathId: string;
        pointId: string;
        waypointId: string;
        x: number;
        y: number;
      };
    }
  | { kind: 'command.complete-add-waypoint-mode' }
  | {
      kind: 'command.execute-add-heading-keyframe';
      params: {
        pathId: string;
        headingKeyframeId: string;
        sectionIndex: number;
        sectionRatio: number;
        robotHeading: number;
      };
    }
  | {
      kind: 'command.reset-waypoint-robot-heading';
      waypointId: string;
    }
  | {
      kind: 'command.reset-section-rmin';
      sectionId: {
        pathId: string;
        sectionIndex: number;
      };
    }
  | { kind: 'command.execute-pan-selection-clear' };

export type PathTransitionEffect =
  | {
      kind: 'path.update-waypoint-position';
      pathId: string;
      waypointId: string;
      point: Point;
    }
  | {
      kind: 'path.update-waypoint-path-heading';
      pathId: string;
      waypointId: string;
      pathHeading: number;
    }
  | { kind: 'path.select-waypoint'; pathId: string; waypointId: string }
  | { kind: 'path.select-section'; pathId: string; sectionIndex: number }
  | { kind: 'path.clear-selection' };

export type HeadingTransitionEffect =
  | {
      kind: 'heading.update-waypoint-robot-heading';
      pathId: string;
      waypointId: string;
      robotHeading: number | null;
    }
  | {
      kind: 'heading.update-heading-keyframe-position';
      pathId: string;
      headingKeyframeId: string;
      sectionIndex: number;
      sectionRatio: number;
    }
  | {
      kind: 'heading.update-heading-keyframe-heading';
      pathId: string;
      headingKeyframeId: string;
      robotHeading: number;
    }
  | { kind: 'heading.select-waypoint'; pathId: string; waypointId: string }
  | {
      kind: 'heading.select-heading-keyframe';
      pathId: string;
      headingKeyframeId: string;
    }
  | { kind: 'heading.clear-selection' };

export type RMinTransitionEffect =
  | {
      kind: 'rmin.update-section-rmin';
      pathId: string;
      sectionIndex: number;
      rMin: number | null;
    }
  | {
      kind: 'rmin.select-section';
      pathId: string;
      sectionIndex: number;
    };

export type PanTransitionEffect =
  | {
      kind: 'pan.set-canvas-transform';
      transform: CanvasTransform;
    }
  | {
      kind: 'pan.update-background-image';
      updates: Pick<NonNullable<BackgroundImage>, 'x' | 'y'>;
    };

export type TransitionEffect =
  | LocalTransitionEffect
  | CanvasCommandTransitionEffect
  | PathTransitionEffect
  | HeadingTransitionEffect
  | RMinTransitionEffect
  | PanTransitionEffect;

export type WorkspaceTransitionEffect = Exclude<
  TransitionEffect,
  LocalTransitionEffect | CanvasCommandTransitionEffect
>;

export type TransitionResult = {
  nextState: MachineState;
  effects: TransitionEffect[];
};

export type PointerMachineEventHandlers = {
  onPointerDown: (event: CanvasPointerEvent) => void;
  onDoubleClick: (event: CanvasDoubleClickEvent) => void;
  onPointerMove: (event: CanvasPointerEvent) => void;
  onPointerUp: (event: CanvasPointerEvent) => void;
  onPointerLeave: (event: CanvasPointerEvent) => void;
  onPointerCancel: (event: CanvasPointerEvent) => void;
  onLostPointerCapture: (event: CanvasPointerEvent) => void;
};

export type CanvasEventBridgeHandlers = {
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerUp: PointerEventHandler<HTMLDivElement>;
  onPointerLeave: PointerEventHandler<HTMLDivElement>;
  onPointerCancel: PointerEventHandler<HTMLDivElement>;
  onLostPointerCapture: PointerEventHandler<HTMLDivElement>;
};

export type CanvasPointerHandlers = CanvasEventBridgeHandlers & {
  cursorClass: string;
  draggingWaypointId: string | null;
  draggingPathId: string | null;
  isRobotAnimationSuppressed: boolean;
};

export type UseCanvasPointerMachineParams = {
  stageRef: RefObject<Konva.Stage | null>;
  interactionSurfaceRef: RefObject<HTMLElement | null>;
  allVisibleWaypointPoints: (Point & { id: string })[];
  resolvedPaths: ResolvedPathModel[];
  discretizedByPath: Map<string, DiscretizedPath>;
  snapSettings: SnapSettings;
  rMinDragTargets: RMinDragTarget[];
  setSnapGuide: (guide: SnapGuide) => void;
  setAddPointPreview: (preview: AddPointPreviewState | null) => void;
  notify: (notification: AppNotification) => void;
  addPointPreview: AddPointPreviewState | null;
};
