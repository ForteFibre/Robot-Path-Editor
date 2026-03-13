export const canvasTheme = {
  grid: {
    line: '#e5e7eb',
    originAxis: '#cbd5e1',
    label: '#94a3b8',
  },
  rMinDrag: {
    ringStroke: 'rgba(37, 99, 235, 0.3)',
    lineStroke: 'rgba(37, 99, 235, 0.5)',
    labelFill: 'rgba(37, 99, 235, 0.8)',
    centerFill: 'rgba(37, 99, 235, 0.6)',
  },
  robot: {
    bodyFill: 'rgba(255, 255, 255, 0.82)',
  },
  guides: {
    lineStroke: '#14b8a6',
    pointFill: '#14b8a6',
    labelFill: '#0f766e',
  },
  resolvedPath: {
    headingRangeStroke: '#16a34a',
  },
  waypoint: {
    selectedFill: '#111827',
    libraryLinkedFill: '#f5f3ff',
    defaultFill: '#ffffff',
    libraryLinkedStroke: '#7c3aed',
    inactiveLibraryLinkedFill: '#8b5cf6',
    labelFill: '#111827',
    pathHeadingStroke: '#0ea5e9',
    robotHeadingStroke: '#16a34a',
    breakLabelFill: '#b91c1c',
  },
  headingKeyframe: {
    selectedFill: '#14532d',
    defaultFill: '#dcfce7',
    stroke: '#16a34a',
    labelFill: '#14532d',
    handleFill: '#16a34a',
  },
} as const;
