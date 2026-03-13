import type { CSSProperties } from 'react';
import type { CanvasTransform } from '../../domain/canvasTransform';
import { worldToScreen } from '../../domain/geometry';

export type FloatingInspectorLayout = {
  sidebarLeft: number;
  sidebarWidth: number;
  containerLeft: number;
  containerWidth: number;
  panelWidth: number;
  horizontalGap: number;
  minLeftMargin: number;
  minTop: number;
  verticalOffset: number;
};

export const DEFAULT_FLOATING_INSPECTOR_LAYOUT: FloatingInspectorLayout = {
  sidebarLeft: 0,
  sidebarWidth: 320,
  containerLeft: 0,
  containerWidth: 1200,
  panelWidth: 280,
  horizontalGap: 80,
  minLeftMargin: 8,
  minTop: 12,
  verticalOffset: 120,
};

export const resolveFloatingInspectorPanelWidth = (
  viewportWidth: number,
): number => {
  return viewportWidth > 0 && viewportWidth <= 1200 ? 240 : 280;
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

export const getPanelStyle = (
  canvasTransform: CanvasTransform,
  anchorWorld: { x: number; y: number } | null,
  layout: FloatingInspectorLayout = DEFAULT_FLOATING_INSPECTOR_LAYOUT,
): CSSProperties => {
  if (anchorWorld === null) {
    return {};
  }

  const anchorScreen = worldToScreen(anchorWorld, canvasTransform);
  const sidebarInset = Math.max(
    layout.sidebarLeft + layout.sidebarWidth - layout.containerLeft,
    0,
  );
  const minLeft = sidebarInset + layout.minLeftMargin;
  const maxLeft = Math.max(minLeft, layout.containerWidth - layout.panelWidth);
  const preferredLeft = sidebarInset + anchorScreen.x + layout.horizontalGap;

  return {
    left: `${clamp(preferredLeft, minLeft, maxLeft)}px`,
    top: `${Math.max(anchorScreen.y - layout.verticalOffset, layout.minTop)}px`,
    right: 'auto',
  };
};
