export const DEFAULT_PATH_COLOR_TOKENS = [
  '--color-path-series-1',
  '--color-path-series-2',
  '--color-path-series-3',
  '--color-path-series-4',
  '--color-path-series-5',
] as const;

// Synchronized with src/styles/tokens.css semantic tokens above.
export const DEFAULT_PATH_COLORS = [
  '#1d4ed8',
  '#ea580c',
  '#15803d',
  '#6d28d9',
  '#b91c1c',
] as const;

export const getDefaultPathColor = (index: number): string => {
  const paletteIndex = Math.abs(index % DEFAULT_PATH_COLORS.length);
  const color = DEFAULT_PATH_COLORS[paletteIndex];

  if (color === undefined) {
    throw new RangeError(
      `default path color is missing for palette index ${paletteIndex}`,
    );
  }

  return color;
};
