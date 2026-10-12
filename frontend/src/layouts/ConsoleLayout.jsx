import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ConsoleSidebar } from './ConsoleSidebar';
import { ConsoleTopBar } from './ConsoleTopBar';
import { ConsoleUnsafeBanner } from '../components/common/ConsoleUnsafeBanner';
import { EmergencyAlarm } from '../components/common/EmergencyAlarm';
import { ShortcutHelpModal } from '../components/common/ShortcutHelpModal';
import { Scene } from '../scene/Scene';
import { useLunagridState } from '../context/LunagridContext';
import { useToast } from '../context/ToastContext';
import { ManualDraftProvider } from '../context/ManualDraftContext';
import { AlarmProvider } from '../context/AlarmContext';
import { RouteErrorBoundary } from '../components/common/RouteErrorBoundary';

const ROUTE_PRESETS = {
  '/console/overview': 'overview',
  '/console/forecast': 'forecast',
  '/console/allocation': 'allocation',
  '/console/comparison': 'comparison',
  '/console/approval': 'approval',
  '/console/simulation': 'simulation',
  '/console/events': 'events',
};

const ROUTE_OPACITIES = {
  '/console/overview': 0.18,
  '/console/forecast': 0.28,
  '/console/allocation': 0.30,
  '/console/comparison': 0.35,
  '/console/approval': 0.32,
  '/console/simulation': 0.25,
  '/console/events': 0.38,
};

const ConsoleLayoutContent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { state, simulateSolarDrop, reset } = useLunagridState();
  const { showToast } = useToast();
  const [helpOpen, setHelpOpen] = useState(false);

  const cameraPreset = useMemo(() => {
    return ROUTE_PRESETS[location.pathname] || 'overview';
  }, [location.pathname]);

  const overlayOpacity = useMemo(() => {
    return ROUTE_OPACITIES[location.pathname] ?? 0.25;
  }, [location.pathname]);

  // Global Keyboard Navigation & Hotkeys
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Prevent key repeats from spamming actions
      if (e.repeat) return;

      // Ignore when user is typing in form controls
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.isContentEditable);

      if (isInput) return;

      // Escape always closes modal
      if (e.key === 'Escape') {
        if (helpOpen) {
          e.preventDefault();
          setHelpOpen(false);
          return;
        }
      }

      // Help modal toggle '?'
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setHelpOpen((prev) => !prev);
        return;
      }

      // Navigation shortcuts 1–7
      const pageKeyMap = {
        '1': '/console/overview',
        '2': '/console/forecast',
        '3': '/console/allocation',
        '4': '/console/comparison',
        '5': '/console/approval',
        '6': '/console/simulation',
        '7': '/console/events',
      };

      if (pageKeyMap[e.key]) {
        e.preventDefault();
        navigate(pageKeyMap[e.key]);
        return;
      }

      // Quick action: 'd' or 'D' -> Solar Drop
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        showToast({
          message: 'Simulating 70% solar drop (Key D pressed)',
          type: 'warn',
        });
        simulateSolarDrop(0.7);
        return;
      }

      // Quick action: 'r' or 'R' -> Reset
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        showToast({
          message: 'Resetting grid to nominal daylight (Key R pressed)',
          type: 'success',
        });
        reset();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, location.pathname, simulateSolarDrop, reset, showToast, helpOpen]);

  return (
    <div className="relative w-screen h-screen overflow-hidden flex bg-[#030814] text-[#EAF4FF] select-none">
      {/* Full-screen Emergency Flash overlay (active only while UNSAFE and un-dismissed) */}
      <EmergencyAlarm />

      {/* Mounted once behind all console pages with smooth 600ms camera pans */}
      <Scene
        state={state}
        cameraPreset={cameraPreset}
        overlayOpacity={overlayOpacity}
      />

      {/* Persistent Left Navigation Sidebar */}
      <ConsoleSidebar onOpenShortcuts={() => setHelpOpen(true)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative z-10">
        <ConsoleTopBar />
        <ConsoleUnsafeBanner />

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col justify-between">
          <div className="max-w-[1360px] mx-auto w-full flex-1">
            <RouteErrorBoundary routeName="Console View">
              <Outlet />
            </RouteErrorBoundary>
          </div>

          {/* Persistent Footer Requirement */}
          <footer className="mt-8 pt-4 pb-2 border-t border-[rgba(56,189,248,0.14)] text-center font-exo text-[11px] text-[#8CA3C2]/70 shrink-0">
            LUNAGRID AI — Advisory only. Mission operations retain final authority. Software prototype. Shortcut key legend: 1–7 pages, D drop, R reset, ? help.
          </footer>
        </main>
      </div>

      {/* Keyboard Shortcut Help Cheat Sheet Modal */}
      <ShortcutHelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
};

export const ConsoleLayout = () => {
  return (
    <AlarmProvider>
      <ManualDraftProvider>
        <ConsoleLayoutContent />
      </ManualDraftProvider>
    </AlarmProvider>
  );
};

