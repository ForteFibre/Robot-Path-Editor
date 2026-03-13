import type { Point, SnapGuide } from '../geometry';
import type { SnapSettings, SnapToggleKey } from '../snapSettings';

export type SnapSettingSection = 'point' | 'heading' | 'panel';

export type SnapSettingDefinition = {
  key: SnapToggleKey;
  label: string;
  section: SnapSettingSection;
  description: string;
};

export type PointSnapContext = {
  candidates: Point[];
  previousPoint: Point | null;
  previousHeadingDeg: number | null;
  previousSegmentStart: Point | null;
  settings: SnapSettings;
  threshold: number;
};

export type AngleSnapContext = {
  origin: Point;
  target: Point;
  previousHeadingDeg: number | null;
  previousPoint: Point | null;
  previousSegmentStart: Point | null;
  settings: SnapSettings;
  thresholdDeg: number;
  force: boolean;
};

export type PointCandidate = {
  point: Point;
  guide: SnapGuide;
  score: number;
};

export type AngleCandidate = {
  angle: number;
  guide: SnapGuide;
  score: number;
};
