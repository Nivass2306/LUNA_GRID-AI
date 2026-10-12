import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LunagridProvider } from './context/LunagridContext';
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

import { RouteErrorBoundary } from './components/common/RouteErrorBoundary';

export default function App() {
  return (
    <BrowserRouter>
      <LunagridProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/console" element={<ConsoleLayout />}>
              <Route index element={<RouteErrorBoundary routeName="Overview"><OverviewPage /></RouteErrorBoundary>} />
              <Route path="overview" element={<RouteErrorBoundary routeName="Overview"><OverviewPage /></RouteErrorBoundary>} />
              <Route path="forecast" element={<RouteErrorBoundary routeName="Forecast"><ForecastPage /></RouteErrorBoundary>} />
              <Route path="allocation" element={<RouteErrorBoundary routeName="Allocation"><AllocationPage /></RouteErrorBoundary>} />
              <Route path="comparison" element={<RouteErrorBoundary routeName="Comparison"><PolicyComparisonPage /></RouteErrorBoundary>} />
              <Route path="approval" element={<RouteErrorBoundary routeName="Approval"><ApprovalPage /></RouteErrorBoundary>} />
              <Route path="simulation" element={<RouteErrorBoundary routeName="Simulation"><SimulationPage /></RouteErrorBoundary>} />
              <Route path="events" element={<RouteErrorBoundary routeName="Events"><EventLogPage /></RouteErrorBoundary>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </LunagridProvider>
    </BrowserRouter>
  );
}
