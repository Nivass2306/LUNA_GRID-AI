import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SpacegridProvider } from './context/SpacegridContext';
import { DashboardPage } from './pages/DashboardPage';
import { LandingPage } from './pages/LandingPage';

export default function App() {
  return (
    <BrowserRouter>
      <SpacegridProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/console" element={<DashboardPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SpacegridProvider>
    </BrowserRouter>
  );
}
