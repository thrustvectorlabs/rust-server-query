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
import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api.js';
import type {
  DatabaseStatsResponse,
  PlayerSessionStat,
  PlayerSessionsResponse,
} from '../types/api.js';
import { formatRelativeTime, formatTime } from '../utils/dates.js';

const REFRESH_INTERVAL = 60_000;

export function DatabaseStatsPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['database-stats'],
    queryFn: () => apiGet<DatabaseStatsResponse>('/internal/database-stats'),
    refetchInterval: REFRESH_INTERVAL,
  });

  const playerQuery = useQuery({
    queryKey: ['player-sessions'],
    queryFn: () => apiGet<PlayerSessionsResponse>('/internal/player-sessions'),
    refetchInterval: REFRESH_INTERVAL,
  });

  const stats = data?.stats;
  const players = playerQuery.data?.players ?? [];

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <div>
          <Group gap="xs" mb={4}>
            <Title order={2}>Database Statistics</Title>
            <Badge color="gray" variant="light">Internal</Badge>
          </Group>
          <Text c="dimmed" size="sm">
            Aggregate metrics derived from stored player sessions. Sessions start the first time a
            player name appears on a server and end once they disappear from a valid query response.
          </Text>
        </div>
      </Group>

      {isLoading ? (
        <Flex align="center" justify="center" mih={200}>
          <Loader size="lg" />
        </Flex>
      ) : isError ? (
        <Card withBorder shadow="sm">
          <Text c="red" fw={600}>
            Failed to load database stats: {error instanceof Error ? error.message : 'Unknown error'}
          </Text>
        </Card>
      ) : !stats ? (
        <Card withBorder shadow="sm">
          <Text>No database statistics available yet.</Text>
        </Card>
      ) : (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
            <StatCard label="Unique players" value={stats.uniquePlayers} />
            <StatCard
              label="Active sessions"
              value={stats.activeSessions}
              tooltip="Active sessions are players currently present in the latest valid server response."
            />
            <StatCard label="Recorded sessions" value={stats.totalSessions} />
            <StatCard label="Tracked servers" value={stats.serverCount} />
          </SimpleGrid>

          <PlayerSessionsTable
            players={players}
            loading={playerQuery.isLoading}
            error={playerQuery.isError ? playerQuery.error : null}
          />
        </Stack>
      )}
    </Stack>
  );
}

type StatCardProps = {
  label: string;
  value: number;
  tooltip?: string;
};

function StatCard({ label, value, tooltip }: StatCardProps) {
  const content = (
    <Stack gap={6}>
      <Text c="dimmed" size="sm">
        {label}
      </Text>
      <Title order={3}>{formatNumber(value)}</Title>
    </Stack>
  );

  return (
    <Card withBorder shadow="sm" padding="md">
      {tooltip ? (
        <Tooltip label={tooltip} color="gray" position="top-start">
          <div>{content}</div>
        </Tooltip>
      ) : (
        content
      )}
    </Card>
  );
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString() : '0';
}

type PlayerSessionsTableProps = {
  players: PlayerSessionStat[];
  loading: boolean;
  error: unknown;
};

function PlayerSessionsTable({ players, loading, error }: PlayerSessionsTableProps) {
  type SortColumn = 'player' | 'sessions' | 'firstSeen';
  type SortDirection = 'asc' | 'desc';

  const defaultDirections: Record<SortColumn, SortDirection> = {
    player: 'asc',
    sessions: 'desc',
    firstSeen: 'asc',
  };

  const [sortBy, setSortBy] = useState<SortColumn>('sessions');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const sortedPlayers = useMemo(() => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    return [...players].sort((a, b) => {
      if (sortBy === 'player') {
        return direction * a.playerName.localeCompare(b.playerName, undefined, { sensitivity: 'base' });
      }
      if (sortBy === 'sessions') {
        return direction * (a.sessionCount - b.sessionCount);
      }
      return direction * (a.firstSeen - b.firstSeen);
    });
  }, [players, sortBy, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (column === sortBy) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDirection(defaultDirections[column]);
    }
  };

  const renderSortIndicator = (column: SortColumn) =>
    sortBy === column ? (
      <Text component="span" size="xs" c="dimmed">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </Text>
    ) : null;

  return (
    <Card withBorder padding="md" shadow="sm">
      <Group justify="space-between" mb="md" align="center">
        <div>
          <Title order={4}>Players</Title>
          <Text c="dimmed" size="sm">
            Session counts are calculated per player name across all tracked servers.
          </Text>
        </div>
        {loading && <Loader size="sm" />}
      </Group>

      {error ? (
        <Text c="red" fw={600}>
          Failed to load player sessions: {error instanceof Error ? error.message : 'Unknown error'}
        </Text>
      ) : players.length === 0 ? (
        <Text>No player sessions recorded yet.</Text>
      ) : (
        <ScrollArea>
          <Table striped highlightOnHover withRowBorders={false}>
            <Table.Thead>
              <Table.Tr>
                <SortableHeader
                  label="Player"
                  column="player"
                  sortBy={sortBy}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  renderIndicator={renderSortIndicator}
                />
                <SortableHeader
                  label="Sessions"
                  column="sessions"
                  sortBy={sortBy}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  renderIndicator={renderSortIndicator}
                />
                <SortableHeader
                  label="First seen"
                  column="firstSeen"
                  sortBy={sortBy}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  renderIndicator={renderSortIndicator}
                />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sortedPlayers.map((player) => (
                <Table.Tr key={player.playerName}>
                  <Table.Td>{player.playerName}</Table.Td>
                  <Table.Td>{formatNumber(player.sessionCount)}</Table.Td>
                  <Table.Td>
                    <Text size="sm">{formatRelativeTime(player.firstSeen)}</Text>
                    <Text size="xs" c="dimmed">
                      {formatTime(player.firstSeen)}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}
    </Card>
  );
}

type SortableHeaderProps = {
  label: string;
  column: 'player' | 'sessions' | 'firstSeen';
  sortBy: 'player' | 'sessions' | 'firstSeen';
  sortDirection: 'asc' | 'desc';
  onSort: (column: 'player' | 'sessions' | 'firstSeen') => void;
  renderIndicator: (column: 'player' | 'sessions' | 'firstSeen') => ReactNode;
};

function SortableHeader({
  label,
  column,
  sortBy,
  sortDirection,
  onSort,
  renderIndicator,
}: SortableHeaderProps) {
  return (
    <Table.Th
      aria-sort={
        sortBy === column ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'
      }
      onClick={() => onSort(column)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSort(column);
        }
      }}
      role="button"
      tabIndex={0}
      style={{ cursor: 'pointer', userSelect: 'none' }}
    >
      <Group gap={4}>
        <span>{label}</span>
        {renderIndicator(column)}
      </Group>
    </Table.Th>
  );
}
