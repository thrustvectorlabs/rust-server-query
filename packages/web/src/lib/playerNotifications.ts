import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'rust-server-dashboard:player-notifications';

export type PlayerIdentity = {
  playerName: string;
  steamId: string | null;
};

export type PlayerNotificationStatus = 'active' | 'offline' | 'unknown';

export type PlayerNotificationEntry = PlayerIdentity & {
  key: string;
  subscribedAt: number;
  lastSeenAt: number | null;
  status: PlayerNotificationStatus;
};

type PlayerNotificationState = {
  version: 1;
  players: Record<string, PlayerNotificationEntry>;
};

const DEFAULT_STATE: PlayerNotificationState = {
  version: 1,
  players: {},
};

export function getPlayerIdentityKey(identity: PlayerIdentity): string {
  if (identity.steamId) {
    return `steam:${identity.steamId}`;
  }
  return `name:${identity.playerName.trim().toLowerCase()}`;
}

function loadState(): PlayerNotificationState {
  if (typeof window === 'undefined') {
    return DEFAULT_STATE;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_STATE;
    }
    const parsed = JSON.parse(raw) as PlayerNotificationState;
    if (!parsed || parsed.version !== 1 || typeof parsed.players !== 'object') {
      return DEFAULT_STATE;
    }
    return parsed;
  } catch {
    return DEFAULT_STATE;
  }
}

function persistState(state: PlayerNotificationState) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore write errors (private mode, quota, etc).
  }
}

type PlayerUpdate = PlayerIdentity & {
  lastSeenAt: number | null;
  status: PlayerNotificationStatus;
};

function applyUpdates(
  state: PlayerNotificationState,
  updates: PlayerUpdate[],
): PlayerNotificationState {
  if (updates.length === 0) {
    return state;
  }
  let changed = false;
  const nextPlayers = { ...state.players };

  for (const update of updates) {
    const key = getPlayerIdentityKey(update);
    const existing = nextPlayers[key];
    if (!existing) {
      continue;
    }
    const nextEntry = { ...existing };
    nextEntry.playerName = update.playerName;
    nextEntry.steamId = update.steamId ?? null;

    if (update.lastSeenAt !== null) {
      if (nextEntry.lastSeenAt === null || update.lastSeenAt >= nextEntry.lastSeenAt) {
        nextEntry.lastSeenAt = update.lastSeenAt;
        nextEntry.status = update.status;
      }
    } else if (nextEntry.status === 'unknown') {
      nextEntry.status = update.status;
    }

    if (
      nextEntry.playerName !== existing.playerName ||
      nextEntry.steamId !== existing.steamId ||
      nextEntry.lastSeenAt !== existing.lastSeenAt ||
      nextEntry.status !== existing.status
    ) {
      nextPlayers[key] = nextEntry;
      changed = true;
    }
  }

  if (!changed) {
    return state;
  }
  return { ...state, players: nextPlayers };
}

export function usePlayerNotifications() {
  const [state, setState] = useState<PlayerNotificationState>(() => loadState());

  useEffect(() => {
    persistState(state);
  }, [state]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) {
        return;
      }
      if (!event.newValue) {
        setState(DEFAULT_STATE);
        return;
      }
      try {
        const parsed = JSON.parse(event.newValue) as PlayerNotificationState;
        if (parsed && parsed.version === 1 && typeof parsed.players === 'object') {
          setState(parsed);
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const subscriptions = useMemo(
    () => Object.values(state.players),
    [state.players],
  );

  const isSubscribed = useCallback(
    (identity: PlayerIdentity) => {
      const key = getPlayerIdentityKey(identity);
      return Boolean(state.players[key]);
    },
    [state.players],
  );

  const toggleSubscription = useCallback(
    (
      identity: PlayerIdentity,
      initialStatus: PlayerNotificationStatus = 'unknown',
      lastSeenAt: number | null = null,
    ) => {
      setState((prev) => {
        const key = getPlayerIdentityKey(identity);
        const nextPlayers = { ...prev.players };
        if (nextPlayers[key]) {
          delete nextPlayers[key];
          return { ...prev, players: nextPlayers };
        }
        nextPlayers[key] = {
          key,
          playerName: identity.playerName,
          steamId: identity.steamId ?? null,
          subscribedAt: Date.now(),
          lastSeenAt,
          status: initialStatus,
        };
        return { ...prev, players: nextPlayers };
      });
    },
    [],
  );

  const updateLastSeen = useCallback((updates: PlayerUpdate[]) => {
    setState((prev) => applyUpdates(prev, updates));
  }, []);

  const clearAll = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  return {
    subscriptions,
    isSubscribed,
    toggleSubscription,
    updateLastSeen,
    clearAll,
  };
}
