import { useEffect, useRef, useState, type ReactElement } from 'react';
import type Konva from 'konva';
import { EMPTY_SNAP_GUIDE, type SnapGuide } from '../../domain/geometry';
import { useAppNotification } from '../app-shell/AppNotificationContext';
import {
  useActivePath,
  useBackgroundImage,
  useCanvasTransform,
  useEditorMode,
  useEditorTool,
  useLockedPointIds,
  usePoints,
  useRobotPreviewEnabled,
  usePaths,
  useRobotSettings,
  useSelection,
  useSnapPanelOpen,
  useSnapSettings,
} from '../../store/workspaceSelectors';
import { useWorkspaceEditorDerived } from '../app-shell/WorkspaceEditorContext';
import { CanvasRenderer } from './components/CanvasRenderer';
import { SnapSettingsPanel } from './components/SnapSettingsPanel';
import {
  useCanvasPointerMachine,
  type AddPointPreviewState,
} from './hooks/useCanvasPointerMachine';
import { useCanvasEditActions } from './hooks/useCanvasEditActions';
import { useCanvasSceneModel } from './hooks/useCanvasSceneModel';
import { useCanvasViewport } from './hooks/useCanvasViewport';
import { useCanvasWheel } from './hooks/useCanvasWheel';
import { useLibraryPointDrop } from './hooks/useLibraryPointDrop';
import { useLoadedImage } from './hooks/useLoadedImage';
import { usePathAnimation } from './hooks/usePathAnimation';
import styles from './PathCanvas.module.css';

export const PathCanvas = (): ReactElement => {
  const { insertLibraryWaypoint, setSnapPanelOpen, toggleSnapSetting } =
    useCanvasEditActions();
  const mode = useEditorMode();
  const tool = useEditorTool();
  const paths = usePaths();
  const points = usePoints();
  const lockedPointIds = useLockedPointIds();
  const activePath = useActivePath();
  const selection = useSelection();
  const canvasTransform = useCanvasTransform();
  const snapSettings = useSnapSettings();
  const snapPanelOpen = useSnapPanelOpen();
  const backgroundImage = useBackgroundImage();
  const isRobotPreviewEnabled = useRobotPreviewEnabled();
  const robotSettings = useRobotSettings();
  const derived = useWorkspaceEditorDerived();
  const { setNotification } = useAppNotification();

  const { canvasHostRef, viewportSize } = useCanvasViewport();
  const stageRef = useRef<Konva.Stage | null>(null);
  const [addPointPreview, setAddPointPreview] =
    useState<AddPointPreviewState | null>(null);
  const [snapGuide, setSnapGuide] = useState<SnapGuide>(EMPTY_SNAP_GUIDE);

  useEffect(() => {
    if (tool !== 'add-point') {
      setAddPointPreview(null);
      setSnapGuide(EMPTY_SNAP_GUIDE);
    }
  }, [mode, tool]);

  const sceneModel = useCanvasSceneModel({
    mode,
    tool,
    paths,
    points,
    lockedPointIds,
    activePath,
    selection,
    canvasTransform,
    backgroundImage,
    robotSettings,
    addPointPreview,
    derived,
  });

  useCanvasWheel(canvasHostRef);

  const pointerHandlers = useCanvasPointerMachine({
    stageRef,
    interactionSurfaceRef: canvasHostRef,
    allVisibleWaypointPoints: sceneModel.interaction.allVisibleWaypointPoints,
    resolvedPaths: sceneModel.interaction.resolvedPaths,
    discretizedByPath: sceneModel.interaction.discretizedByPathForInteraction,
    snapSettings,
    rMinDragTargets: sceneModel.interaction.baseRMinDragTargets,
    setSnapGuide,
    setAddPointPreview,
    notify: setNotification,
    addPointPreview,
  });

  const { draggingWaypointId, draggingPathId, isRobotAnimationSuppressed } =
    pointerHandlers;

  const rMinDragTargets = sceneModel.resolveRMinDragTargets({
    draggingWaypointId,
    draggingPathId,
  });

  const { libraryDropPreview } = useLibraryPointDrop({
    canvasHostRef,
    stageRef,
    mode,
    activePath,
    resolvedPaths: sceneModel.interaction.resolvedPaths,
    discretizedByPathForInteraction:
      sceneModel.interaction.discretizedByPathForInteraction,
    canvasTransform,
    insertLibraryWaypoint,
  });

  const isRobotAnimationEnabled =
    !isRobotAnimationSuppressed && isRobotPreviewEnabled;
  const robotAnimation = usePathAnimation(
    sceneModel.render.activePathTiming,
    isRobotAnimationEnabled,
  );
  const backgroundImageElement = useLoadedImage(backgroundImage?.url ?? null);

  return (
    <main className={`canvas-shell ${styles.shell}`} aria-label="main canvas">
      <div
        ref={canvasHostRef}
        className={`path-canvas ${styles.stageCanvas} ${
          mode === 'path' ? styles.editingMode : ''
        }`}
        aria-label="robot path editor canvas"
        onPointerDown={pointerHandlers.onPointerDown}
        onPointerMove={pointerHandlers.onPointerMove}
        onPointerUp={pointerHandlers.onPointerUp}
        onPointerLeave={pointerHandlers.onPointerLeave}
        onPointerCancel={pointerHandlers.onPointerCancel}
        onLostPointerCapture={pointerHandlers.onLostPointerCapture}
        style={{
          touchAction: 'none',
          cursor: pointerHandlers.cursorClass || undefined,
        }}
      >
        {libraryDropPreview.isActive ? (
          <div className={styles.libraryDropOverlay} aria-live="polite">
            <strong>{libraryDropPreview.label ?? 'Library Point'}</strong>{' '}
            をドロップすると、 ライブラリ座標のまま path 順序へ挿入します。
          </div>
        ) : null}

        <CanvasRenderer
          stageRef={stageRef}
          viewportSize={viewportSize}
          canvasTransform={canvasTransform}
          mode={mode}
          scene={sceneModel.render}
          rMinDragTargets={rMinDragTargets}
          backgroundImageElement={backgroundImageElement}
          backgroundImageOpacity={backgroundImage?.alpha ?? 1}
          robotAnimation={robotAnimation}
          isRobotAnimationEnabled={isRobotAnimationEnabled}
          robotSettings={robotSettings}
          snapGuide={snapGuide}
          addPointPreview={addPointPreview}
        />

        {sceneModel.render.addPointPreviewWaypoint === null ? null : (
          <span
            className={styles.accessibilityOnly}
            aria-label={`preview waypoint ${sceneModel.render.addPointPreviewWaypoint.name}`}
          />
        )}

        {sceneModel.render.addPointPreviewHeadingKeyframe === null ? null : (
          <span
            className={styles.accessibilityOnly}
            aria-label={`heading point ${sceneModel.render.addPointPreviewHeadingKeyframe.name}`}
          />
        )}

        {sceneModel.render.activePathTiming === null ||
        !isRobotAnimationEnabled ||
        robotAnimation.pose === null ? null : (
          <span
            className={styles.accessibilityOnly}
            aria-label="animated robot"
          />
        )}
      </div>

      {sceneModel.render.activePathTiming === null ? null : (
        <span
          className={styles.accessibilityOnly}
          aria-label="path velocity overlay"
        />
      )}

      <SnapSettingsPanel
        settings={snapSettings}
        isOpen={snapPanelOpen}
        onToggleSetting={toggleSnapSetting}
        onToggleOpen={() => {
          setSnapPanelOpen(!snapPanelOpen);
        }}
      />
    </main>
  );
};
