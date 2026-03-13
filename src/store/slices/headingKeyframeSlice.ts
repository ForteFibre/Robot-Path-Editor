import type { HeadingKeyframe } from '../../domain/models';
import {
  addHeadingKeyframe as addHeadingKeyframeMutation,
  createAndAddHeadingKeyframe,
  deleteHeadingKeyframe as deleteHeadingKeyframeMutation,
  updateHeadingKeyframe as updateHeadingKeyframeMutation,
} from '../domain';
import type {
  DomainState,
  HeadingKeyframeUpdatePatch,
  UiState,
  WorkspaceSetState,
} from '../types';
import { normalizeUiState } from './uiSlice';

export type HeadingKeyframeActions = {
  addHeadingKeyframe: (pathId: string, keyframe: HeadingKeyframe) => void;
  createHeadingKeyframe: (input: {
    pathId: string;
    sectionIndex: number;
    sectionRatio: number;
    robotHeading: number;
  }) => string | null;
  updateHeadingKeyframe: (
    pathId: string,
    headingKeyframeId: string,
    patch: HeadingKeyframeUpdatePatch,
  ) => void;
  deleteHeadingKeyframe: (pathId: string, headingKeyframeId: string) => void;
};

type HeadingKeyframeActionDeps = {
  setState: WorkspaceSetState;
};

export const createHeadingKeyframeActions = ({
  setState,
}: HeadingKeyframeActionDeps): HeadingKeyframeActions => {
  const updateDomain = (
    updater: (domain: DomainState, ui: UiState) => DomainState,
    uiUpdater?: (ui: UiState, nextDomain: DomainState) => UiState,
  ): void => {
    setState((state) => {
      const nextDomain = updater(state.domain, state.ui);
      const nextUi = uiUpdater ? uiUpdater(state.ui, nextDomain) : state.ui;

      return {
        domain: nextDomain,
        ui: normalizeUiState(nextDomain, nextUi),
      };
    });
  };

  return {
    addHeadingKeyframe: (pathId, keyframe) => {
      updateDomain((domain) =>
        addHeadingKeyframeMutation(domain, pathId, keyframe),
      );
    },

    createHeadingKeyframe: (input) => {
      let insertedId: string | null = null;

      setState((state) => {
        const result = createAndAddHeadingKeyframe(state.domain, input);
        insertedId = result.headingKeyframeId;

        if (result.headingKeyframeId === null) {
          return {};
        }

        return {
          domain: result.domain,
          ui: normalizeUiState(result.domain, {
            ...state.ui,
            selection: {
              pathId: input.pathId,
              waypointId: null,
              headingKeyframeId: result.headingKeyframeId,
              sectionIndex: null,
            },
          }),
        };
      });

      return insertedId;
    },

    updateHeadingKeyframe: (pathId, headingKeyframeId, patch) => {
      updateDomain((domain) =>
        updateHeadingKeyframeMutation(domain, pathId, headingKeyframeId, patch),
      );
    },

    deleteHeadingKeyframe: (pathId, headingKeyframeId) => {
      updateDomain(
        (domain) =>
          deleteHeadingKeyframeMutation(domain, pathId, headingKeyframeId),
        (ui) => {
          if (ui.selection.headingKeyframeId !== headingKeyframeId) {
            return ui;
          }

          return {
            ...ui,
            selection: {
              ...ui.selection,
              headingKeyframeId: null,
              sectionIndex: null,
            },
          };
        },
      );
    },
  };
};
