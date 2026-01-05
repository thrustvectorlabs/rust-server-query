import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconBellOff } from '@tabler/icons-react';
import { useMemo } from 'react';
import { usePlayerNotifications } from '../lib/playerNotifications.js';
import { formatRelativeTime, formatTime } from '../utils/dates.js';

export function PlayerNotificationsPage() {
  const { subscriptions, clearAll, toggleSubscription } = usePlayerNotifications();

  const sortedSubscriptions = useMemo(() => {
    return [...subscriptions].sort((a, b) =>
      a.playerName.localeCompare(b.playerName, undefined, { sensitivity: 'base' }),
    );
  }, [subscriptions]);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>Player notifications</Title>
          <Text c="dimmed" size="sm">
            Players you will be notified about when they come online.
          </Text>
        </div>
        <Button
          variant="light"
          color="red"
          onClick={clearAll}
          disabled={subscriptions.length === 0}
        >
          Unsubscribe from all
        </Button>
      </Group>

      {subscriptions.length === 0 ? (
        <Card withBorder shadow="sm">
          <Text>No notification subscriptions yet.</Text>
        </Card>
      ) : (
        <Card withBorder shadow="sm" padding="md">
          <Table striped highlightOnHover withRowBorders={false}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Notify</Table.Th>
                <Table.Th>Player</Table.Th>
                <Table.Th>Steam ID</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sortedSubscriptions.map((player) => (
                <Table.Tr key={player.key}>
                  <Table.Td>
                    <Tooltip label="Stop notifications">
                      <ActionIcon
                        variant="light"
                        color="blue"
                        onClick={() =>
                          toggleSubscription(
                            { playerName: player.playerName, steamId: player.steamId },
                            player.status,
                            player.lastSeenAt,
                          )
                        }
                        aria-label="Disable notifications"
                      >
                        <IconBellOff size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                  <Table.Td>{player.playerName}</Table.Td>
                  <Table.Td>{player.steamId ?? '—'}</Table.Td>
                  <Table.Td>
                    {player.status === 'active' ? (
                      <Badge size="sm" variant="light" color="green">
                        Active
                      </Badge>
                    ) : player.lastSeenAt ? (
                      <Tooltip label={formatTime(player.lastSeenAt)}>
                        <Text size="sm">{formatRelativeTime(player.lastSeenAt)}</Text>
                      </Tooltip>
                    ) : (
                      <Text size="sm" c="dimmed">
                        —
                      </Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}
    </Stack>
  );
}
