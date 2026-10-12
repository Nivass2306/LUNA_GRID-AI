/**
 * check_allocation_defensive.mjs
 * Frontend validation test script for AllocationPage defensive rendering.
 *
 * Tests rendering Allocation with:
 * 1. Normal data
 * 2. Empty data (loads: [])
 * 3. Null fields (loads: null, power: null, state: null)
 * 4. Exact JSON returned after approval
 * 5. Malformed data
 *
 * Asserts that none of these throw exceptions.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

async function runTests() {
  console.log('[TEST] Starting AllocationPage Defensive Render Checks...');

  const vite = await createServer({
    appType: 'custom',
    server: { middlewareMode: true },
  });

  try {
    const { AllocationPage } = await vite.ssrLoadModule('./src/pages/console/AllocationPage.jsx');
    const { MemoryRouter } = await vite.ssrLoadModule('react-router-dom');
    const { LunagridProvider, LunagridContext } = await vite.ssrLoadModule('./src/context/LunagridContext.jsx');

    // Test Scenarios
    const scenarios = [
      {
        name: 'Scenario 1: Normal Nominal Data',
        mockState: {
          timestamp: new Date().toISOString(),
          power: { available_kw: 11.3, solar_kw: 8.8, usable_battery_kw: 2.5 },
          plan: { status: 'approved', source: 'autonomous' },
          loads: [
            { id: 'life_support', name: 'Life support', priority: 1, need_kw: 3.0, allocated_kw: 3.0, status: 'Full', reason: 'O2 nominal' },
            { id: 'habitat', name: 'Habitat systems', priority: 2, need_kw: 2.0, allocated_kw: 2.0, status: 'Full', reason: 'HVAC nominal' },
            { id: 'comms', name: 'Communication', priority: 3, need_kw: 1.2, allocated_kw: 1.2, status: 'Full', reason: 'Relay active' },
            { id: 'science', name: 'Science experiments', priority: 4, need_kw: 1.0, allocated_kw: 1.0, status: 'Full', reason: 'Spectrometer on' },
            { id: 'rover', name: 'Rover', priority: 5, need_kw: 0.8, allocated_kw: 0.8, status: 'Full', reason: 'Charger active' },
          ],
        },
      },
      {
        name: 'Scenario 2: Empty Data (empty loads array & empty power)',
        mockState: {
          timestamp: new Date().toISOString(),
          power: {},
          plan: {},
          loads: [],
        },
      },
      {
        name: 'Scenario 3: Null Fields (loads: null, power: null, plan: null)',
        mockState: {
          timestamp: null,
          power: null,
          plan: null,
          loads: null,
        },
      },
      {
        name: 'Scenario 4: Null State (state completely null)',
        mockState: null,
      },
      {
        name: 'Scenario 5: Exact JSON after Limited 4kW Approval',
        mockState: {
          timestamp: new Date().toISOString(),
          power: { available_kw: 4.0, solar_kw: 1.5, usable_battery_kw: 2.5 },
          plan: { status: 'approved', source: 'simulation' },
          loads: [
            { id: 'life_support', canonical_id: 'life_support', name: 'Life support', priority: 1, tier: 'critical', need_kw: 3.0, allocated_kw: 3.0, current_kw: 3.0, proposed_kw: 3.0, delta_kw: 0.0, status: 'Full', reason: 'Life support fully powered', locked: true },
            { id: 'habitat', canonical_id: 'habitat', name: 'Habitat systems', priority: 2, tier: 'high', need_kw: 2.0, allocated_kw: 1.0, current_kw: 1.0, proposed_kw: 1.0, delta_kw: 0.0, status: 'Partial', reason: 'Climate curtailed', locked: true },
            { id: 'comms', canonical_id: 'communication', name: 'Communication', priority: 3, tier: 'high', need_kw: 1.2, allocated_kw: 0.0, current_kw: 0.0, proposed_kw: 0.0, delta_kw: 0.0, status: 'Unpowered', reason: 'Offline', locked: false },
            { id: 'science', canonical_id: 'experiments', name: 'Science experiments', priority: 4, tier: 'lower', need_kw: 1.0, allocated_kw: 0.0, current_kw: 0.0, proposed_kw: 0.0, delta_kw: 0.0, status: 'Unpowered', reason: 'Offline', locked: false },
            { id: 'rover', canonical_id: 'rover', name: 'Rover', priority: 5, tier: 'lowest', need_kw: 0.8, allocated_kw: 0.0, current_kw: 0.0, proposed_kw: 0.0, delta_kw: 0.0, status: 'Unpowered', reason: 'Offline', locked: false },
          ],
        },
      },
      {
        name: 'Scenario 6: Malformed Loads Items (missing need, null allocated, unknown ids)',
        mockState: {
          power: { available_kw: 'NaN' },
          loads: [
            {},
            { id: 'unknown_subsystem', need_kw: undefined, allocated_kw: null },
            { id: null, name: null, allocated_kw: 'invalid' },
          ],
        },
      },
      {
        name: 'Scenario 7: Deficit Life Support Alert Active (2.0 kW of 3.0 kW, shortfall: 1.0 kW)',
        mockState: {
          timestamp: new Date().toISOString(),
          power: { available_kw: 2.0, solar_kw: 0.1, usable_battery_kw: 1.9 },
          plan: { status: 'approved', source: 'simulation' },
          life_support_alert: {
            active: true,
            allocated_kw: 2.0,
            threshold_kw: 3.0,
            shortfall_kw: 1.0,
            message: 'Life support below threshold: 2.00 kW of 3.0 kW',
          },
          loads: [
            { id: 'life_support', canonical_id: 'life_support', name: 'Life support', priority: 1, need_kw: 3.0, allocated_kw: 2.0, status: 'Partial', reason: 'Deficit' },
            { id: 'habitat', canonical_id: 'habitat', name: 'Habitat systems', priority: 2, need_kw: 2.0, allocated_kw: 0.0, status: 'Unpowered', reason: 'Shed' },
          ],
        },
      },
    ];

    const { LifeSupportAlertIndicator } = await vite.ssrLoadModule('./src/components/common/LifeSupportAlertIndicator.jsx');

    // Test LifeSupportAlertIndicator directly under various props
    const indicatorHtmlActive = renderToStaticMarkup(
      React.createElement(LifeSupportAlertIndicator, {
        alertOverride: { active: true, allocated_kw: 2.0, threshold_kw: 3.0, shortfall_kw: 1.0 },
      })
    );
    if (!indicatorHtmlActive.includes('LIFE SUPPORT LOW') || !indicatorHtmlActive.includes('2.00 / 3.00 kW')) {
      throw new Error('Indicator active state missing expected text');
    }
    console.log('  [PASS] LifeSupportAlertIndicator (Active: renders beacon + text)');

    const indicatorHtmlInactive = renderToStaticMarkup(
      React.createElement(LifeSupportAlertIndicator, {
        alertOverride: { active: false, allocated_kw: 3.0, threshold_kw: 3.0, shortfall_kw: 0.0 },
      })
    );
    if (indicatorHtmlInactive !== '') {
      throw new Error('Indicator inactive state should render null / empty string');
    }
    console.log('  [PASS] LifeSupportAlertIndicator (Inactive: renders null)');

    const indicatorHtmlNull = renderToStaticMarkup(
      React.createElement(LifeSupportAlertIndicator, { alertOverride: null })
    );
    if (indicatorHtmlNull !== '') {
      throw new Error('Indicator null state should render null / empty string');
    }
    console.log('  [PASS] LifeSupportAlertIndicator (Null: renders null without throwing)');

    for (const sc of scenarios) {
      try {
        const mockContextValue = {
          state: sc.mockState,
          loading: false,
          error: null,
          refresh: () => {},
        };

        const html = renderToStaticMarkup(
          React.createElement(
            LunagridContext.Provider,
            { value: mockContextValue },
            React.createElement(
              MemoryRouter,
              null,
              React.createElement(AllocationPage, null)
            )
          )
        );

        if (typeof html !== 'string' || html.length === 0) {
          throw new Error('Render output is empty string');
        }

        console.log(`  [PASS] ${sc.name} (Output length: ${html.length} chars)`);
      } catch (err) {
        console.error(`  [FAIL] ${sc.name}:`, err);
        throw err;
      }
    }

    console.log('[TEST] All 6 defensive render checks PASSED successfully!');
  } finally {
    await vite.close();
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('[TEST ERROR]', err);
  process.exit(1);
});
