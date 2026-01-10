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
  lastSeenAt: number;
}

export interface ServersResponse {
  servers: ServerSummary[];
}

export interface ActivePlayerSession {
  playerName: string;
  steamId: string | null;
  startedAt: number;
  lastSeenAt: number;
}

export interface PlayerSessionRecord extends ActivePlayerSession {
  id: number;
  endedAt: number | null;
}

export interface ServerPlayersResponse {
  server: ServerDetails;
  lastSeenAt: number;
  players: ActivePlayerSession[];
}

export interface ServerSessionsResponse {
  server: ServerDetails;
  lastSeenAt: number;
  sessions: PlayerSessionRecord[];
  limit: number;
}

export interface DatabaseStats {
  totalSessions: number;
  uniquePlayers: number;
  activeSessions: number;
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

export interface ClientSessionStat {
  ipAddress: string;
  firstSeenAt: number;
  lastSeenAt: number;
  sessionCount: number;
  uniqueRoutes: number;
  lastRoute: string | null;
  lastUserAgent: string | null;
}

export interface ClientSessionsResponse {
  sessions: ClientSessionStat[];
}

export interface InternalEmailRequest {
  subject: string;
  body: string;
}

export interface InternalEmailResponse {
  ok: boolean;
}
