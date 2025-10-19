const RELATIVE_FORMATTER = new Intl.RelativeTimeFormat(undefined, {
  numeric: 'auto',
});

export function formatRelativeTime(timestamp: number): string {
  if (!Number.isFinite(timestamp)) {
    return 'Unknown';
  }

  const now = Date.now();
  const diff = timestamp - now;
  const diffInSeconds = Math.round(diff / 1000);

  if (Math.abs(diffInSeconds) < 60) {
    return RELATIVE_FORMATTER.format(diffInSeconds, 'second');
  }

  const diffInMinutes = Math.round(diffInSeconds / 60);
  if (Math.abs(diffInMinutes) < 60) {
    return RELATIVE_FORMATTER.format(diffInMinutes, 'minute');
  }

  const diffInHours = Math.round(diffInMinutes / 60);
  if (Math.abs(diffInHours) < 24) {
    return RELATIVE_FORMATTER.format(diffInHours, 'hour');
  }

  const diffInDays = Math.round(diffInHours / 24);
  return RELATIVE_FORMATTER.format(diffInDays, 'day');
}

export function formatTime(timestamp: number): string {
  if (!Number.isFinite(timestamp)) {
    return 'Unknown';
  }
  return new Date(timestamp).toLocaleString();
}
