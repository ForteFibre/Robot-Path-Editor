import type Konva from 'konva';
import type { RefObject } from 'react';
import type { Point, SnapGuide } from '../../../../domain/geometry';
import type { DiscretizedPath } from '../../../../domain/interpolation';
import type { ResolvedPathModel } from '../../../../domain/pointResolution';
import type { SnapSettings } from '../../../../domain/snapping';
import type { RMinDragTarget } from '../../components/CanvasRMinDrag';

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

export type CanvasPointerHandlers = {
  onPointerDown: (event: CanvasPointerEvent) => void;
  onDoubleClick: (event: CanvasDoubleClickEvent) => void;
  onPointerMove: (event: CanvasPointerEvent) => void;
  onPointerUp: (event: CanvasPointerEvent) => void;
  onPointerLeave: (event: CanvasPointerEvent) => void;
  onPointerCancel: (event: CanvasPointerEvent) => void;
  onLostPointerCapture: (event: CanvasPointerEvent) => void;
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
  addPointPreview: AddPointPreviewState | null;
};

export type ValueRef<T> = {
  current: T;
};

export type PointerMachineRefs = {
  waypointPointsRef: ValueRef<(Point & { id: string })[]>;
  resolvedPathsRef: ValueRef<ResolvedPathModel[]>;
  discretizedByPathRef: ValueRef<Map<string, DiscretizedPath>>;
  snapSettingsRef: ValueRef<SnapSettings>;
  rMinTargetsRef: ValueRef<RMinDragTarget[]>;
};

export type SetMachineState = (state: MachineState) => void;

export type CaptureStagePointer = (
  stage: Konva.Stage,
  event: CanvasPointerEvent,
) => void;
