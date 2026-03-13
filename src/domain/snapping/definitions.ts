import type { SnapSettingDefinition } from './types';

export const SNAP_SETTING_DEFINITIONS: SnapSettingDefinition[] = [
  {
    key: 'alignX',
    label: 'Align X',
    section: 'point',
    description: 'X座標を他のポイントに揃える',
  },
  {
    key: 'alignY',
    label: 'Align Y',
    section: 'point',
    description: 'Y座標を他のポイントに揃える',
  },
  {
    key: 'previousHeadingLine',
    label: 'Prev Heading Line',
    section: 'point',
    description: '前のポイントの角度の延長線にスナップ',
  },
  {
    key: 'segmentParallel',
    label: 'Parallel to Segment',
    section: 'point',
    description: '前のセグメントと平行に移動',
  },
  {
    key: 'segmentPerpendicular',
    label: 'Perpendicular to Segment',
    section: 'point',
    description: '前のセグメントと垂直に移動',
  },
  {
    key: 'previousWaypointHeading',
    label: 'Prev Waypoint Heading',
    section: 'heading',
    description: '前のポイントの角度を維持',
  },
  {
    key: 'cardinalAngles',
    label: '45° Angles',
    section: 'heading',
    description: '45度単位の角度にスナップ',
  },
  {
    key: 'segmentHeading',
    label: 'Segment Heading',
    section: 'heading',
    description: '前のセグメントの方向にスナップ',
  },
];
