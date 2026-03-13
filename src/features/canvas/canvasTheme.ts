const canvasThemeTokenMap = {
  grid: {
    line: '--color-canvas-grid-line',
    originAxis: '--color-canvas-grid-origin-axis',
    label: '--color-canvas-grid-label',
  },
  rMinDrag: {
    ringStroke: '--color-canvas-rmin-ring',
    lineStroke: '--color-canvas-rmin-line',
    labelFill: '--color-canvas-rmin-label',
    centerFill: '--color-canvas-rmin-center',
  },
  robot: {
    bodyFill: '--color-canvas-robot-body',
  },
  guides: {
    lineStroke: '--color-canvas-guides-line',
    pointFill: '--color-canvas-guides-point',
    labelFill: '--color-canvas-guides-label',
  },
  resolvedPath: {
    headingRangeStroke: '--color-canvas-resolved-heading-range-stroke',
  },
  waypoint: {
    selectedFill: '--color-canvas-waypoint-selected-fill',
    libraryLinkedFill: '--color-canvas-waypoint-library-fill',
    defaultFill: '--color-canvas-waypoint-default-fill',
    libraryLinkedStroke: '--color-canvas-waypoint-library-stroke',
    inactiveLibraryLinkedFill: '--color-canvas-waypoint-library-inactive-fill',
    labelFill: '--color-canvas-waypoint-label',
    pathHeadingStroke: '--color-canvas-waypoint-path-heading-stroke',
    robotHeadingStroke: '--color-canvas-waypoint-robot-heading-stroke',
    breakLabelFill: '--color-canvas-waypoint-break-label',
  },
  headingKeyframe: {
    selectedFill: '--color-canvas-heading-keyframe-selected-fill',
    defaultFill: '--color-canvas-heading-keyframe-default-fill',
    stroke: '--color-canvas-heading-keyframe-stroke',
    labelFill: '--color-canvas-heading-keyframe-label',
    handleFill: '--color-canvas-heading-keyframe-handle',
  },
  velocity: {
    low: '--color-canvas-velocity-low',
    high: '--color-canvas-velocity-high',
  },
} as const;

export type CanvasTheme = {
  [Section in keyof typeof canvasThemeTokenMap]: {
    [ColorKey in keyof (typeof canvasThemeTokenMap)[Section]]: string;
  };
};

const resolveCssToken = (tokenName: string): string => {
  if (typeof document === 'undefined') {
    throw new TypeError(
      `Canvas theme token "${tokenName}" requires a browser document.`,
    );
  }

  const tokenValue = getComputedStyle(document.documentElement)
    .getPropertyValue(tokenName)
    .trim();

  if (tokenValue.length === 0) {
    throw new TypeError(`Missing required canvas theme token: ${tokenName}`);
  }

  return tokenValue;
};

const resolveTokenSection = <TokenSection extends Record<string, string>>(
  tokenSection: TokenSection,
): { [TokenKey in keyof TokenSection]: string } => {
  const resolvedSection = {} as { [TokenKey in keyof TokenSection]: string };

  for (const tokenKey in tokenSection) {
    const tokenName = tokenSection[tokenKey];
    if (tokenName === undefined) {
      throw new TypeError(
        `Missing canvas theme token mapping for key: ${tokenKey}`,
      );
    }

    resolvedSection[tokenKey] = resolveCssToken(tokenName);
  }

  return resolvedSection;
};

const resolveCanvasTheme = (): CanvasTheme => {
  return {
    grid: resolveTokenSection(canvasThemeTokenMap.grid),
    rMinDrag: resolveTokenSection(canvasThemeTokenMap.rMinDrag),
    robot: resolveTokenSection(canvasThemeTokenMap.robot),
    guides: resolveTokenSection(canvasThemeTokenMap.guides),
    resolvedPath: resolveTokenSection(canvasThemeTokenMap.resolvedPath),
    waypoint: resolveTokenSection(canvasThemeTokenMap.waypoint),
    headingKeyframe: resolveTokenSection(canvasThemeTokenMap.headingKeyframe),
    velocity: resolveTokenSection(canvasThemeTokenMap.velocity),
  };
};

let cachedCanvasTheme: CanvasTheme | null = null;

const getCanvasTheme = (): CanvasTheme => {
  if (cachedCanvasTheme !== null) {
    return cachedCanvasTheme;
  }

  cachedCanvasTheme = resolveCanvasTheme();
  return cachedCanvasTheme;
};

export const resetCanvasThemeCache = (): void => {
  cachedCanvasTheme = null;
};

export const canvasTheme: CanvasTheme = {
  get grid() {
    return getCanvasTheme().grid;
  },
  get rMinDrag() {
    return getCanvasTheme().rMinDrag;
  },
  get robot() {
    return getCanvasTheme().robot;
  },
  get guides() {
    return getCanvasTheme().guides;
  },
  get resolvedPath() {
    return getCanvasTheme().resolvedPath;
  },
  get waypoint() {
    return getCanvasTheme().waypoint;
  },
  get headingKeyframe() {
    return getCanvasTheme().headingKeyframe;
  },
  get velocity() {
    return getCanvasTheme().velocity;
  },
};
