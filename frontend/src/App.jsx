import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SpacegridProvider } from './context/SpacegridContext';
import { ToastProvider } from './context/ToastContext';
import { ConsoleLayout } from './layouts/ConsoleLayout';
import { OverviewPage } from './pages/console/OverviewPage';
import { ForecastPage } from './pages/console/ForecastPage';
import { AllocationPage } from './pages/console/AllocationPage';
import { PolicyComparisonPage } from './pages/console/PolicyComparisonPage';
import { ApprovalPage } from './pages/console/ApprovalPage';
import { SimulationPage } from './pages/console/SimulationPage';
import { EventLogPage } from './pages/console/EventLogPage';
import { DashboardPage } from './pages/DashboardPage';
import { LandingPage } from './pages/LandingPage';

export default function App() {
  return (
    <BrowserRouter>
      <SpacegridProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/console" element={<ConsoleLayout />}>
              <Route index element={<OverviewPage />} />
              <Route path="overview" element={<OverviewPage />} />
              <Route path="forecast" element={<ForecastPage />} />
              <Route path="allocation" element={<AllocationPage />} />
              <Route path="comparison" element={<PolicyComparisonPage />} />
              <Route path="approval" element={<ApprovalPage />} />
              <Route path="simulation" element={<SimulationPage />} />
              <Route path="events" element={<EventLogPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </SpacegridProvider>
    </BrowserRouter>
  );
}
