import type { WaypointTiming } from '../../domain/pathTiming';
import type { ResolvedPathModel } from '../../domain/pointResolution';

export type PathItem =
  | {
      type: 'waypoint';
      id: string;
      index: number;
      data: ResolvedPathModel['waypoints'][0];
      timing: WaypointTiming | null;
    }
  | {
      type: 'headingKeyframe';
      id: string;
      index: number;
      data: ResolvedPathModel['headingKeyframes'][0];
    };

export const formatSeconds = (seconds: number): string => {
  return `${seconds.toFixed(2).replace(/\.0+$|(?<=\.\d)0+$/, '')} s`;
};

export const buildSequentialItems = (
  path: ResolvedPathModel,
  waypointTimingsById: Map<string, WaypointTiming>,
): PathItem[] => {
  const items: PathItem[] = [];
  const waypoints = path.waypoints;
  const hks = path.headingKeyframes;

  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    if (wp) {
      items.push({
        type: 'waypoint',
        id: wp.id,
        index: i,
        data: wp,
        timing: waypointTimingsById.get(wp.id) ?? null,
      });
    }

    const sectionHks = hks.filter((hk) => hk.sectionIndex === i);
    sectionHks.sort((a, b) => a.sectionRatio - b.sectionRatio);

    for (const hk of sectionHks) {
      items.push({
        type: 'headingKeyframe',
        id: hk.id,
        index: hks.findIndex((origHk) => origHk.id === hk.id),
        data: hk,
      });
    }
  }

  return items;
};

export const getItemLabel = (item: PathItem): string => {
  return (
    item.data.name ||
    (item.type === 'waypoint'
      ? `Waypoint ${item.index + 1}`
      : `Heading ${item.index + 1}`)
  );
};

export const getItemSubtitle = (item: PathItem): string => {
  return item.type === 'waypoint'
    ? `WP ${item.index + 1}`
    : `HK ${item.index + 1} (Sect ${item.data.sectionIndex + 1})`;
};
