import { Badge, Card, Group, ScrollArea, Stack, Table, Text, Title, Tooltip } from '@mantine/core';
import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api.js';
import type { ClientSessionStat, ClientSessionsResponse } from '../types/api.js';
import { formatRelativeTime, formatTime } from '../utils/dates.js';

const REFRESH_INTERVAL = 10_000;

export function ClientSessionsPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['client-sessions'],
    queryFn: () => apiGet<ClientSessionsResponse>('/internal/client-sessions'),
    refetchInterval: REFRESH_INTERVAL,
  });

  const sessions = data?.sessions ?? [];

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <div>
          <Group gap="xs" mb={4}>
            <Title order={2}>Client Sessions</Title>
            <Badge color="gray" variant="light">
              Internal
            </Badge>
          </Group>
          <Text c="dimmed" size="sm">
            Client activity recorded by the node API server. Session counts reflect total API requests per IP.
          </Text>
        </div>
      </Group>

      {isLoading ? null : isError ? (
        <Card withBorder shadow="sm">
          <Text c="red" fw={600}>
            Failed to load client sessions: {error instanceof Error ? error.message : 'Unknown error'}
          </Text>
        </Card>
      ) : (
        <ClientSessionsTable sessions={sessions} />
      )}
    </Stack>
  );
}

type ClientSessionsTableProps = {
  sessions: ClientSessionStat[];
};

function ClientSessionsTable({ sessions }: ClientSessionsTableProps) {
  type SortColumn = 'ip' | 'sessionCount' | 'uniqueRoutes' | 'firstSeen' | 'lastSeen' | 'lastRoute';
  type SortDirection = 'asc' | 'desc';

  const defaultDirections: Record<SortColumn, SortDirection> = {
    ip: 'asc',
    sessionCount: 'desc',
    uniqueRoutes: 'desc',
    firstSeen: 'asc',
    lastSeen: 'desc',
    lastRoute: 'asc',
  };

  const [sortBy, setSortBy] = useState<SortColumn>('lastSeen');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const sortedSessions = useMemo(() => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    return [...sessions].sort((a, b) => {
      switch (sortBy) {
        case 'ip':
          return direction * a.ipAddress.localeCompare(b.ipAddress, undefined, { sensitivity: 'base' });
        case 'sessionCount':
          return direction * (a.sessionCount - b.sessionCount);
        case 'uniqueRoutes':
          return direction * (a.uniqueRoutes - b.uniqueRoutes);
        case 'firstSeen':
          return direction * (a.firstSeenAt - b.firstSeenAt);
        case 'lastSeen':
          return direction * (a.lastSeenAt - b.lastSeenAt);
        case 'lastRoute':
          return direction * (a.lastRoute ?? '').localeCompare(b.lastRoute ?? '', undefined, { sensitivity: 'base' });
        default:
          return 0;
      }
    });
  }, [sessions, sortBy, sortDirection]);

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

  if (sessions.length === 0) {
    return (
      <Card withBorder padding="md" shadow="sm">
        <Text>No client sessions recorded yet.</Text>
      </Card>
    );
  }

  return (
    <Card withBorder padding="md" shadow="sm">
      <Group justify="space-between" mb="md" align="center">
        <div>
          <Title order={4}>Tracked clients</Title>
          <Text c="dimmed" size="sm">
            Sort by activity, session counts, or most recent route to spot hot clients quickly.
          </Text>
        </div>
      </Group>

      <ScrollArea>
        <Table striped highlightOnHover withRowBorders={false}>
          <Table.Thead>
            <Table.Tr>
              <SortableHeader
                label="IP"
                column="ip"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSort={handleSort}
                renderIndicator={renderSortIndicator}
              />
              <SortableHeader
                label="Session count"
                column="sessionCount"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSort={handleSort}
                renderIndicator={renderSortIndicator}
              />
              <SortableHeader
                label="Unique routes"
                column="uniqueRoutes"
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
              <SortableHeader
                label="Last seen"
                column="lastSeen"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSort={handleSort}
                renderIndicator={renderSortIndicator}
              />
              <SortableHeader
                label="Last route"
                column="lastRoute"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSort={handleSort}
                renderIndicator={renderSortIndicator}
              />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sortedSessions.map((session) => (
              <Table.Tr key={session.ipAddress}>
                <Table.Td>{session.ipAddress}</Table.Td>
                <Table.Td>{formatNumber(session.sessionCount)}</Table.Td>
                <Table.Td>{formatNumber(session.uniqueRoutes)}</Table.Td>
                <Table.Td>
                  <Text size="sm">{formatRelativeTime(session.firstSeenAt)}</Text>
                  <Text size="xs" c="dimmed">
                    {formatTime(session.firstSeenAt)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{formatRelativeTime(session.lastSeenAt)}</Text>
                  <Text size="xs" c="dimmed">
                    {formatTime(session.lastSeenAt)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {session.lastUserAgent ? (
                    <Tooltip label={session.lastUserAgent} color="gray" position="top-start">
                      <Text size="sm">{session.lastRoute ?? '—'}</Text>
                    </Tooltip>
                  ) : (
                    <Text size="sm">{session.lastRoute ?? '—'}</Text>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Card>
  );
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString() : '0';
}

type SortableHeaderProps = {
  label: string;
  column: 'ip' | 'sessionCount' | 'uniqueRoutes' | 'firstSeen' | 'lastSeen' | 'lastRoute';
  sortBy: 'ip' | 'sessionCount' | 'uniqueRoutes' | 'firstSeen' | 'lastSeen' | 'lastRoute';
  sortDirection: 'asc' | 'desc';
  onSort: (column: 'ip' | 'sessionCount' | 'uniqueRoutes' | 'firstSeen' | 'lastSeen' | 'lastRoute') => void;
  renderIndicator: (column: 'ip' | 'sessionCount' | 'uniqueRoutes' | 'firstSeen' | 'lastSeen' | 'lastRoute') => ReactNode;
};

function SortableHeader({ label, column, sortBy, sortDirection, onSort, renderIndicator }: SortableHeaderProps) {
  return (
    <Table.Th
      aria-sort={sortBy === column ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
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
