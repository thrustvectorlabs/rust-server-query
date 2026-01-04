import {
  Badge,
  Card,
  Flex,
  Group,
  Loader,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { useParams } from 'react-router-dom';
import { apiGet } from '../lib/api.js';
import type {
  ActivePlayerSession,
  PlayerSessionRecord,
  ServerPlayersResponse,
  ServerSessionsResponse,
} from '../types/api.js';
import { formatDuration, formatRelativeTime, formatTime } from '../utils/dates.js';

const REFRESH_INTERVAL = 20_000;
const SESSION_LIMIT = 50;

type SortDirection = 'asc' | 'desc';
type SortState<T extends string> = { key: T; direction: SortDirection };
type ActivePlayersSortKey = 'playerName' | 'steamId' | 'startedAt' | 'duration';
type SessionsSortKey = 'playerName' | 'steamId' | 'startedAt' | 'endedAt' | 'duration';

export function ServerSessionsPage() {
  const { type, host, port } = useParams();

  const serverPath = type && host && port ? `${type}/${host}/${port}` : null;

  const playersQuery = useQuery({
    queryKey: ['server-players', type, host, port],
    queryFn: () =>
      apiGet<ServerPlayersResponse>(`/servers/${serverPath}/players`),
    enabled: Boolean(serverPath),
    refetchInterval: REFRESH_INTERVAL,
  });

  const sessionsQuery = useQuery({
    queryKey: ['server-sessions', type, host, port, SESSION_LIMIT],
    queryFn: () =>
      apiGet<ServerSessionsResponse>(
        `/servers/${serverPath}/sessions?limit=${SESSION_LIMIT}`,
      ),
    enabled: Boolean(serverPath),
    refetchInterval: REFRESH_INTERVAL,
  });

  const server = playersQuery.data?.server ?? sessionsQuery.data?.server ?? null;
  const lastSeenAt = playersQuery.data?.lastSeenAt ?? sessionsQuery.data?.lastSeenAt ?? null;
  const activePlayers = playersQuery.data?.players ?? [];
  const recentSessions = sessionsQuery.data?.sessions ?? [];
  const [activePlayersSort, setActivePlayersSort] = useState<SortState<ActivePlayersSortKey> | null>(
    null,
  );
  const [sessionsSort, setSessionsSort] = useState<SortState<SessionsSortKey> | null>(null);

  const sortedActivePlayers = useMemo(() => {
    if (!activePlayersSort) {
      return activePlayers;
    }
    const now = Date.now();
    return [...activePlayers].sort((a, b) => {
      const aValue = getActivePlayerSortValue(a, activePlayersSort.key, now);
      const bValue = getActivePlayerSortValue(b, activePlayersSort.key, now);
      const order = compareSortValues(aValue, bValue);
      return activePlayersSort.direction === 'asc' ? order : -order;
    });
  }, [activePlayers, activePlayersSort]);

  const sortedSessions = useMemo(() => {
    if (!sessionsSort) {
      return recentSessions;
    }
    const now = Date.now();
    return [...recentSessions].sort((a, b) => {
      const aValue = getSessionSortValue(a, sessionsSort.key, now);
      const bValue = getSessionSortValue(b, sessionsSort.key, now);
      const order = compareSortValues(aValue, bValue);
      return sessionsSort.direction === 'asc' ? order : -order;
    });
  }, [recentSessions, sessionsSort]);

  if (!serverPath) {
    return (
      <Card withBorder shadow="sm">
        <Text c="red" fw={600}>
          Invalid server identifier.
        </Text>
      </Card>
    );
  }

  return (
    <Stack gap="lg">
      <Stack gap={6}>
        <Title order={2}>{server?.name ?? `${host}:${port}`}</Title>
        <Group gap="xs">
          <Badge size="sm" variant="light" color="blue">
            {type}
          </Badge>
          <Badge size="sm" variant="light">
            {host}:{port}
          </Badge>
          {server?.map ? (
            <Badge size="sm" variant="light" color="teal">
              {server.map}
            </Badge>
          ) : null}
        </Group>
        <Text c="dimmed" size="sm">
          Live player sessions. Updates every {Math.round(REFRESH_INTERVAL / 1000)} seconds.
        </Text>
      </Stack>

      <Card withBorder padding="md" shadow="sm">
        <Group justify="space-between" mb="md" align="center">
          <div>
            <Title order={4}>Active players</Title>
            <Text c="dimmed" size="sm">
              Players currently reported by the latest valid server response.
            </Text>
          </div>
          {playersQuery.isFetching && <Loader size="sm" />}
        </Group>

        {activePlayers.length === 0 ? (
          <Text>No active players right now.</Text>
        ) : (
          <ScrollArea>
            <Table striped highlightOnHover withRowBorders={false}>
              <Table.Thead>
                <Table.Tr>
                  <SortableHeader
                    label="Player"
                    sortKey="playerName"
                    sortState={activePlayersSort}
                    onChange={setActivePlayersSort}
                  />
                  <SortableHeader
                    label="Steam ID"
                    sortKey="steamId"
                    sortState={activePlayersSort}
                    onChange={setActivePlayersSort}
                  />
                  <SortableHeader
                    label="Connected"
                    sortKey="startedAt"
                    sortState={activePlayersSort}
                    onChange={setActivePlayersSort}
                  />
                  <SortableHeader
                    label="Session length"
                    sortKey="duration"
                    sortState={activePlayersSort}
                    onChange={setActivePlayersSort}
                  />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sortedActivePlayers.map((player) => (
                  <ActivePlayerRow key={playerKey(player)} player={player} />
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Card>

      {/* {(playersQuery.isLoading || sessionsQuery.isLoading) && (
        <Flex align="center" justify="center" mih={120}>
          <Loader size="lg" />
        </Flex>
      )} */}

      {(playersQuery.isError || sessionsQuery.isError) && (
        <Card withBorder shadow="sm">
          <Text c="red" fw={600}>
            Failed to load server sessions: {resolveError(playersQuery.error ?? sessionsQuery.error)}
          </Text>
        </Card>
      )}

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card withBorder shadow="sm">
          <Stack gap={4}>
            <Text c="dimmed" size="sm">
              Current players
            </Text>
            <Title order={3}>{activePlayers.length}</Title>
            {server ? (
              <Text size="sm" c="dimmed">
                {formatCount(server.currentPlayers)} / {formatCount(server.maxPlayers)} slots
              </Text>
            ) : null}
            {lastSeenAt ? (
              <Text size="sm" c="dimmed">
                Last seen {formatRelativeTime(lastSeenAt)} ({formatTime(lastSeenAt)})
              </Text>
            ) : null}
          </Stack>
        </Card>
        <Card withBorder shadow="sm">
          <Stack gap={4}>
            <Text c="dimmed" size="sm">
              Ping
            </Text>
            <Title order={3}>
              {server?.ping !== null && server?.ping !== undefined ? `${server.ping} ms` : '—'}
            </Title>
            <Text size="sm" c="dimmed">
              Recent session records: {recentSessions.length} (showing last {SESSION_LIMIT})
            </Text>
          </Stack>
        </Card>
      </SimpleGrid>


      <Card withBorder padding="md" shadow="sm">
        <Group justify="space-between" mb="md" align="center">
          <div>
            <Title order={4}>Historical sessions</Title>
          </div>
          {sessionsQuery.isFetching && <Loader size="sm" />}
        </Group>

        {recentSessions.length === 0 ? (
          <Text>No sessions recorded yet.</Text>
        ) : (
          <ScrollArea>
            <Table striped highlightOnHover withRowBorders={false}>
              <Table.Thead>
                <Table.Tr>
                  <SortableHeader
                    label="Player"
                    sortKey="playerName"
                    sortState={sessionsSort}
                    onChange={setSessionsSort}
                  />
                  <SortableHeader
                    label="Steam ID"
                    sortKey="steamId"
                    sortState={sessionsSort}
                    onChange={setSessionsSort}
                  />
                  <SortableHeader
                    label="Started"
                    sortKey="startedAt"
                    sortState={sessionsSort}
                    onChange={setSessionsSort}
                  />
                  <SortableHeader
                    label="Ended"
                    sortKey="endedAt"
                    sortState={sessionsSort}
                    onChange={setSessionsSort}
                  />
                  <SortableHeader
                    label="Duration"
                    sortKey="duration"
                    sortState={sessionsSort}
                    onChange={setSessionsSort}
                  />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sortedSessions.map((session) => (
                  <SessionRow key={session.id} session={session} />
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Card>
    </Stack>
  );
}

function ActivePlayerRow({ player }: { player: ActivePlayerSession }) {
  const durationSeconds = Math.max(0, Math.floor((Date.now() - player.startedAt) / 1000));

  return (
    <Table.Tr>
      <Table.Td>{player.playerName}</Table.Td>
      <Table.Td>{player.steamId ?? '—'}</Table.Td>
      <Table.Td>
        <Tooltip label={formatRelativeTime(player.startedAt)}>
          <Text size="sm">{formatTime(player.startedAt)}</Text>
        </Tooltip>
      </Table.Td>
      <Table.Td>{formatDuration(durationSeconds)}</Table.Td>
    </Table.Tr>
  );
}

function SortableHeader<T extends string>({
  label,
  sortKey,
  sortState,
  onChange,
}: {
  label: string;
  sortKey: T;
  sortState: SortState<T> | null;
  onChange: (next: SortState<T>) => void;
}) {
  const isActive = sortState?.key === sortKey;
  const ariaSort = isActive
    ? sortState.direction === 'asc'
      ? 'ascending'
      : 'descending'
    : 'none';

  const handleClick = () => {
    onChange(getNextSortState(sortState, sortKey));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTableCellElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onChange(getNextSortState(sortState, sortKey));
    }
  };

  return (
    <Table.Th
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-sort={ariaSort}
      style={{ cursor: 'pointer', userSelect: 'none' }}
      title={`Sort by ${label}`}
    >
      <Flex align="center" gap={6}>
        <Text size="sm" fw={600} component="span">
          {label}
        </Text>
        {isActive ? (
          <Text size="xs" c="dimmed" component="span">
            {sortState.direction === 'asc' ? '^' : 'v'}
          </Text>
        ) : null}
      </Flex>
    </Table.Th>
  );
}

function SessionRow({ session }: { session: PlayerSessionRecord }) {
  const endTime = session.endedAt ?? Date.now();
  const durationSeconds = Math.max(0, Math.floor((endTime - session.startedAt) / 1000));

  return (
    <Table.Tr>
      <Table.Td>{session.playerName}</Table.Td>
      <Table.Td>{session.steamId ?? '—'}</Table.Td>
      <Table.Td>
        <Tooltip label={formatRelativeTime(session.startedAt)}>
          <Text size="sm">{formatTime(session.startedAt)}</Text>
        </Tooltip>
      </Table.Td>
      <Table.Td>
        {session.endedAt ? (
          <Tooltip label={formatRelativeTime(session.endedAt)}>
            <Text size="sm">{formatTime(session.endedAt)}</Text>
          </Tooltip>
        ) : (
          <Badge size="sm" variant="light" color="green">
            Active
          </Badge>
        )}
      </Table.Td>
      <Table.Td>{formatDuration(durationSeconds)}</Table.Td>
    </Table.Tr>
  );
}

function getNextSortState<T extends string>(
  current: SortState<T> | null,
  key: T,
): SortState<T> {
  if (!current || current.key !== key) {
    return { key, direction: 'asc' };
  }
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}

function compareSortValues(
  aValue: string | number | null,
  bValue: string | number | null,
) {
  if (aValue === null && bValue === null) {
    return 0;
  }
  if (aValue === null) {
    return 1;
  }
  if (bValue === null) {
    return -1;
  }
  if (typeof aValue === 'number' && typeof bValue === 'number') {
    return aValue - bValue;
  }
  return String(aValue).localeCompare(String(bValue), undefined, { sensitivity: 'base' });
}

function getActivePlayerSortValue(
  player: ActivePlayerSession,
  key: ActivePlayersSortKey,
  now: number,
): string | number | null {
  switch (key) {
    case 'playerName':
      return player.playerName;
    case 'steamId':
      return player.steamId ?? null;
    case 'startedAt':
      return player.startedAt;
    case 'duration':
      return Math.max(0, now - player.startedAt);
    default:
      return null;
  }
}

function getSessionSortValue(
  session: PlayerSessionRecord,
  key: SessionsSortKey,
  now: number,
): string | number | null {
  switch (key) {
    case 'playerName':
      return session.playerName;
    case 'steamId':
      return session.steamId ?? null;
    case 'startedAt':
      return session.startedAt;
    case 'endedAt':
      return session.endedAt ?? null;
    case 'duration': {
      const endTime = session.endedAt ?? now;
      return Math.max(0, endTime - session.startedAt);
    }
    default:
      return null;
  }
}

function resolveError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

function formatCount(value: number | null | undefined): string {
  if (typeof value === 'number') {
    return value.toString();
  }
  return '—';
}

function playerKey(player: ActivePlayerSession): string {
  return player.playerName;
}
