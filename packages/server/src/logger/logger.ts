export const loggingGroups = {
  ASSET_CHECK: 'AssetCheck',
  ASSET_MANAGER: 'AssetManagerService',
  DATABASE_CHECK: 'DatabaseCheck',
  DATABASE_MANAGER: 'DatabaseManagerService',
  FILE_UTIL: 'FileUtilities',
  MAIN: 'Main',
  PREFLIGHT: 'Preflight',
  PRICE_STREAM: 'PriceStreamService',
  SERVER: 'Server',
  SERVICES: 'Services',
  SOCKET: 'Socket',
  SOCKET_HEARTBEAT: 'Socket.Heartbeat',
  WEBSERVER: 'Webserver',
};

const enabledLoggingGroups = [
  // loggingGroups.ASSET_CHECK,
  // loggingGroups.ASSET_MANAGER,
  loggingGroups.DATABASE_CHECK,
  loggingGroups.DATABASE_MANAGER,
  loggingGroups.FILE_UTIL,
  loggingGroups.MAIN,
  loggingGroups.PREFLIGHT,
  loggingGroups.PRICE_STREAM,
  loggingGroups.SERVER,
  loggingGroups.SERVICES,
  loggingGroups.SOCKET,
  // loggingGroups.SOCKET_HEARTBEAT,
  loggingGroups.WEBSERVER,
];

export const logLevels = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
};

export const logMessage = (group: (typeof loggingGroups)[keyof typeof loggingGroups], message: string, level = 'log') => {
  if (enabledLoggingGroups.includes(group)) {
    console.log(`[${group}] ${message}`);
  }
};
