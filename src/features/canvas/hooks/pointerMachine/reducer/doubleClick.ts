import type { MachineState, PointerSnapshot, TransitionResult } from '../types';
import { result } from './shared';

export const reduceDoubleClick = (
  state: MachineState,
  snapshot: PointerSnapshot,
): TransitionResult => {
  if (state.kind !== 'idle') {
    return result(state);
  }

  const { workspace, hit } = snapshot;

  switch (hit.kind) {
    case 'robot-heading':
      if (workspace.mode !== 'heading') {
        return result(state);
      }

      return result(state, [
        {
          kind: 'command.reset-waypoint-robot-heading',
          waypointId: hit.waypointId,
        },
      ]);
    case 'rmin-handle':
      if (workspace.mode !== 'path') {
        return result(state);
      }

      return result(state, [
        {
          kind: 'command.reset-section-rmin',
          sectionId: {
            pathId: hit.pathId,
            sectionIndex: hit.sectionIndex,
          },
        },
      ]);
    case 'waypoint':
    case 'path-heading':
    case 'heading-keyframe':
    case 'heading-keyframe-heading':
    case 'section':
    case 'background-image':
    case 'canvas':
      return result(state);
  }
};
