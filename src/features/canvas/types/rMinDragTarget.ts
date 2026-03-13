import type { Point } from '../../../domain/geometry';

export type RMinDragTarget = {
  pathId: string;
  sectionIndex: number;
  center: Point;
  waypointPoint: Point;
  rMin: number;
  isAuto: boolean;
};
