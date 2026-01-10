import { AppShell, Container } from '@mantine/core';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Navigation } from './components/Navigation.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { ServerSessionsPage } from './pages/ServerSessionsPage.js';
import { DatabaseStatsPage } from './pages/DatabaseStatsPage.js';
import { NotificationTestPage } from './pages/NotificationTestPage.js';
import { PlayerNotificationsPage } from './pages/PlayerNotificationsPage.js';
import { InternalIndexPage } from './pages/InternalIndexPage.js';
import { ClientSessionsPage } from './pages/ClientSessionsPage.js';
import { InternalEmailPage } from './pages/InternalEmailPage.js';

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AppShell
        padding="md"
        header={{ height: 60 }}
        styles={{
          main: {
            backgroundColor: 'transparent',
          },
        }}
      >
        <AppShell.Header>
          <Navigation />
        </AppShell.Header>
        <AppShell.Main>
          <Container size="xl">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/notifications" element={<PlayerNotificationsPage />} />
              <Route path="/servers/:type/:host/:port" element={<ServerSessionsPage />} />
              <Route path="/internal" element={<InternalIndexPage />} />
              <Route path="/internal/database-stats" element={<DatabaseStatsPage />} />
              <Route path="/internal/client-sessions" element={<ClientSessionsPage />} />
              <Route path="/internal/notifications" element={<NotificationTestPage />} />
              <Route path="/internal/send-email" element={<InternalEmailPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Container>
        </AppShell.Main>
      </AppShell>
    </BrowserRouter>
  );
}
