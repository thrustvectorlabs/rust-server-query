import {
  Anchor,
  Badge,
  Card,
  Flex,
  Group,
  Loader,
  NumberInput,
  ScrollArea,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { AreaChart } from '@mantine/charts';
import { useQuery } from '@tanstack/react-query';
import { IconArrowLeft } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { apiGet } from '../lib/api.js';
import type {
  LatestSnapshotResponse,
  ServerSnapshotsResponse,
  ServerSnapshot,
} from '../types/api.js';
import { formatDuration, formatRelativeTime, formatTime } from '../utils/dates.js';

const DEFAULT_LIMIT = 20;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;

export function ServerSnapshotsPage() {
  const { type, host, port } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const limit = clampLimit(Number(searchParams.get('limit')) || DEFAULT_LIMIT);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['snapshots', type, host, port, limit],
    queryFn: () =>
      apiGet<ServerSnapshotsResponse>(
        `/servers/${encodeURIComponent(type ?? '')}/${encodeURIComponent(host ?? '')}/${encodeURIComponent(
          port ?? '',
        )}/snapshots?limit=${limit}`,
      ),
    enabled: Boolean(type && host && port),
    refetchInterval: 60_000,
  });

  const latestQuery = useQuery({
    queryKey: ['snapshot-latest', type, host, port],
    queryFn: () =>
      apiGet<LatestSnapshotResponse>(
        `/servers/${encodeURIComponent(type ?? '')}/${encodeURIComponent(host ?? '')}/${encodeURIComponent(
          port ?? '',
        )}/latest`,
      ),
    enabled: Boolean(type && host && port),
    refetchInterval: 20_000,
  });

  const snapshots = data?.snapshots ?? [];
  const latest = snapshots[0];

  const chartData = useMemo(
    () =>
      [...snapshots]
        .reverse()
        .map((snapshot) => ({
          time: new Date(snapshot.queriedAt).toLocaleTimeString(),
          players: snapshot.server.numPlayers ?? snapshot.players.length,
        })),
    [snapshots],
  );

  const handleLimitChange = (value: number | string) => {
    if (typeof value !== 'number') return;
    const nextLimit = clampLimit(value);
    searchParams.set('limit', String(nextLimit));
    setSearchParams(searchParams);
    void refetch();
  };

  if (!type || !host || !port) {
    return (
      <Card withBorder>
        <Text>Missing server information.</Text>
      </Card>
    );
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <div>
          <Group gap="xs">
            <Anchor component={Link} to="/" c="dimmed" size="sm">
              <Group gap={4} wrap="nowrap">
                <IconArrowLeft size={16} />
                <span>Back to overview</span>
              </Group>
            </Anchor>
          </Group>

          <Title order={2} mt="xs">
            {latest?.server.name ?? `${host}:${port}`}
          </Title>
          <Group gap="xs" mt={4}>
            <Badge size="sm" variant="light" color="blue">
              {type}
            </Badge>
            <Badge size="sm" variant="light">
              {host}:{port}
            </Badge>
            {latest?.server.map && (
              <Badge size="sm" variant="outline" color="grape">
                {latest.server.map}
              </Badge>
            )}
          </Group>
          {latest && (
            <Text c="dimmed" size="sm" mt="xs">
              Last snapshot {formatRelativeTime(latest.queriedAt)} ({formatTime(latest.queriedAt)})
            </Text>
          )}
        </div>

        <NumberInput
          label="Snapshots"
          value={limit}
          onChange={handleLimitChange}
          min={MIN_LIMIT}
          max={MAX_LIMIT}
          step={5}
          clampBehavior="strict"
          allowDecimal={false}
        />
      </Group>

      <CurrentPlayersCard
        status={{
          loading: latestQuery.isLoading,
          error: latestQuery.isError ? latestQuery.error : null,
        }}
        snapshot={latestQuery.data?.snapshot ?? null}
      />

      {isLoading ? (
        <Flex align="center" justify="center" mih={200}>
          <Loader size="lg" />
        </Flex>
      ) : isError ? (
        <Card withBorder shadow="sm">
          <Text c="red" fw={600}>
            Failed to load snapshots:{' '}
            {error instanceof Error ? error.message : 'Unknown error'}
          </Text>
        </Card>
      ) : snapshots.length === 0 ? (
        <Card withBorder shadow="sm">
          <Text>No snapshots found yet for this server.</Text>
        </Card>
      ) : (
        <Stack>
          <Card withBorder padding="md" shadow="sm">
            <Title order={4}>Players over time</Title>
            <AreaChart
              h={240}
              data={chartData}
              dataKey="time"
              withLegend
              series={[
                {
                  name: 'players',
                  label: 'Players online',
                  color: 'cyan.5',
                },
              ]}
              curveType="linear"
              connectNulls
            />
          </Card>

          <Card withBorder padding="md" shadow="sm">
            <Group justify="space-between" mb="md">
              <Title order={4}>Snapshot history</Title>
              <Text c="dimmed" size="sm">
                Showing {snapshots.length} snapshot{snapshots.length === 1 ? '' : 's'}
              </Text>
            </Group>

            <ScrollArea>
              <Table striped highlightOnHover withRowBorders={false} verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Captured</Table.Th>
                    <Table.Th>Players</Table.Th>
                    <Table.Th>Ping</Table.Th>
                    <Table.Th>Top Players</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {snapshots.map((snapshot) => (
                    <SnapshotRow key={snapshot.id} snapshot={snapshot} />
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Card>
        </Stack>
      )}
    </Stack>
  );
}

function SnapshotRow({ snapshot }: { snapshot: ServerSnapshot }) {
  const playerCount = snapshot.server.numPlayers ?? snapshot.players.length;
  const topPlayers = snapshot.players.slice(0, 3);

  return (
    <Table.Tr>
      <Table.Td>
        <Stack gap={2}>
          <Text>{formatRelativeTime(snapshot.queriedAt)}</Text>
          <Text size="xs" c="dimmed">
            {formatTime(snapshot.queriedAt)}
          </Text>
        </Stack>
      </Table.Td>
      <Table.Td>
        <Text fw={600}>{playerCount}</Text>
        <Text size="xs" c="dimmed">
          Max {formatCount(snapshot.server.maxPlayers)}
        </Text>
      </Table.Td>
      <Table.Td>{snapshot.server.ping != null ? `${snapshot.server.ping} ms` : '—'}</Table.Td>
      <Table.Td>
        {topPlayers.length === 0 ? (
          <Text c="dimmed" size="sm">
            No player names captured.
          </Text>
        ) : (
          <Stack gap={2}>
            {topPlayers.map((player) => (
              <Group key={player.name} gap="xs">
                <Text fw={500}>{player.name}</Text>
                {player.score != null && (
                  <Badge size="xs" color="violet" variant="light">
                    Score {player.score}
                  </Badge>
                )}
              </Group>
            ))}
          </Stack>
        )}
      </Table.Td>
    </Table.Tr>
  );
}

function clampLimit(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(Math.max(Math.round(value), MIN_LIMIT), MAX_LIMIT);
}

function formatCount(value: number | null | undefined): string {
  if (typeof value === 'number') {
    return value.toString();
  }
  return '—';
}

type CurrentPlayersCardProps = {
  snapshot: ServerSnapshot | null;
  status: {
    loading: boolean;
    error: unknown;
  };
};

function CurrentPlayersCard({ snapshot, status }: CurrentPlayersCardProps) {
  type SortColumn = 'player' | 'connectedSince' | 'sessionLength';
  type SortDirection = 'asc' | 'desc';

  const SORT_DEFAULT_DIRECTION: Record<SortColumn, SortDirection> = {
    player: 'asc',
    connectedSince: 'desc',
    sessionLength: 'desc',
  };

  const [sortBy, setSortBy] = useState<SortColumn>('sessionLength');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const sortedPlayers = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    const playersWithMeta = snapshot.players.map((player) => {
      const sessionSeconds = player.time != null ? Math.max(0, Math.floor(player.time)) : null;
      const connectedSince =
        sessionSeconds != null ? snapshot.queriedAt - sessionSeconds * 1000 : null;

      return {
        player,
        sessionSeconds,
        connectedSince,
      };
    });

    const directionMultiplier = sortDirection === 'asc' ? 1 : -1;
    const numberFallback =
      sortDirection === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;

    return playersWithMeta.slice().sort((a, b) => {
      if (sortBy === 'player') {
        return (
          directionMultiplier *
          a.player.name.localeCompare(b.player.name, undefined, { sensitivity: 'base' })
        );
      }

      if (sortBy === 'sessionLength') {
        const aValue = a.sessionSeconds ?? numberFallback;
        const bValue = b.sessionSeconds ?? numberFallback;
        return directionMultiplier * (aValue - bValue);
      }

      const aValue = a.connectedSince ?? numberFallback;
      const bValue = b.connectedSince ?? numberFallback;
      return directionMultiplier * (aValue - bValue);
    });
  }, [snapshot, sortBy, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDirection(SORT_DEFAULT_DIRECTION[column]);
    }
  };

  const renderSortIndicator = (column: SortColumn) => {
    if (sortBy !== column) {
      return null;
    }
    return (
      <Text component="span" size="xs" c="dimmed">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </Text>
    );
  };

  return (
    <Card withBorder padding="md" shadow="sm">
      <Group justify="space-between" align="center" mb="md">
        <div>
          <Title order={4}>{snapshot?.players?.length || "?"} players online right now</Title>
          {snapshot ? (
            <Text size="sm" c="dimmed">
              Updated {formatRelativeTime(snapshot.queriedAt)} ({formatTime(snapshot.queriedAt)})
            </Text>
          ) : (
            <Text size="sm" c="dimmed">
              Live player list from latest snapshot
            </Text>
          )}
        </div>
        {status.loading && <Loader size="sm" />}
      </Group>

      {status.error ? (
        <Text c="red" fw={600}>
          Failed to load latest snapshot:{' '}
          {status.error instanceof Error ? status.error.message : 'Unknown error'}
        </Text>
      ) : !snapshot ? (
        <Text>No snapshot data yet.</Text>
      ) : snapshot.players.length === 0 ? (
        <Text>No player names reported in the latest snapshot.</Text>
      ) : (
        <ScrollArea>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th
                  aria-sort={
                    sortBy === 'player'
                      ? sortDirection === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                  onClick={() => handleSort('player')}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleSort('player');
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  <Group gap={4}>
                    <span>Player</span>
                    {renderSortIndicator('player')}
                  </Group>
                </Table.Th>
                <Table.Th
                  aria-sort={
                    sortBy === 'connectedSince'
                      ? sortDirection === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                  onClick={() => handleSort('connectedSince')}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleSort('connectedSince');
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  <Group gap={4}>
                    <span>Connected Since</span>
                    {renderSortIndicator('connectedSince')}
                  </Group>
                </Table.Th>
                <Table.Th
                  aria-sort={
                    sortBy === 'sessionLength'
                      ? sortDirection === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                  onClick={() => handleSort('sessionLength')}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleSort('sessionLength');
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  <Group gap={4}>
                    <span>Session Length</span>
                    {renderSortIndicator('sessionLength')}
                  </Group>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sortedPlayers.map(({ player, connectedSince, sessionSeconds }) => (
                <Table.Tr key={`${player.name}-${player.score ?? 'na'}`}>
                  <Table.Td>{player.name}</Table.Td>
                  <Table.Td>
                    {connectedSince != null ? formatTime(connectedSince) : '—'}
                  </Table.Td>
                  <Table.Td>
                    {sessionSeconds != null ? formatDuration(sessionSeconds) : '—'}
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
