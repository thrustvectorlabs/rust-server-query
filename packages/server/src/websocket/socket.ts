import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { config } from '../config';
import { logMessage, loggingGroups } from '../logger/logger';
import { CLIENT_SERVER_MESSAGES } from '../types/types';

const HEARTBEAT_INTERVAL_MS = 30_000;

type ManagedSocket = WebSocket & {
  isAlive?: boolean;
};

export const startSocketServer = () => {
  const server = new WebSocketServer({
    port: config.webSocket.port,
  });

  logMessage(loggingGroups.SOCKET, `WebSocket server listening on port ${config.webSocket.port}`);

  const heartbeat = function heartbeat(this: ManagedSocket) {
    this.isAlive = true;
  };

  const heartbeatTimer = setInterval(() => {
    server.clients.forEach((client) => {
      const ws = client as ManagedSocket;

      if (ws.isAlive === false) {
        logMessage(loggingGroups.SOCKET_HEARTBEAT, 'Client missed heartbeat; terminating connection.');
        ws.terminate();
        return;
      }

      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);

  server.on('connection', (socket, request) => {
    const ws = socket as ManagedSocket;
    ws.isAlive = true;

    logMessage(
      loggingGroups.SOCKET,
      `Incoming connection from ${request.socket.remoteAddress ?? 'unknown address'}`,
    );

    ws.on('pong', heartbeat);

    ws.on('message', (messageBuffer) => {
      const message = messageBuffer.toString();
      logMessage(loggingGroups.SOCKET, `Received message: "${message}"`);

      switch (message) {
        case CLIENT_SERVER_MESSAGES.GET_SERVER_STATUS: {
          const response = {
            type: CLIENT_SERVER_MESSAGES.GET_SERVER_STATUS,
            payload: { serverAlive: true },
          };

          ws.send(JSON.stringify(response));
          break;
        }
        default: {
          logMessage(loggingGroups.SOCKET, `Unknown message "${message}"`);
        }
      }
    });

    ws.on('close', () => {
      logMessage(loggingGroups.SOCKET, 'Connection terminated.');
    });

    ws.on('error', (error) => {
      const description = error instanceof Error ? error.message : String(error);
      logMessage(loggingGroups.SOCKET, `Connection error: ${description}`);
    });
  });

  server.on('close', () => {
    clearInterval(heartbeatTimer);
  });

  return server;
};
