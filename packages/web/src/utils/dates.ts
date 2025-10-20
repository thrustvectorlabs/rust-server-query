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

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) {
    return 'Unknown';
  }

  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours === 0 && minutes === 0 && secs === 0) {
    return '0s';
  }

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
    parts.push(`${minutes.toString().padStart(2, '0')}m`);
  } else if (minutes > 0) {
    parts.push(`${minutes}m`);
  }

  const secondsString =
    hours > 0 || minutes > 0 ? secs.toString().padStart(2, '0') : secs.toString();
  parts.push(`${secondsString}s`);

  return parts.join(' ');
}
