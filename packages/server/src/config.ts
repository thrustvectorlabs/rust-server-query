export const config = {

  webSocket: {
    port: 9123,
  },
  webServer: {
    port: 3000,
    basePath: normalizeBasePath(process.env.WEB_SERVER_BASE_PATH),
  },
}

function normalizeBasePath(rawValue: string | undefined): string {
  if (!rawValue) {
    return '';
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return '';
  }

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, '');

  // Express treats an empty string and "/" the same; prefer empty for easier concatenation
  return withoutTrailingSlash === '/' ? '' : withoutTrailingSlash;
}
