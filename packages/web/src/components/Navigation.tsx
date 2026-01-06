import { Anchor, Flex, Group, Text, ThemeIcon } from '@mantine/core';
import { IconChartHistogram, IconWorld } from '@tabler/icons-react';
import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Overview' },
  { to: '/notifications', label: 'Notifications' },
];

export function Navigation() {
  return (
    <Flex
      align="center"
      justify="space-between"
      px="md"
      style={{
        height: '100%',
      }}
    >
      <Group gap="xs">
        <ThemeIcon variant="gradient" gradient={{ from: 'cyan', to: 'violet' }}>
          <IconChartHistogram size={18} />
        </ThemeIcon>
        <Text fw={600}>Rust Server Dashboard</Text>
      </Group>

      <Group gap="lg" align="center">
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} style={{ textDecoration: 'none' }} end>
            {({ isActive }) => (
              <Text
                fw={isActive ? 700 : 500}
                c={isActive ? 'var(--mantine-color-blue-3)' : 'inherit'}
              >
                {link.label}
              </Text>
            )}
          </NavLink>
        ))}
        <Anchor
          component="a"
          href="https://rust.facepunch.com/"
          target="_blank"
          rel="noreferrer"
        >
          <Group gap={4}>
            <IconWorld size={16} />
            <Text fw={500}>Rust Official</Text>
          </Group>
        </Anchor>
      </Group>
    </Flex>
  );
}
