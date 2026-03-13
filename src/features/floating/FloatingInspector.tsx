import { useMemo, type ReactElement } from 'react';
import { useWorkspaceEditorDerived } from '../app-shell/WorkspaceEditorContext';
import {
  useCanvasTransform,
  useEditorTool,
  useLockedPointIds,
  usePoints,
  usePaths,
  useSelection,
} from '../../store/workspaceSelectors';
import {
  resolveSelection,
  EMPTY_RESOLVED_SELECTION,
} from './floatingInspectorModel';
import {
  getPanelStyle,
  type FloatingInspectorLayout,
} from './floatingInspectorPosition';
import { WaypointInspectorPanel } from './WaypointInspectorPanel';
import { HeadingKeyframeInspectorPanel } from './HeadingKeyframeInspectorPanel';
import { SectionInspectorPanel } from './SectionInspectorPanel';
import { useFloatingInspectorActions } from './useFloatingInspectorActions';

type FloatingInspectorProps = {
  layout: FloatingInspectorLayout;
};

export const FloatingInspector = ({
  layout,
}: FloatingInspectorProps): ReactElement => {
  const {
    addLibraryPointFromSelection,
    deleteHeadingKeyframe,
    deleteWaypoint,
    pause,
    resume,
    setSelectedLibraryPointId,
    setSectionRMin,
    unlinkWaypointPoint,
    updateHeadingKeyframe,
    updateWaypoint,
  } = useFloatingInspectorActions();
  const paths = usePaths();
  const points = usePoints();
  const lockedPointIds = useLockedPointIds();
  const selection = useSelection();
  const tool = useEditorTool();
  const canvasTransform = useCanvasTransform();
  const { resolvedPaths } = useWorkspaceEditorDerived();

  const shouldResolveSelection = tool !== 'add-point';
  const shouldShowSelection =
    shouldResolveSelection && selection.pathId !== null;

  const {
    selectedPath,
    selectedWaypoint,
    selectedHeadingKeyframe,
    selectedSection,
  } = useMemo(() => {
    if (!shouldResolveSelection) {
      return EMPTY_RESOLVED_SELECTION;
    }

    return resolveSelection(resolvedPaths, paths, points, selection);
  }, [paths, points, selection, resolvedPaths, shouldResolveSelection]);

  if (!shouldShowSelection || selectedPath?.id !== selection.pathId) {
    return <></>;
  }

  const anchor =
    selectedHeadingKeyframe ??
    selectedWaypoint ??
    (selectedSection === null
      ? null
      : {
          x: (selectedSection.start.x + selectedSection.end.x) / 2,
          y: (selectedSection.start.y + selectedSection.end.y) / 2,
        });
  const style = getPanelStyle(canvasTransform, anchor, layout);

  if (selectedHeadingKeyframe !== null) {
    return (
      <HeadingKeyframeInspectorPanel
        style={style}
        path={selectedPath}
        headingKeyframe={selectedHeadingKeyframe}
        updateHeadingKeyframe={updateHeadingKeyframe}
        deleteHeadingKeyframe={deleteHeadingKeyframe}
      />
    );
  }

  if (selectedWaypoint !== null) {
    return (
      <WaypointInspectorPanel
        style={style}
        path={selectedPath}
        waypoint={selectedWaypoint}
        isLibraryPointLocked={
          selectedWaypoint.libraryPointId !== null &&
          lockedPointIds.includes(selectedWaypoint.libraryPointId)
        }
        setSelectedLibraryPointId={setSelectedLibraryPointId}
        addLibraryPointFromSelection={addLibraryPointFromSelection}
        deleteWaypoint={deleteWaypoint}
        unlinkWaypointPoint={unlinkWaypointPoint}
        updateWaypoint={updateWaypoint}
      />
    );
  }

  if (selectedSection !== null) {
    return (
      <SectionInspectorPanel
        style={style}
        path={selectedPath}
        section={selectedSection}
        pause={pause}
        resume={resume}
        setSectionRMin={setSectionRMin}
      />
    );
  }

  return <></>;
};
