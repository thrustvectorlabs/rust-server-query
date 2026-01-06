import { Anchor, Badge, Card, Group, SimpleGrid, Stack, Table, Text, Title, Tooltip } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiGet } from '../lib/api.js';
import type { ServersResponse, ServerSummary } from '../types/api.js';
import { formatRelativeTime, formatTime } from '../utils/dates.js';

const REFRESH_INTERVAL = 10_000;

export function DashboardPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['servers'],
    queryFn: () => apiGet<ServersResponse>('/servers'),
    refetchInterval: REFRESH_INTERVAL,
  });

  const servers = data?.servers ?? [];

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>Tracked Servers</Title>
          <Text c="dimmed" size="sm">
            Live overview of servers queried by the Rust tracker. Data auto-refreshes every{' '}
            {Math.round(REFRESH_INTERVAL / 1000)} seconds.
          </Text>
        </div>
      </Group>

      {isLoading ? null : isError ? (
        <Card withBorder shadow="sm">
          <Text c="red" fw={600}>
            Failed to load servers: {error instanceof Error ? error.message : 'Unknown error'}
          </Text>
        </Card>
      ) : servers.length === 0 ? (
        <Card withBorder shadow="sm">
          <Text>No servers recorded yet. Once the backend queries a server, it will appear here.</Text>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 1 }}>
          <Table striped highlightOnHover withRowBorders={false}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Server</Table.Th>
                <Table.Th>Players</Table.Th>
                <Table.Th>Ping</Table.Th>
                <Table.Th>Map</Table.Th>
                <Table.Th>Last Seen</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {servers.map((summary) => (
                <ServerRow key={summaryKey(summary)} summary={summary} />
              ))}
            </Table.Tbody>
          </Table>
        </SimpleGrid>
      )}
    </Stack>
  );
}

function ServerRow({ summary }: { summary: ServerSummary }) {
  const { server, lastSeenAt } = summary;
  const route = `/servers/${server.type}/${server.host}/${server.port}`;

  return (
    <Table.Tr>
      <Table.Td>
        <Stack gap={4}>
          <Anchor component={Link} to={route} fw={600} size="sm">
            {server.name ?? `${server.host}:${server.port}`}
          </Anchor>
          <Group gap="xs">
            <Badge size="xs" variant="light" color="blue">
              {server.type}
            </Badge>
            <Badge size="xs" variant="light">
              {server.host}:{server.port}
            </Badge>
          </Group>
        </Stack>
      </Table.Td>
      <Table.Td>
        <Text>
          {formatCount(server.currentPlayers)} / {formatCount(server.maxPlayers)}
        </Text>
      </Table.Td>
      <Table.Td>{server.ping !== null && server.ping !== undefined ? `${server.ping} ms` : '—'}</Table.Td>
      <Table.Td>{server.map ?? 'Unknown'}</Table.Td>
      <Table.Td>
        <Tooltip label={formatTime(lastSeenAt)}>
          <Text>{formatRelativeTime(lastSeenAt)}</Text>
        </Tooltip>
      </Table.Td>
    </Table.Tr>
  );
}

function summaryKey(summary: ServerSummary): string {
  const { type, host, port } = summary.server;
  return `${type}-${host}-${port}`;
}

function formatCount(value: number | null | undefined): string {
  if (typeof value === 'number') {
    return value.toString();
  }
  return '—';
}
