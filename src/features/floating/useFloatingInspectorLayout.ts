import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  DEFAULT_FLOATING_INSPECTOR_LAYOUT,
  resolveFloatingInspectorPanelWidth,
  type FloatingInspectorLayout,
} from './floatingInspectorPosition';

const isPositiveFiniteNumber = (value: number | undefined): value is number => {
  return value !== undefined && Number.isFinite(value) && value > 0;
};

const resolveDimension = (...candidates: (number | undefined)[]): number => {
  for (const candidate of candidates) {
    if (isPositiveFiniteNumber(candidate)) {
      return candidate;
    }
  }

  return 0;
};

const resolveRectLeft = (element: HTMLElement | null): number | undefined => {
  if (element === null) {
    return undefined;
  }

  const { left } = element.getBoundingClientRect();
  return Number.isFinite(left) ? left : undefined;
};

const buildFloatingInspectorLayout = (
  container: HTMLDivElement | null,
  sidebar: HTMLElement | null,
): FloatingInspectorLayout => {
  const containerRectWidth =
    container?.getBoundingClientRect().width ??
    DEFAULT_FLOATING_INSPECTOR_LAYOUT.containerWidth;
  const containerWidth = resolveDimension(
    container?.clientWidth,
    containerRectWidth,
    DEFAULT_FLOATING_INSPECTOR_LAYOUT.containerWidth,
  );
  const containerLeft =
    resolveRectLeft(container) ??
    DEFAULT_FLOATING_INSPECTOR_LAYOUT.containerLeft;

  const sidebarRectWidth =
    sidebar?.getBoundingClientRect().width ??
    DEFAULT_FLOATING_INSPECTOR_LAYOUT.sidebarWidth;
  const sidebarWidth = resolveDimension(
    sidebar?.clientWidth,
    sidebarRectWidth,
    DEFAULT_FLOATING_INSPECTOR_LAYOUT.sidebarWidth,
  );
  const sidebarLeft = resolveRectLeft(sidebar) ?? containerLeft;
  const viewportWidth =
    typeof globalThis.innerWidth === 'number'
      ? globalThis.innerWidth
      : containerWidth;

  return {
    ...DEFAULT_FLOATING_INSPECTOR_LAYOUT,
    containerLeft,
    containerWidth,
    sidebarLeft,
    sidebarWidth,
    panelWidth: resolveFloatingInspectorPanelWidth(viewportWidth),
  };
};

export const useFloatingInspectorLayout = (): {
  appBodyRef: RefObject<HTMLDivElement | null>;
  sidebarRef: RefObject<HTMLElement | null>;
  layout: FloatingInspectorLayout;
} => {
  const appBodyRef = useRef<HTMLDivElement | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const [layout, setLayout] = useState<FloatingInspectorLayout>(
    DEFAULT_FLOATING_INSPECTOR_LAYOUT,
  );

  useEffect(() => {
    const updateLayout = (): void => {
      setLayout(
        buildFloatingInspectorLayout(appBodyRef.current, sidebarRef.current),
      );
    };

    updateLayout();

    const handleWindowResize = (): void => {
      updateLayout();
    };

    globalThis.addEventListener('resize', handleWindowResize);

    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            updateLayout();
          });

    if (appBodyRef.current !== null) {
      observer?.observe(appBodyRef.current);
    }

    if (sidebarRef.current !== null) {
      observer?.observe(sidebarRef.current);
    }

    return () => {
      observer?.disconnect();
      globalThis.removeEventListener('resize', handleWindowResize);
    };
  }, []);

  return {
    appBodyRef,
    sidebarRef,
    layout,
  };
};
