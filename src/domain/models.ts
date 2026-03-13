export type EditorMode = 'path' | 'heading';

export type CanvasTool = 'select' | 'add-point' | 'edit-image';

export type Point = {
  id: string;
  x: number;
  y: number;
  robotHeading: number | null;
  isLibrary: boolean;
  name: string;
};

export type Waypoint = {
  id: string;
  pointId: string;
  libraryPointId: string | null;
  pathHeading: number;
};

export type HeadingKeyframe = {
  id: string;
  sectionIndex: number;
  sectionRatio: number;
  robotHeading: number;
  name: string;
};

export type PathModel = {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  waypoints: Waypoint[];
  headingKeyframes: HeadingKeyframe[];
  sectionRMin: (number | null)[];
};

export type SelectionState = {
  pathId: string | null;
  waypointId: string | null;
  headingKeyframeId: string | null;
  sectionIndex: number | null;
};

export type BackgroundImage = {
  url: string;
  width: number;
  height: number;
  x: number;
  y: number;
  scale: number;
  alpha: number;
};

export type RobotMotionSettings = {
  length: number;
  width: number;
  acceleration: number;
  deceleration: number;
  maxVelocity: number;
  centripetalAcceleration: number;
};
