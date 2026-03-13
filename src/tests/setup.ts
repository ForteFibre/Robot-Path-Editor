import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { beforeEach, vi } from 'vitest';
import { deleteLinkedFileHandle } from '../io/workspaceFileLinkPersistence';
import { deleteWorkspacePersistence } from '../io/workspacePersistence';
import { resetWorkspaceStore } from '../store/workspaceStore';

beforeEach(async () => {
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
