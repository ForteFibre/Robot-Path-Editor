import type Konva from 'konva';
import { type ReactElement, type RefObject } from 'react';
import { Group, Image as KonvaImage, Layer, Stage } from 'react-konva';
import type { CanvasTransform } from '../../../domain/canvasTransform';
import type { SnapGuide } from '../../../domain/geometry';
import type { EditorMode, RobotMotionSettings } from '../../../domain/models';
import type { PathAnimationState } from '../hooks/usePathAnimation';
import type { AddPointPreviewState } from '../hooks/useCanvasPointerMachine';
import type { CanvasSceneRenderModel } from '../hooks/canvasScene/types';
import type { RMinDragTarget } from '../types/rMinDragTarget';
import type { CanvasViewportSize } from '../hooks/useCanvasViewport';
import { CanvasGrid } from './CanvasGrid';
import { CanvasGuides } from './CanvasGuides';
import { CanvasPathVelocityOverlay } from './CanvasPathVelocityOverlay';
import { CanvasPreviewOverlay } from './CanvasPreviewOverlay';
import { CanvasResolvedPathLayer } from './CanvasResolvedPathLayer';
import { CanvasRobotLayer } from './CanvasRobotLayer';

type CanvasRendererProps = {
  stageRef: RefObject<Konva.Stage | null>;
  viewportSize: CanvasViewportSize;
  canvasTransform: CanvasTransform;
  mode: EditorMode;
  scene: CanvasSceneRenderModel;
  rMinDragTargets: RMinDragTarget[];
  backgroundImageElement: HTMLImageElement | null;
  backgroundImageOpacity: number;
  robotAnimation: PathAnimationState;
  isRobotAnimationEnabled: boolean;
  robotSettings: RobotMotionSettings;
  snapGuide: SnapGuide;
  addPointPreview: AddPointPreviewState | null;
};

export const CanvasRenderer = ({
  stageRef,
  viewportSize,
  canvasTransform,
  mode,
  scene,
  rMinDragTargets,
  backgroundImageElement,
  backgroundImageOpacity,
  robotAnimation,
  isRobotAnimationEnabled,
  robotSettings,
  snapGuide,
  addPointPreview,
}: CanvasRendererProps): ReactElement => {
  const k = canvasTransform.k;
  const activePathTiming = scene.activePathTiming;
  const isVelocityOverlayVisible = activePathTiming !== null;

  return (
    <Stage
      ref={stageRef}
      width={viewportSize.width}
      height={viewportSize.height}
    >
      <Layer listening={false}>
        <Group
          x={canvasTransform.x}
          y={canvasTransform.y}
          scaleX={k}
          scaleY={k}
          listening={false}
        >
          {scene.backgroundImageRenderState !== null &&
          scene.backgroundImageCanvasOrigin !== null &&
          backgroundImageElement !== null ? (
            <KonvaImage
              image={backgroundImageElement}
              x={
                scene.backgroundImageCanvasOrigin.x -
                scene.backgroundImageRenderState.height
              }
              y={scene.backgroundImageCanvasOrigin.y}
              width={scene.backgroundImageRenderState.width}
              height={scene.backgroundImageRenderState.height}
              rotation={-90}
              opacity={backgroundImageOpacity}
              listening={false}
            />
          ) : null}

          <CanvasGrid
            canvasTransform={canvasTransform}
            k={k}
            viewportWidth={viewportSize.width}
            viewportHeight={viewportSize.height}
          />
        </Group>
      </Layer>

      <Layer>
        <Group
          x={canvasTransform.x}
          y={canvasTransform.y}
          scaleX={k}
          scaleY={k}
        >
          {scene.visiblePaths.map((visiblePath) => (
            <CanvasResolvedPathLayer
              key={visiblePath.path.id}
              visiblePath={visiblePath}
              mode={mode}
              k={k}
              rMinDragTargets={rMinDragTargets}
              isVelocityOverlayVisible={isVelocityOverlayVisible}
            />
          ))}

          {activePathTiming === null ? null : (
            <CanvasPathVelocityOverlay timing={activePathTiming} k={k} />
          )}

          <CanvasGuides snapGuide={snapGuide} k={k} />

          <CanvasPreviewOverlay
            addPointPreview={addPointPreview}
            addPointPreviewPath={scene.addPointPreviewPath}
            addPointPreviewWaypoint={scene.addPointPreviewWaypoint}
            addPointPreviewHeadingKeyframe={
              scene.addPointPreviewHeadingKeyframe
            }
            k={k}
            mode={mode}
          />
        </Group>
      </Layer>

      <Layer listening={false}>
        <Group
          x={canvasTransform.x}
          y={canvasTransform.y}
          scaleX={k}
          scaleY={k}
          listening={false}
        >
          <CanvasRobotLayer
            timing={scene.activePathTiming}
            pose={robotAnimation.pose}
            robotSettings={robotSettings}
            color={scene.activePathAnimationColor}
            k={k}
            enabled={isRobotAnimationEnabled}
          />
        </Group>
      </Layer>
    </Stage>
  );
};
