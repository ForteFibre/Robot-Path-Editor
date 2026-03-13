import type {
  MachineState,
  PointerMachineEvent,
  PointerSnapshot,
  TransitionResult,
} from '../types';
import { reduceDoubleClick } from './doubleClick';
import { reducePointerDown } from './pointerDown';
import { reducePointerFinish } from './pointerFinish';
import { reducePointerMove } from './pointerMove';

export const reducePointerMachine = (
  state: MachineState,
  event: PointerMachineEvent,
  snapshot: PointerSnapshot,
): TransitionResult => {
  switch (event.type) {
    case 'pointer-down':
      return reducePointerDown(state, snapshot);
    case 'pointer-move':
      return reducePointerMove(state, snapshot);
    case 'pointer-finish':
      return reducePointerFinish(state, snapshot);
    case 'double-click':
      return reduceDoubleClick(state, snapshot);
  }
};
