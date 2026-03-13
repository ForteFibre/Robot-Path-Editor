import { useMemo } from 'react';
import { useWorkspaceActions } from '../../../store/workspaceStore';

type CanvasEditActions = Pick<
  ReturnType<typeof useWorkspaceActions>,
  | 'addHeadingKeyframe'
  | 'clearSelection'
  | 'insertLibraryWaypoint'
  | 'pause'
  | 'resume'
  | 'setCanvasTransform'
  | 'setDragging'
  | 'setSectionRMin'
  | 'setSelection'
  | 'setSnapPanelOpen'
  | 'setTool'
  | 'toggleSnapSetting'
  | 'updateBackgroundImage'
  | 'updateHeadingKeyframe'
  | 'updateWaypoint'
  | 'zoomCanvas'
>;

export const useCanvasEditActions = (): CanvasEditActions => {
  const actions = useWorkspaceActions();
  const {
    addHeadingKeyframe,
    clearSelection,
    insertLibraryWaypoint,
    pause,
    resume,
    setCanvasTransform,
    setDragging,
    setSectionRMin,
    setSelection,
    setSnapPanelOpen,
    setTool,
    toggleSnapSetting,
    updateBackgroundImage,
    updateHeadingKeyframe,
    updateWaypoint,
    zoomCanvas,
  } = actions;

  return useMemo(
    () => ({
      addHeadingKeyframe,
      clearSelection,
      insertLibraryWaypoint,
      pause,
      resume,
      setCanvasTransform,
      setDragging,
      setSectionRMin,
      setSelection,
      setSnapPanelOpen,
      setTool,
      toggleSnapSetting,
      updateBackgroundImage,
      updateHeadingKeyframe,
      updateWaypoint,
      zoomCanvas,
    }),
    [
      addHeadingKeyframe,
      clearSelection,
      insertLibraryWaypoint,
      pause,
      resume,
      setCanvasTransform,
      setDragging,
      setSectionRMin,
      setSelection,
      setSnapPanelOpen,
      setTool,
      toggleSnapSetting,
      updateBackgroundImage,
      updateHeadingKeyframe,
      updateWaypoint,
      zoomCanvas,
    ],
  );
};
