const fullDateTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const relativeTimeFormatter = new Intl.RelativeTimeFormat('ja-JP', {
  numeric: 'auto',
});

const formatRelativeSavedAt = (savedAt: number): string | null => {
  const elapsedSeconds = Math.round((savedAt - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(elapsedSeconds);

  if (absoluteSeconds < 30) {
    return 'たった今';
  }

  if (absoluteSeconds < 60 * 60) {
    return relativeTimeFormatter.format(
      Math.round(elapsedSeconds / 60),
      'minute',
    );
  }

  if (absoluteSeconds < 60 * 60 * 24) {
    return relativeTimeFormatter.format(
      Math.round(elapsedSeconds / 3600),
      'hour',
    );
  }

  if (absoluteSeconds < 60 * 60 * 24 * 7) {
    return relativeTimeFormatter.format(
      Math.round(elapsedSeconds / (3600 * 24)),
      'day',
    );
  }

  return null;
};

export const formatAbsoluteDateTime = (timestamp: number): string => {
  return fullDateTimeFormatter.format(timestamp);
};

export const formatTimestampLabel = (timestamp: number): string => {
  const relativeLabel = formatRelativeSavedAt(timestamp);
  const absoluteLabel = formatAbsoluteDateTime(timestamp);

  if (relativeLabel === null) {
    return absoluteLabel;
  }

  return `${relativeLabel}（${absoluteLabel}）`;
};
