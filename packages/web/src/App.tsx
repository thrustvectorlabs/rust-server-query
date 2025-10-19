import { AppShell, Container } from '@mantine/core';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Navigation } from './components/Navigation.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { ServerSnapshotsPage } from './pages/ServerSnapshotsPage.js';

export default function App() {
  return (
    <BrowserRouter>
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
              <Route path="/servers/:type/:host/:port" element={<ServerSnapshotsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Container>
        </AppShell.Main>
      </AppShell>
    </BrowserRouter>
  );
}
