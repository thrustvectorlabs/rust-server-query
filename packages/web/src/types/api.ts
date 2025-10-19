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
