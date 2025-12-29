import { Badge, Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { useCallback, useEffect, useMemo, useState } from 'react';

type NotificationStatus = NotificationPermission | 'unsupported';

const STATUS_LABELS: Record<NotificationStatus, string> = {
  granted: 'Allowed',
  denied: 'Blocked',
  default: 'Not requested',
  unsupported: 'Unsupported',
};

const STATUS_COLORS: Record<NotificationStatus, string> = {
  granted: 'green',
  denied: 'red',
  default: 'yellow',
  unsupported: 'gray',
};

export function NotificationTestPage() {
  const isSupported = useMemo(
    () => typeof window !== 'undefined' && 'Notification' in window,
    [],
  );
  const [status, setStatus] = useState<NotificationStatus>('default');
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupported) {
      setStatus('unsupported');
      return;
    }
    setStatus(Notification.permission);
  }, [isSupported]);

  const sendTestNotification = useCallback(async () => {
    if (!isSupported) {
      setStatus('unsupported');
      setLastResult('This browser does not support notifications.');
      return;
    }

    const send = () => {
      new Notification('Rust Server Dashboard', {
        body: 'This is a test browser notification.',
        tag: 'rust-server-dashboard-test',
      });
      setLastResult('Test notification sent.');
    };

    if (Notification.permission === 'granted') {
      setStatus('granted');
      send();
      return;
    }

    if (Notification.permission === 'denied') {
      setStatus('denied');
      setLastResult('Notifications are blocked in this browser.');
      return;
    }

    const permission = await Notification.requestPermission();
    setStatus(permission);
    if (permission === 'granted') {
      send();
    } else if (permission === 'denied') {
      setLastResult('Notifications are blocked in this browser.');
    } else {
      setLastResult('Notification permission was not granted yet.');
    }
  }, [isSupported]);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <div>
          <Group gap="xs" mb={4}>
            <Title order={2}>Notification Test</Title>
            <Badge color="gray" variant="light">
              Internal
            </Badge>
          </Group>
          <Text c="dimmed" size="sm">
            Check whether browser notifications are enabled and send a test notification.
          </Text>
        </div>
      </Group>

      <Card withBorder shadow="sm" padding="md">
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Text fw={600}>Notification permission</Text>
            <Badge color={STATUS_COLORS[status]} variant="light">
              {STATUS_LABELS[status]}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {status === 'granted'
              ? 'Notifications are allowed for this site.'
              : status === 'denied'
                ? 'Notifications are blocked. Update your browser settings to allow them.'
                : status === 'unsupported'
                  ? 'This browser does not support the Notification API.'
                  : 'Permission has not been requested yet.'}
          </Text>
          <Group justify="space-between" align="center">
            <Button onClick={sendTestNotification}>Send test notification</Button>
            {lastResult ? (
              <Text size="sm" c="dimmed">
                {lastResult}
              </Text>
            ) : null}
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
