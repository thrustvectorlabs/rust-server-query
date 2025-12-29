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

      {(playersQuery.isLoading || sessionsQuery.isLoading) && (
        <Flex align="center" justify="center" mih={120}>
          <Loader size="lg" />
        </Flex>
      )}

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
                  <Table.Th>Player</Table.Th>
                  <Table.Th>Steam ID</Table.Th>
                  <Table.Th>Connected</Table.Th>
                  <Table.Th>Session length</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {activePlayers.map((player) => (
                  <ActivePlayerRow key={playerKey(player)} player={player} />
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Card>

      <Card withBorder padding="md" shadow="sm">
        <Group justify="space-between" mb="md" align="center">
          <div>
            <Title order={4}>Recent sessions</Title>
            <Text c="dimmed" size="sm">
              Historical sessions, including players who already left.
            </Text>
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
                  <Table.Th>Player</Table.Th>
                  <Table.Th>Steam ID</Table.Th>
                  <Table.Th>Started</Table.Th>
                  <Table.Th>Ended</Table.Th>
                  <Table.Th>Duration</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {recentSessions.map((session) => (
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
