import { Badge, Button, Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { NavLink } from 'react-router-dom';

const internalPages = [
  {
    to: '/internal/database-stats',
    title: 'Database Statistics',
    description: 'Aggregate metrics for sessions and tracked players.',
  },
  {
    to: '/internal/client-sessions',
    title: 'Client Sessions',
    description: 'View API client activity grouped by IP and route.',
  },
  {
    to: '/internal/notifications',
    title: 'Notification Test',
    description: 'Play notification audio and verify browser support.',
  },
];

export function InternalIndexPage() {
  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <div>
          <Group gap="xs" mb={4}>
            <Title order={2}>Internal Tools</Title>
            <Badge color="gray" variant="light">
              Internal
            </Badge>
          </Group>
          <Text c="dimmed" size="sm">
            Shortcuts to internal-only pages for diagnostics and testing.
          </Text>
        </div>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        {internalPages.map((page) => (
          <Card key={page.to} withBorder shadow="sm" padding="md">
            <Stack gap="xs">
              <div>
                <Title order={4}>{page.title}</Title>
                <Text c="dimmed" size="sm">
                  {page.description}
                </Text>
              </div>
              <Button component={NavLink} to={page.to} variant="light" color="blue">
                Open
              </Button>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
