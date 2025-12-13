export interface ServerIdentifier {
  type: string;
  host: string;
  port: number;
}

export interface ServerDetails extends ServerIdentifier {
  name: string | null;
  map: string | null;
  currentPlayers?: number | null;
  maxPlayers: number | null;
  ping: number | null;
}

export interface ServerSummary {
  server: ServerDetails;
  lastSnapshotAt: number;
}

export interface ServersResponse {
  servers: ServerSummary[];
}

export interface PlayerObservation {
  name: string;
  score: number | null;
  time: number | null;
  raw?: unknown;
}

export interface ServerSnapshot {
  id: number;
  server: ServerDetails & {
    numPlayers: number | null;
  };
  queriedAt: number;
  players: PlayerObservation[];
}

export interface ServerSnapshotsResponse {
  server: ServerIdentifier;
  snapshots: ServerSnapshot[];
  limit: number;
}

export interface LatestSnapshotResponse {
  server: ServerIdentifier;
  snapshot: ServerSnapshot;
}

export interface DatabaseStats {
  snapshotCount: number;
  uniquePlayers: number;
  totalSessions: number;
  serverCount: number;
}

export interface DatabaseStatsResponse {
  stats: DatabaseStats;
}

export interface PlayerSessionStat {
  playerName: string;
  sessionCount: number;
  firstSeen: number;
}

export interface PlayerSessionsResponse {
  players: PlayerSessionStat[];
}
