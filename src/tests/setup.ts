import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { beforeEach, vi } from 'vitest';
import { resetCanvasThemeCache } from '../features/canvas/canvasTheme';
import { resetVelocityColorScaleCache } from '../features/canvas/components/pathVelocitySegments';
import { deleteLinkedFileHandle } from '../io/workspaceFileLinkPersistence';
import { deleteWorkspacePersistence } from '../io/workspacePersistence';
import { resetWorkspaceStore } from '../store/workspaceStore';

const CANVAS_THEME_TEST_TOKENS: Record<string, string> = {
  '--color-canvas-grid-line': '#dbe3ef',
  '--color-canvas-grid-origin-axis': '#94a3b8',
  '--color-canvas-grid-label': '#94a3b8',
  '--color-canvas-guides-line': '#3b82f6',
  '--color-canvas-guides-point': '#3b82f6',
  '--color-canvas-guides-label': '#1d4ed8',
  '--color-canvas-rmin-ring': 'rgba(59, 130, 246, 0.35)',
  '--color-canvas-rmin-line': '#1d4ed8',
  '--color-canvas-rmin-label': '#1d4ed8',
  '--color-canvas-rmin-center': '#3b82f6',
  '--color-canvas-robot-body': 'rgba(255, 255, 255, 0.82)',
  '--color-canvas-waypoint-selected-fill': '#0f172a',
  '--color-canvas-waypoint-library-fill': '#f5f3ff',
  '--color-canvas-waypoint-default-fill': '#ffffff',
  '--color-canvas-waypoint-library-stroke': '#6d28d9',
  '--color-canvas-waypoint-library-inactive-fill': '#8b5cf6',
  '--color-canvas-waypoint-label': '#0f172a',
  '--color-canvas-waypoint-path-heading-stroke': '#3b82f6',
  '--color-canvas-waypoint-robot-heading-stroke': '#16a34a',
  '--color-canvas-waypoint-break-label': '#b91c1c',
  '--color-canvas-heading-keyframe-selected-fill': '#166534',
  '--color-canvas-heading-keyframe-default-fill': '#dcfce7',
  '--color-canvas-heading-keyframe-stroke': '#16a34a',
  '--color-canvas-heading-keyframe-label': '#166534',
  '--color-canvas-heading-keyframe-handle': '#16a34a',
  '--color-canvas-resolved-heading-range-stroke': '#16a34a',
  '--color-canvas-velocity-low': '#dc2626',
  '--color-canvas-velocity-high': '#16a34a',
  '--color-canvas-drop-overlay-bg': 'rgba(15, 23, 42, 0.85)',
};

const applyCanvasThemeTestTokens = (): void => {
  Object.entries(CANVAS_THEME_TEST_TOKENS).forEach(
    ([tokenName, tokenValue]) => {
      document.documentElement.style.setProperty(tokenName, tokenValue);
    },
  );
};

beforeEach(async () => {
  resetCanvasThemeCache();
  resetVelocityColorScaleCache();
  applyCanvasThemeTestTokens();
  resetWorkspaceStore();
  await deleteLinkedFileHandle();
  await deleteWorkspacePersistence();
});

type PointerCapturePolyfillElement = Element & {
  setPointerCapture?: (pointerId: number) => void;
  releasePointerCapture?: (pointerId: number) => void;
  hasPointerCapture?: (pointerId: number) => boolean;
};

const pointerCapturePrototype =
  Element.prototype as PointerCapturePolyfillElement;

// Polyfill Pointer Capture API for jsdom (not natively supported)
pointerCapturePrototype.setPointerCapture = () => undefined;
pointerCapturePrototype.releasePointerCapture = () => undefined;
pointerCapturePrototype.hasPointerCapture = () => false;

class ResizeObserverPolyfill {
  observe(): void {
    return undefined;
  }

  unobserve(): void {
    return undefined;
  }

  disconnect(): void {
    return undefined;
  }
}

globalThis.ResizeObserver = ResizeObserverPolyfill;

const createCanvasRenderingContext2DMock = (): CanvasRenderingContext2D => {
  const gradient = {
    addColorStop: vi.fn(),
  };

  return {
    arc: vi.fn(),
    arcTo: vi.fn(),
    beginPath: vi.fn(),
    bezierCurveTo: vi.fn(),
    clearRect: vi.fn(),
    clip: vi.fn(),
    closePath: vi.fn(),
    createImageData: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    createPattern: vi.fn(() => null),
    createRadialGradient: vi.fn(() => gradient),
    drawImage: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(),
      height: 0,
      width: 0,
    })),
    getLineDash: vi.fn(() => []),
    lineTo: vi.fn(),
    measureText: vi.fn(() => ({
      actualBoundingBoxAscent: 0,
      actualBoundingBoxDescent: 0,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: 0,
      fontBoundingBoxAscent: 0,
      fontBoundingBoxDescent: 0,
      width: 0,
    })),
    moveTo: vi.fn(),
    putImageData: vi.fn(),
    quadraticCurveTo: vi.fn(),
    rect: vi.fn(),
    resetTransform: vi.fn(),
    restore: vi.fn(),
    rotate: vi.fn(),
    save: vi.fn(),
    scale: vi.fn(),
    setLineDash: vi.fn(),
    setTransform: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    strokeText: vi.fn(),
    transform: vi.fn(),
    translate: vi.fn(),
    canvas: document.createElement('canvas'),
    direction: 'inherit',
    fillStyle: '#000000',
    filter: 'none',
    font: '10px sans-serif',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'low',
    letterSpacing: '0px',
    lineCap: 'butt',
    lineDashOffset: 0,
    lineJoin: 'miter',
    lineWidth: 1,
    miterLimit: 10,
    shadowBlur: 0,
    shadowColor: 'rgba(0, 0, 0, 0)',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    strokeStyle: '#000000',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    wordSpacing: '0px',
  } as unknown as CanvasRenderingContext2D;
};

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: () => createCanvasRenderingContext2DMock(),
  configurable: true,
  writable: true,
});

Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
  value: () => 'data:image/png;base64,',
  configurable: true,
  writable: true,
});
