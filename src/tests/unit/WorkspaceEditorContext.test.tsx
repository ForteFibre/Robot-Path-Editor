import { act, render, screen } from '@testing-library/react';
import { type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  WorkspaceEditorProvider,
  useWorkspaceEditorDerived,
} from '../../features/app-shell/WorkspaceEditorContext';
import type { PathModel, Point } from '../../domain/models';
import { DEFAULT_ROBOT_MOTION_SETTINGS } from '../../domain/modelNormalization';
import * as workspaceDerivedSelectors from '../../store/workspaceDerivedSelectors';
import { useWorkspaceStore } from '../../store/workspaceStore';

const createPoints = (): Point[] => [
  {
    id: 'point-1',
    x: 0,
    y: 0,
    robotHeading: null,
    isLibrary: false,
    name: 'P1',
  },
  {
    id: 'point-2',
    x: 4,
    y: 4,
    robotHeading: null,
    isLibrary: false,
    name: 'P2',
  },
  {
    id: 'point-3',
    x: 8,
    y: 0,
    robotHeading: null,
    isLibrary: false,
    name: 'P3',
  },
  {
    id: 'point-4',
    x: 12,
    y: 4,
    robotHeading: null,
    isLibrary: false,
    name: 'P4',
  },
];

const createPath = (
  id: string,
  waypointIds: [string, string],
  visible = true,
): PathModel => ({
  id,
  name: id,
  color: visible ? '#2563eb' : '#6b7280',
  visible,
  waypoints: [
    {
      id: `${id}-waypoint-1`,
      pointId: waypointIds[0],
      libraryPointId: null,
      pathHeading: 0,
    },
    {
      id: `${id}-waypoint-2`,
      pointId: waypointIds[1],
      libraryPointId: null,
      pathHeading: 90,
    },
  ],
  headingKeyframes: [],
  sectionRMin: [2],
});

const applyStoreState = ({
  paths,
  points,
  activePathId,
}: {
  paths: PathModel[];
  points: Point[];
  activePathId: string;
}): void => {
  useWorkspaceStore.setState((state) => ({
    domain: {
      ...state.domain,
      paths,
      points,
      activePathId,
      lockedPointIds: [],
    },
    ui: {
      ...state.ui,
      mode: 'path',
      tool: 'select',
      selection: {
        pathId: activePathId,
        waypointId: null,
        headingKeyframeId: null,
        sectionIndex: null,
      },
      robotSettings: DEFAULT_ROBOT_MOTION_SETTINGS,
    },
  }));
};

const DerivedConsumer = (): ReactElement => {
  const { resolvedPaths, activeResolvedPath, activePathTiming } =
    useWorkspaceEditorDerived();

  return (
    <div>{`${resolvedPaths.length}:${activeResolvedPath?.id ?? 'none'}:${activePathTiming?.totalTime ?? 0}`}</div>
  );
};

const OrphanConsumer = (): ReactElement => {
  useWorkspaceEditorDerived();
  return <div>orphan</div>;
};

describe('WorkspaceEditorContext', () => {
  it('provides shared editor derived values to descendants and ignores unrelated store updates', () => {
    const path1 = createPath('path-1', ['point-1', 'point-2']);
    const path2 = createPath('path-2', ['point-3', 'point-4']);
    const computeSpy = vi.spyOn(
      workspaceDerivedSelectors,
      'computeWorkspaceDerivedState',
    );

    applyStoreState({
      paths: [path1, path2],
      points: createPoints(),
      activePathId: path1.id,
    });

    render(
      <WorkspaceEditorProvider>
        <DerivedConsumer />
        <DerivedConsumer />
      </WorkspaceEditorProvider>,
    );

    expect(screen.getAllByText(/2:path-1:/)).toHaveLength(2);
    expect(computeSpy).toHaveBeenCalledTimes(1);

    act(() => {
      useWorkspaceStore.getState().setTool('add-point');
    });

    expect(computeSpy).toHaveBeenCalledTimes(1);

    act(() => {
      useWorkspaceStore.getState().setActivePath(path2.id);
    });

    expect(screen.getAllByText(/2:path-2:/)).toHaveLength(2);
    expect(computeSpy).toHaveBeenCalledTimes(2);
  });

  it('throws when the consumer hook is used without the provider', () => {
    expect(() => {
      render(<OrphanConsumer />);
    }).toThrow(
      'useWorkspaceEditorDerived must be used within WorkspaceEditorProvider.',
    );
  });
});
