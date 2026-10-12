import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FlaskConical,
  SunMedium,
  RotateCcw,
  Play,
  Clock,
  Cpu,
  Layers,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Database,
  Download,
  CheckCircle2,
  FileSpreadsheet,
  Shuffle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Activity,
  Eye,
  AlertCircle,
  SlidersHorizontal,
  ArrowUpDown,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { useLunagridState } from '../../context/LunagridContext';
import { useToast } from '../../context/ToastContext';
import {
  getDatasetInfo,
  getDatasetRandom,
  getDatasetByIndex,
  runAllDataset,
  getDatasetResults,
  getDatasetSamples,
} from '../../lib/api';

export const SimulationPage = () => {
  const navigate = useNavigate();
  const {
    state,
    simulateSolarDrop,
    simulateBlackout,
    simulateCustom,
    simulatePreset,
    reset,
    replanning,
  } = useLunagridState();
  const { showToast } = useToast();
  const resultCardRef = useRef(null);

  const power = state?.power || {};
  const survival = state?.survival || {};
  const replanMs = state?.replan_ms ?? null;

  // Active Sandbox Tab: 'manual' | 'dataset'
  const [activeTab, setActiveTab] = useState('manual');

  // Custom scenario input states
  const [customSolarDrop, setCustomSolarDrop] = useState('');
  const [customDust, setCustomDust] = useState('');
  const [customBattery, setCustomBattery] = useState('');
  const [customError, setCustomError] = useState(null);
  const [submittingCustom, setSubmittingCustom] = useState(false);

  // Dataset states (10,000 scenarios)
  const [datasetInfo, setDatasetInfo] = useState({ name: 'simulation_scenarios_10000.csv', total_rows: 10000, categories: [] });
  const [selectedCategory, setSelectedCategory] = useState('');
  const [currentScenarioIndex, setCurrentScenarioIndex] = useState(null);
  const [currentScenario, setCurrentScenario] = useState(null);
  const [loadingScenario, setLoadingScenario] = useState(false);
  const [calculatingAll, setCalculatingAll] = useState(false);
  const [calculateAllResult, setCalculateAllResult] = useState(null);
  const [datasetError, setDatasetError] = useState(null);

  // Results table browsing & filtering states
  const [resultsLevel, setResultsLevel] = useState('shortage');
  const [resultsSort, setResultsSort] = useState('random');
  const [resultsPage, setResultsPage] = useState(1);
  const [resultsData, setResultsData] = useState(null);
  const [loadingResults, setLoadingResults] = useState(false);

  // Representative samples drawer state
  const [samplesData, setSamplesData] = useState(null);
  const [loadingSamples, setLoadingSamples] = useState(false);
  const [showSamplesDrawer, setShowSamplesDrawer] = useState(false);

  // Load dataset info on mount
  useEffect(() => {
    let isMounted = true;
    async function loadInfo() {
      try {
        const info = await getDatasetInfo();
        if (isMounted && info) {
          setDatasetInfo(info);
        }
      } catch (err) {
        console.error('Failed to load dataset info:', err);
      }
    }
    loadInfo();
    return () => {
      isMounted = false;
    };
  }, []);

  const currentSolar = power.solar_kw !== null && power.solar_kw !== undefined ? Number(power.solar_kw) : null;
  const currentAvailable = power.available_kw !== null && power.available_kw !== undefined ? Number(power.available_kw) : null;
  const backendStorageDrain = power.storage_drain_kw !== null && power.storage_drain_kw !== undefined
    ? Number(power.storage_drain_kw)
    : (state?.storage_drain_kw !== null && state?.storage_drain_kw !== undefined
        ? Number(state.storage_drain_kw)
        : null);

  // Live preview calculation according to rule:
  // solar_kw = 10.0 * (1 - dust) * (1 - solar_drop_pct/100)
  // Empty dust = 0. Empty battery = keep current charge.
  const previewDrop = customSolarDrop !== '' ? parseFloat(customSolarDrop) : 0;
  const previewDust = customDust !== '' ? parseFloat(customDust) : 0;
  const currentSoc = state?.battery?.soc_kwh ?? 16.5;
  const previewSoc = customBattery !== '' ? parseFloat(customBattery) : currentSoc;

  const validDrop = !isNaN(previewDrop) ? Math.min(Math.max(previewDrop, 0), 100) : 0;
  const validDust = !isNaN(previewDust) ? Math.min(Math.max(previewDust, 0), 1) : 0;
  const validSoc = !isNaN(previewSoc) ? Math.min(Math.max(previewSoc, 0), 20) : 16.5;

  const previewSolar = Math.max(0, 10.0 * (1.0 - validDust) * (1.0 - validDrop / 100.0));
  const previewUsableBatt = Math.min(Math.max(validSoc - 3.0, 0), 2.5);
  const previewAvailable = previewSolar + previewUsableBatt;

  let previewVerdict = 'SAFE';
  let previewVerdictColor = 'text-[#22E58B] border-[#22E58B]/40 bg-[rgba(34,229,139,0.15)]';
  let previewVerdictDesc = 'All habitat loads powered';

  if (previewAvailable < 3.0 - 0.001) {
    previewVerdict = 'UNSAFE';
    previewVerdictColor = 'text-[#FF3B4E] border-[#FF3B4E]/40 bg-[rgba(255,59,78,0.18)]';
    previewVerdictDesc = 'Life support cannot be met';
  } else if (previewAvailable < 8.0 - 0.001) {
    previewVerdict = 'SHORTAGE';
    previewVerdictColor = 'text-[#FFC233] border-[#FFC233]/40 bg-[rgba(255,194,51,0.18)]';
    previewVerdictDesc = 'Life support OK, lower loads cut';
  }

  const PRESET_CHIPS = [
    { label: 'Normal day', drop: '0', dust: '0.12', battery: '16.5' },
    { label: 'Drop 70%', drop: '70', dust: '0', battery: '8.5' },
    { label: 'Dust storm', drop: '0', dust: '0.9', battery: '8.5' },
    { label: 'Low battery', drop: '0', dust: '0.12', battery: '3' },
    { label: 'Blackout', drop: '100', dust: '0.99', battery: '3' },
  ];

  const handleRunSolarDrop = async () => {
    try {
      showToast({
        message: 'Simulating 70% solar drop event...',
        type: 'warn',
      });
      await simulateSolarDrop();
      showToast({
        message: 'Solar obscuration applied. Optimizer formulated emergency plan.',
        type: 'warn',
      });
    } catch {
      showToast({
        message: 'Failed to trigger solar drop. Check backend service.',
        type: 'danger',
      });
    }
  };

  const handleRunBlackout = async () => {
    try {
      showToast({
        message: 'Simulating severe blackout scenario...',
        type: 'danger',
      });
      await simulateBlackout();
      showToast({
        message: 'Blackout triggered: Life support underpowered, red alert active.',
        type: 'danger',
      });
    } catch {
      showToast({
        message: 'Failed to trigger blackout. Check backend service.',
        type: 'danger',
      });
    }
  };

  const handleReset = async () => {
    try {
      await reset();
      showToast({
        message: 'Grid restored to nominal baseline daylight conditions.',
        type: 'success',
      });
    } catch {
      showToast({
        message: 'Failed to reset simulator.',
        type: 'danger',
      });
    }
  };

  const handleRunCustom = async (e) => {
    e.preventDefault();
    setCustomError(null);
    setSubmittingCustom(true);

    try {
      const payload = {
        solar_drop_pct: parseFloat(customSolarDrop),
      };
      if (customDust !== '') {
        payload.dust_factor = parseFloat(customDust);
      }
      if (customBattery !== '') {
        payload.battery_soc_kwh = parseFloat(customBattery);
      }

      await simulateCustom(payload);
      showToast({
        message: `Custom scenario applied: -${payload.solar_drop_pct}% solar drop.`,
        type: 'warn',
      });
    } catch (err) {
      // Inline HTTP 422 validation message from backend
      if (err.status === 422) {
        let msg = 'Validation error: Invalid input parameters';
        if (err.detail) {
          if (typeof err.detail === 'string') {
            msg = err.detail;
          } else if (Array.isArray(err.detail)) {
            msg = err.detail.map((d) => d.msg || JSON.stringify(d)).join('; ');
          }
        }
        setCustomError(msg);
      } else {
        setCustomError(err.message || 'Failed to simulate custom scenario');
      }
    } finally {
      setSubmittingCustom(false);
    }
  };

  // Reuses the exact same manual-simulation function (simulateCustom)
  const applyScenarioToEngine = async (scenario, index) => {
    setDatasetError(null);
    setLoadingScenario(true);
    try {
      const payload = {
        solar_drop_pct: Number(scenario.solar_loss_pct ?? scenario.loss ?? 0),
        dust_factor: Number(scenario.dust_factor ?? scenario.dust ?? 0),
        battery_soc_kwh: Number(scenario.battery_soc_kwh ?? scenario.battery ?? 16.5),
      };
      await simulateCustom(payload);
      const targetIdx = index !== undefined && index !== null ? Number(index) : Number(scenario.index ?? 0);
      setCurrentScenarioIndex(targetIdx);
      setCurrentScenario({
        ...scenario,
        solar_loss_pct: payload.solar_drop_pct,
        dust_factor: payload.dust_factor,
        battery_soc_kwh: payload.battery_soc_kwh,
      });
      showToast({
        message: `Evaluated ${scenario.scenario_id}: ${scenario.name}`,
        type: 'info',
      });
      if (resultCardRef.current) {
        const isReduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        resultCardRef.current.scrollIntoView({
          behavior: isReduced ? 'auto' : 'smooth',
          block: 'nearest',
        });
      }
    } catch (err) {
      setDatasetError(err.message || 'Failed to evaluate scenario');
    } finally {
      setLoadingScenario(false);
    }
  };

  const handleRandomScenario = async () => {
    setDatasetError(null);
    setLoadingScenario(true);
    try {
      const res = await getDatasetRandom(selectedCategory || null);
      if (res && res.scenario) {
        await applyScenarioToEngine(res.scenario, res.index);
      }
    } catch (err) {
      setDatasetError(err.message || 'Failed to fetch random scenario');
      setLoadingScenario(false);
    }
  };

  const handlePreviousScenario = async () => {
    const targetIdx = currentScenarioIndex !== null ? currentScenarioIndex - 1 : 0;
    if (targetIdx < 0) return;
    setDatasetError(null);
    setLoadingScenario(true);
    try {
      const res = await getDatasetByIndex(targetIdx);
      if (res && res.scenario) {
        await applyScenarioToEngine(res.scenario, res.index);
      }
    } catch (err) {
      setDatasetError(err.message || 'Failed to fetch previous scenario');
      setLoadingScenario(false);
    }
  };

  const handleNextScenario = async () => {
    const total = datasetInfo?.total_rows || 10000;
    const targetIdx = currentScenarioIndex !== null ? currentScenarioIndex + 1 : 0;
    if (targetIdx >= total) return;
    setDatasetError(null);
    setLoadingScenario(true);
    try {
      const res = await getDatasetByIndex(targetIdx);
      if (res && res.scenario) {
        await applyScenarioToEngine(res.scenario, res.index);
      }
    } catch (err) {
      setDatasetError(err.message || 'Failed to fetch next scenario');
      setLoadingScenario(false);
    }
  };

  const fetchFilteredResults = async (level = resultsLevel, sort = resultsSort, page = resultsPage) => {
    setLoadingResults(true);
    setDatasetError(null);
    try {
      const res = await getDatasetResults({ level, sort, page, page_size: 10 });
      setResultsData(res);
    } catch (err) {
      setDatasetError(err.message || 'Failed to fetch dataset results');
    } finally {
      setLoadingResults(false);
    }
  };

  const handleSelectLevel = async (newLevel) => {
    setResultsLevel(newLevel);
    setResultsPage(1);
    await fetchFilteredResults(newLevel, resultsSort, 1);
  };

  const handleSelectSort = async (newSort) => {
    setResultsSort(newSort);
    setResultsPage(1);
    await fetchFilteredResults(resultsLevel, newSort, 1);
  };

  const handlePageChange = async (newPage) => {
    if (newPage < 1 || (resultsData && newPage > resultsData.total_pages)) return;
    setResultsPage(newPage);
    await fetchFilteredResults(resultsLevel, resultsSort, newPage);
  };

  const handleShowOneOfEach = async () => {
    setLoadingSamples(true);
    setDatasetError(null);
    try {
      const res = await getDatasetSamples();
      const samplesMap = res.samples || res;
      setSamplesData(samplesMap);
      setShowSamplesDrawer(true);
      showToast({
        message: 'Loaded representative scenarios for all 4 alert levels.',
        type: 'info',
      });
    } catch (err) {
      setDatasetError(err.message || 'Failed to load representative samples');
    } finally {
      setLoadingSamples(false);
    }
  };

  const handleCalculateAll = async () => {
    setDatasetError(null);
    setCalculatingAll(true);
    try {
      const res = await runAllDataset();
      setCalculateAllResult(res);
      // Default view when summary first appears: "Shortage" with Random sort
      setResultsLevel('shortage');
      setResultsSort('random');
      setResultsPage(1);
      const initialResults = await getDatasetResults({
        level: 'shortage',
        sort: 'random',
        page: 1,
        page_size: 10,
      });
      setResultsData(initialResults);
      showToast({
        message: `Calculated all ${res.summary?.total_scenarios?.toLocaleString()} scenarios in ${res.summary?.computation_time_ms} ms.`,
        type: 'success',
      });
    } catch (err) {
      setDatasetError(err.message || 'Failed to calculate all scenarios');
    } finally {
      setCalculatingAll(false);
    }
  };

  const handleSelectWorstScenario = async (row) => {
    await applyScenarioToEngine(row, row.index);
  };

  const handleDownloadWorstCsv = () => {
    if (!calculateAllResult || !calculateAllResult.worst_scenarios) return;
    const headers = [
      'rank',
      'scenario_id',
      'name',
      'category',
      'solar_loss_pct',
      'dust_factor',
      'battery_soc_kwh',
      'solar_kw',
      'usable_battery_kw',
      'available_kw',
      'alert_level',
      'life_support_ok',
      'survival_hours',
      'description',
    ];
    const csvRows = [headers.join(',')];
    for (const r of calculateAllResult.worst_scenarios) {
      const rowValues = [
        r.rank,
        r.scenario_id,
        `"${(r.name || '').replace(/"/g, '""')}"`,
        `"${(r.category || '').replace(/"/g, '""')}"`,
        r.solar_loss_pct,
        r.dust_factor,
        r.battery_soc_kwh,
        r.solar_kw,
        r.usable_battery_kw,
        r.available_kw,
        r.alert_level,
        r.life_support_ok,
        r.survival_hours !== null && r.survival_hours !== undefined ? r.survival_hours : '',
        `"${(r.description || '').replace(/"/g, '""')}"`,
      ];
      csvRows.push(rowValues.join(','));
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'worst_10_scenarios.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP CONTINGENCY SANDBOX CONTROLS */}
      <div className="console-panel p-6 space-y-5 border-l-4 border-l-[#22D3EE]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-[rgba(56,189,248,0.2)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(34,211,238,0.15)] border border-[rgba(34,211,238,0.4)] flex items-center justify-center text-[#22D3EE] shrink-0">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-orbitron font-bold text-base text-[#EAF4FF] tracking-wide">
                CONTINGENCY & ORBITAL DISRUPTION SANDBOX
              </h2>
              <p className="font-exo text-xs text-[#8CA3C2]">
                Stress-test microgrid stability across arbitrary solar degradation profiles, blackout crises, and batch datasets
              </p>
            </div>
          </div>

          {/* Action buttons: Solar Drop, Blackout, Reset */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Solar Drop Button */}
            <button
              onClick={handleRunSolarDrop}
              disabled={replanning}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-exo font-semibold text-[#FFC233] bg-[rgba(255,194,51,0.15)] border border-[rgba(255,194,51,0.45)] hover:bg-[rgba(255,194,51,0.25)] transition-colors active:scale-95 disabled:opacity-50"
            >
              <SunMedium className="w-3.5 h-3.5" />
              <span>Solar Drop (70%)</span>
            </button>

            {/* Blackout Button */}
            <button
              onClick={handleRunBlackout}
              disabled={replanning}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-exo font-semibold text-[#FF3B4E] bg-[rgba(255,59,78,0.18)] border border-[rgba(255,59,78,0.5)] hover:bg-[rgba(255,59,78,0.28)] transition-colors active:scale-95 disabled:opacity-50 shadow-[0_0_12px_rgba(255,59,78,0.25)]"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Blackout Crisis</span>
            </button>

            {/* Reset Grid Button */}
            <button
              onClick={handleReset}
              disabled={replanning}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-exo font-semibold text-[#22E58B] bg-[rgba(34,229,139,0.15)] border border-[rgba(34,229,139,0.45)] hover:bg-[rgba(34,229,139,0.25)] transition-colors active:scale-95 disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Grid (R)</span>
            </button>
          </div>
        </div>

        {/* 9. TWO TABS AT THE TOP OF SCENARIO AREA */}
        <div className="flex items-center gap-2 border-b border-[rgba(56,189,248,0.2)] pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`px-4 py-2 rounded-xl text-xs font-orbitron font-bold uppercase tracking-wider transition-all ${
              activeTab === 'manual'
                ? 'bg-[rgba(34,211,238,0.2)] text-[#22D3EE] border border-[#22D3EE]/50 shadow-[0_0_12px_rgba(34,211,238,0.2)]'
                : 'text-[#8CA3C2] hover:text-[#EAF4FF] hover:bg-white/5 border border-transparent'
            }`}
          >
            Manual
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dataset')}
            className={`px-4 py-2 rounded-xl text-xs font-orbitron font-bold uppercase tracking-wider transition-all ${
              activeTab === 'dataset'
                ? 'bg-[rgba(34,211,238,0.2)] text-[#22D3EE] border border-[#22D3EE]/50 shadow-[0_0_12px_rgba(34,211,238,0.2)]'
                : 'text-[#8CA3C2] hover:text-[#EAF4FF] hover:bg-white/5 border border-transparent'
            }`}
          >
            Dataset
          </button>
        </div>

        {/* MANUAL TAB: CUSTOM SCENARIO FORM */}
        {activeTab === 'manual' && (
          <div className="p-4 rounded-xl bg-black/30 border border-[rgba(56,189,248,0.18)] space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-orbitron font-bold text-xs uppercase tracking-wider text-[#22D3EE] flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#22D3EE]" />
                Manual Disruption Form (POST /simulate/custom)
              </span>
              <span className="font-mono text-[11px] text-[#8CA3C2]">
                Demand 8.0 kW | Life Support 3.0 kW
              </span>
            </div>

            <form onSubmit={handleRunCustom} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Solar loss % */}
                <div className="space-y-1">
                  <label className="block font-exo text-[11px] text-[#EAF4FF] font-semibold">
                    Solar loss % <span className="text-[#FF3B4E]">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={customSolarDrop}
                    onChange={(e) => {
                      setCustomSolarDrop(e.target.value);
                      setCustomError(null);
                    }}
                    placeholder="0 to 100"
                    required
                    className="w-full px-3 py-2 rounded-lg bg-[rgba(7,18,40,0.85)] border border-[rgba(56,189,248,0.32)] text-[#EAF4FF] text-xs font-mono focus:outline-none focus:border-[#22D3EE]"
                  />
                  <p className="font-exo text-[10px] text-[#8CA3C2]">
                    0 to 100, how much solar is lost
                  </p>
                </div>

                {/* Dust on panels */}
                <div className="space-y-1">
                  <label className="block font-exo text-[11px] text-[#EAF4FF] font-semibold">
                    Dust on panels
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={customDust}
                    onChange={(e) => {
                      setCustomDust(e.target.value);
                      setCustomError(null);
                    }}
                    placeholder="0 to 1, empty = clean"
                    className="w-full px-3 py-2 rounded-lg bg-[rgba(7,18,40,0.85)] border border-[rgba(56,189,248,0.32)] text-[#EAF4FF] text-xs font-mono focus:outline-none focus:border-[#22D3EE]"
                  />
                  <p className="font-exo text-[10px] text-[#8CA3C2]">
                    0 to 1, empty = clean
                  </p>
                </div>

                {/* Battery charge in kWh */}
                <div className="space-y-1">
                  <label className="block font-exo text-[11px] text-[#EAF4FF] font-semibold">
                    Battery charge in kWh
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={customBattery}
                    onChange={(e) => {
                      setCustomBattery(e.target.value);
                      setCustomError(null);
                    }}
                    placeholder="0 to 20, 3 is the protected reserve"
                    className="w-full px-3 py-2 rounded-lg bg-[rgba(7,18,40,0.85)] border border-[rgba(56,189,248,0.32)] text-[#EAF4FF] text-xs font-mono focus:outline-none focus:border-[#22D3EE]"
                  />
                  <p className="font-exo text-[10px] text-[#8CA3C2]">
                    0 to 20, 3 is the protected reserve
                  </p>
                </div>
              </div>

              {/* PRESET CHIPS */}
              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                <span className="font-exo text-[11px] text-[#8CA3C2] font-semibold">Presets:</span>
                {PRESET_CHIPS.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => {
                      setCustomSolarDrop(chip.drop);
                      setCustomDust(chip.dust);
                      setCustomBattery(chip.battery);
                      setCustomError(null);
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-exo font-medium text-[#22D3EE] bg-[rgba(34,211,238,0.1)] border border-[rgba(34,211,238,0.3)] hover:bg-[rgba(34,211,238,0.22)] hover:border-[#22D3EE] transition-all active:scale-95"
                  >
                    {chip.label} ({chip.drop} / {chip.dust} / {chip.battery})
                  </button>
                ))}
              </div>

              {/* LIVE PREVIEW BOX */}
              <div className="p-3.5 rounded-xl bg-black/40 border border-[rgba(56,189,248,0.25)] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-orbitron font-bold text-xs uppercase tracking-wider text-[#EAF4FF] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#22D3EE]" />
                    LIVE PREVIEW (updates as you type)
                  </span>
                  <span className={`px-2.5 py-0.5 rounded text-xs font-orbitron font-bold border ${previewVerdictColor}`}>
                    {previewVerdict}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
                  <div className="p-2 rounded-lg bg-black/50 border border-white/5">
                    <span className="text-[#8CA3C2] font-exo text-[10px] block">Solar</span>
                    <span className="font-bold text-[#EAF4FF]">{previewSolar.toFixed(1)} kW</span>
                  </div>
                  <div className="p-2 rounded-lg bg-black/50 border border-white/5">
                    <span className="text-[#8CA3C2] font-exo text-[10px] block">Usable Battery</span>
                    <span className="font-bold text-[#EAF4FF]">{previewUsableBatt.toFixed(1)} kW</span>
                  </div>
                  <div className="p-2 rounded-lg bg-black/50 border border-white/5">
                    <span className="text-[#8CA3C2] font-exo text-[10px] block">Available Power</span>
                    <span className="font-bold text-[#22D3EE]">{previewAvailable.toFixed(1)} kW</span>
                  </div>
                  <div className="p-2 rounded-lg bg-black/50 border border-white/5">
                    <span className="text-[#8CA3C2] font-exo text-[10px] block">Demand</span>
                    <span className="font-bold text-[#8CA3C2]">8.0 kW</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-exo text-[#8CA3C2] pt-0.5">
                  <span>Rule: <code className="text-[#22D3EE]">solar + usable battery vs demand 8.0 kW (Life Support 3.0 kW)</code></span>
                  <span className="font-semibold text-[#EAF4FF]">{previewVerdictDesc}</span>
                </div>
              </div>

              {/* Inline HTTP 422 / Validation Error Message */}
              {customError && (
                <div className="p-2.5 rounded-lg bg-[rgba(255,59,78,0.18)] border border-[#FF3B4E]/60 text-[#FF3B4E] text-xs font-mono flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#FF3B4E]" />
                  <div className="flex-1">
                    <span className="font-bold">Backend Validation Error: </span>
                    <span>{customError}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={replanning || submittingCustom}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#22D3EE] to-[#0284C7] text-slate-950 font-orbitron font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:brightness-110 active:scale-95 disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-slate-950" />
                  <span>{submittingCustom ? 'Evaluating...' : 'Simulate Custom Scenario'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* DATASET TAB: BUILT-IN 10,000 SCENARIO EVALUATION */}
        {activeTab === 'dataset' && (
          <div className="p-4 rounded-xl bg-black/30 border border-[rgba(56,189,248,0.18)] space-y-4">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div>
                <span className="font-orbitron font-bold text-xs uppercase tracking-wider text-[#22D3EE] flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-[#22D3EE]" />
                  Built-in dataset: {datasetInfo?.total_rows ? datasetInfo.total_rows.toLocaleString() : '10,000'} scenarios
                </span>
                <p className="font-exo text-[11px] text-[#8CA3C2] mt-0.5">
                  High-fidelity lunar microgrid contingency scenarios across all operational degradation regimes
                </p>
              </div>

              {/* Navigation & Actions toolbar */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Random Scenario Button (Primary) */}
                <button
                  type="button"
                  onClick={handleRandomScenario}
                  disabled={loadingScenario || calculatingAll}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-orbitron font-bold uppercase tracking-wider text-slate-950 bg-gradient-to-r from-[#22D3EE] to-[#0284C7] shadow-[0_0_12px_rgba(34,211,238,0.25)] hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                  title="Load and evaluate a random scenario from the dataset"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  <span>Random scenario</span>
                </button>

                {/* Previous Button */}
                <button
                  type="button"
                  onClick={handlePreviousScenario}
                  disabled={loadingScenario || calculatingAll || currentScenarioIndex === null || currentScenarioIndex <= 0}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-exo font-semibold text-[#EAF4FF] bg-white/10 border border-white/20 hover:bg-white/15 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Load previous scenario"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                {/* Next Button */}
                <button
                  type="button"
                  onClick={handleNextScenario}
                  disabled={loadingScenario || calculatingAll || currentScenarioIndex === null || currentScenarioIndex >= (datasetInfo?.total_rows || 10000) - 1}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-exo font-semibold text-[#EAF4FF] bg-white/10 border border-white/20 hover:bg-white/15 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Load next scenario"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                {/* Category filter */}
                <div className="flex items-center gap-1.5 bg-black/40 border border-[rgba(56,189,248,0.25)] rounded-lg px-2 py-1 text-xs font-exo">
                  <Filter className="w-3 h-3 text-[#22D3EE]" />
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="bg-transparent text-[#EAF4FF] text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="" className="bg-slate-900 text-[#EAF4FF]">All Categories</option>
                    {(datasetInfo?.categories || []).map((cat) => (
                      <option key={cat} value={cat} className="bg-slate-900 text-[#EAF4FF]">
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Calculate All (Secondary Action) */}
                <button
                  type="button"
                  onClick={handleCalculateAll}
                  disabled={calculatingAll || loadingScenario}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-orbitron font-semibold uppercase tracking-wider text-[#22D3EE] bg-[rgba(34,211,238,0.12)] border border-[rgba(34,211,238,0.35)] hover:bg-[rgba(34,211,238,0.22)] transition-all active:scale-95 disabled:opacity-50"
                  title="Batch evaluate all scenarios in chunks of 500"
                >
                  <Play className="w-3.5 h-3.5 fill-[#22D3EE]" />
                  <span>{calculatingAll ? 'Calculating all...' : 'Calculate All'}</span>
                </button>
              </div>
            </div>

            {/* Error banner */}
            {datasetError && (
              <div className="p-3 rounded-lg bg-[rgba(255,59,78,0.18)] border border-[#FF3B4E]/60 text-[#FF3B4E] text-xs font-mono flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#FF3B4E]" />
                <div className="flex-1">
                  <span className="font-bold">Error: </span>
                  <span>{datasetError}</span>
                </div>
              </div>
            )}

            {/* Scenario Tracker Banner (When a scenario is active) */}
            {currentScenario && currentScenarioIndex !== null && (
              <div className="p-3.5 rounded-xl bg-black/40 border border-[rgba(56,189,248,0.25)] space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-orbitron font-bold text-xs text-[#22D3EE]">
                      Scenario {(currentScenarioIndex + 1).toLocaleString()} of {(datasetInfo?.total_rows || 10000).toLocaleString()}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold text-[#EAF4FF] bg-white/10 border border-white/15">
                      {currentScenario.scenario_id}
                    </span>
                    <span className="font-exo font-semibold text-xs text-[#EAF4FF]">
                      {currentScenario.name}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-exo font-medium text-[#FFC233] bg-[rgba(255,194,51,0.12)] border border-[#FFC233]/30">
                      {currentScenario.category}
                    </span>
                  </div>
                  {currentScenario.description && (
                    <span className="font-exo text-[11px] text-[#8CA3C2] italic">
                      {currentScenario.description}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-1 text-xs font-mono flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-[rgba(7,18,40,0.8)] border border-[rgba(56,189,248,0.2)] text-[#8CA3C2]">
                    Solar Loss: <strong className="text-[#FFC233]">{currentScenario.solar_loss_pct}%</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[rgba(7,18,40,0.8)] border border-[rgba(56,189,248,0.2)] text-[#8CA3C2]">
                    Dust Factor: <strong className="text-[#8CA3C2]">{currentScenario.dust_factor}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[rgba(7,18,40,0.8)] border border-[rgba(56,189,248,0.2)] text-[#8CA3C2]">
                    Battery SoC: <strong className="text-[#22D3EE]">{currentScenario.battery_soc_kwh} kWh</strong>
                  </span>
                  {loadingScenario && (
                    <span className="text-[#22D3EE] text-[11px] font-exo animate-pulse">
                      Updating simulation state...
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Calculate All Summary Panel */}
            {calculateAllResult && (
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-xl bg-black/45 border border-[rgba(56,189,248,0.3)] space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/10">
                    <span className="font-orbitron font-bold text-xs uppercase tracking-wider text-[#22D3EE] flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-[#22D3EE]" />
                      Full Dataset Evaluation Summary ({calculateAllResult.summary?.total_scenarios?.toLocaleString()} Scenarios)
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {calculateAllResult.validation_check && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono text-[#22E58B] bg-[rgba(34,229,139,0.12)] border border-[#22E58B]/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-[#22E58B]" />
                          {calculateAllResult.validation_check.samples_checked}/50 engine samples verified
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={handleShowOneOfEach}
                        disabled={loadingSamples}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-orbitron font-semibold uppercase tracking-wider text-[#22D3EE] bg-[rgba(34,211,238,0.15)] border border-[#22D3EE]/40 hover:bg-[rgba(34,211,238,0.25)] transition-all active:scale-95 shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                        title="Load 4 representative scenarios (Safe, Watch, Critical, Unsafe) to demo all operational states"
                      >
                        <Sparkles className="w-3 h-3 text-[#22D3EE]" />
                        <span>{loadingSamples ? 'Sampling...' : 'Show one of each'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadWorstCsv}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-exo font-semibold text-[#8CA3C2] bg-white/5 border border-white/15 hover:bg-white/10 hover:text-[#EAF4FF] transition-all active:scale-95"
                      >
                        <Download className="w-3 h-3" />
                        <span>Export CSV</span>
                      </button>
                    </div>
                  </div>

                  {/* Multi-segment Alert Level Distribution Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-exo text-[#8CA3C2]">
                      <span>Alert Level Distribution</span>
                      <span>Execution time: {calculateAllResult.summary?.computation_time_ms} ms</span>
                    </div>
                    <div className="w-full h-3 rounded-full overflow-hidden flex bg-black/60 border border-white/10">
                      <div
                        style={{ width: `${calculateAllResult.summary?.percentages?.safe || 0}%` }}
                        className="bg-[#22E58B] transition-all duration-500"
                        title={`Safe: ${calculateAllResult.summary?.counts?.safe} (${calculateAllResult.summary?.percentages?.safe}%)`}
                      />
                      <div
                        style={{ width: `${calculateAllResult.summary?.percentages?.watch || 0}%` }}
                        className="bg-[#FFC233] transition-all duration-500"
                        title={`Watch: ${calculateAllResult.summary?.counts?.watch} (${calculateAllResult.summary?.percentages?.watch}%)`}
                      />
                      <div
                        style={{ width: `${calculateAllResult.summary?.percentages?.critical || 0}%` }}
                        className="bg-[#F97316] transition-all duration-500"
                        title={`Critical: ${calculateAllResult.summary?.counts?.critical} (${calculateAllResult.summary?.percentages?.critical}%)`}
                      />
                      <div
                        style={{ width: `${calculateAllResult.summary?.percentages?.unsafe || 0}%` }}
                        className="bg-[#FF3B4E] transition-all duration-500"
                        title={`Unsafe: ${calculateAllResult.summary?.counts?.unsafe} (${calculateAllResult.summary?.percentages?.unsafe}%)`}
                      />
                    </div>
                  </div>

                  {/* Interactive Filter Chips Grid */}
                  <div className="space-y-1.5 pt-1">
                    <span className="font-exo text-[10px] text-[#8CA3C2] uppercase font-semibold block tracking-wider">
                      Filter Scenarios by Operational State:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 font-mono text-xs">
                      {/* 1. All Scenarios */}
                      <button
                        type="button"
                        onClick={() => handleSelectLevel('all')}
                        className={`p-2.5 rounded-lg border text-left transition-all active:scale-95 ${
                          resultsLevel === 'all'
                            ? 'bg-[rgba(34,211,238,0.2)] border-[#22D3EE] text-[#22D3EE] shadow-[0_0_12px_rgba(34,211,238,0.25)]'
                            : 'bg-black/40 border-white/10 text-[#8CA3C2] hover:border-white/20 hover:text-[#EAF4FF]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-exo text-[10px] uppercase font-semibold flex items-center gap-1">
                            <Layers className="w-3 h-3 text-[#22D3EE]" />
                            All
                          </span>
                          <span className="text-[10px] text-[#8CA3C2] font-exo">100%</span>
                        </div>
                        <span className="font-bold text-sm block mt-0.5 text-[#EAF4FF]">
                          {(calculateAllResult.summary?.counts?.all ?? calculateAllResult.summary?.total_scenarios ?? 10000).toLocaleString()}
                        </span>
                        <span className="text-[10px] text-[#8CA3C2] font-exo block truncate">All cohorts</span>
                      </button>

                      {/* 2. Shortage (Watch + Critical) */}
                      <button
                        type="button"
                        onClick={() => handleSelectLevel('shortage')}
                        className={`p-2.5 rounded-lg border text-left transition-all active:scale-95 ${
                          resultsLevel === 'shortage'
                            ? 'bg-[rgba(255,194,51,0.2)] border-[#FFC233] text-[#FFC233] shadow-[0_0_12px_rgba(255,194,51,0.25)]'
                            : 'bg-black/40 border-white/10 text-[#8CA3C2] hover:border-white/20 hover:text-[#EAF4FF]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-exo text-[10px] uppercase font-semibold flex items-center gap-1">
                            <SlidersHorizontal className="w-3 h-3 text-[#FFC233]" />
                            Shortage
                          </span>
                          <span className="text-[10px] text-[#8CA3C2] font-exo">
                            {calculateAllResult.summary?.percentages?.shortage ?? 0}%
                          </span>
                        </div>
                        <span className="font-bold text-sm block mt-0.5 text-[#FFC233]">
                          {(calculateAllResult.summary?.counts?.shortage ?? ((calculateAllResult.summary?.counts?.watch ?? 0) + (calculateAllResult.summary?.counts?.critical ?? 0))).toLocaleString()}
                        </span>
                        <span className="text-[10px] text-[#8CA3C2] font-exo block truncate">Watch + Critical</span>
                      </button>

                      {/* 3. Safe */}
                      <button
                        type="button"
                        onClick={() => handleSelectLevel('safe')}
                        className={`p-2.5 rounded-lg border text-left transition-all active:scale-95 ${
                          resultsLevel === 'safe'
                            ? 'bg-[rgba(34,229,139,0.2)] border-[#22E58B] text-[#22E58B] shadow-[0_0_12px_rgba(34,229,139,0.25)]'
                            : 'bg-black/40 border-white/10 text-[#8CA3C2] hover:border-white/20 hover:text-[#EAF4FF]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-exo text-[10px] uppercase font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-[#22E58B]" />
                            Safe
                          </span>
                          <span className="text-[10px] text-[#8CA3C2] font-exo">
                            {calculateAllResult.summary?.percentages?.safe}%
                          </span>
                        </div>
                        <span className="font-bold text-sm block mt-0.5 text-[#22E58B]">
                          {calculateAllResult.summary?.counts?.safe?.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-[#8CA3C2] font-exo block truncate">≥ 8.0 kW available</span>
                      </button>

                      {/* 4. Watch */}
                      <button
                        type="button"
                        onClick={() => handleSelectLevel('watch')}
                        className={`p-2.5 rounded-lg border text-left transition-all active:scale-95 ${
                          resultsLevel === 'watch'
                            ? 'bg-[rgba(255,194,51,0.2)] border-[#FFC233] text-[#FFC233] shadow-[0_0_12px_rgba(255,194,51,0.25)]'
                            : 'bg-black/40 border-white/10 text-[#8CA3C2] hover:border-white/20 hover:text-[#EAF4FF]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-exo text-[10px] uppercase font-semibold flex items-center gap-1">
                            <Eye className="w-3 h-3 text-[#FFC233]" />
                            Watch
                          </span>
                          <span className="text-[10px] text-[#8CA3C2] font-exo">
                            {calculateAllResult.summary?.percentages?.watch}%
                          </span>
                        </div>
                        <span className="font-bold text-sm block mt-0.5 text-[#FFC233]">
                          {calculateAllResult.summary?.counts?.watch?.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-[#8CA3C2] font-exo block truncate">6.2 - 8.0 kW</span>
                      </button>

                      {/* 5. Critical */}
                      <button
                        type="button"
                        onClick={() => handleSelectLevel('critical')}
                        className={`p-2.5 rounded-lg border text-left transition-all active:scale-95 ${
                          resultsLevel === 'critical'
                            ? 'bg-[rgba(249,115,22,0.2)] border-[#F97316] text-[#F97316] shadow-[0_0_12px_rgba(249,115,22,0.25)]'
                            : 'bg-black/40 border-white/10 text-[#8CA3C2] hover:border-white/20 hover:text-[#EAF4FF]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-exo text-[10px] uppercase font-semibold flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-[#F97316]" />
                            Critical
                          </span>
                          <span className="text-[10px] text-[#8CA3C2] font-exo">
                            {calculateAllResult.summary?.percentages?.critical}%
                          </span>
                        </div>
                        <span className="font-bold text-sm block mt-0.5 text-[#F97316]">
                          {calculateAllResult.summary?.counts?.critical?.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-[#8CA3C2] font-exo block truncate">3.0 - 6.2 kW</span>
                      </button>

                      {/* 6. Unsafe */}
                      <button
                        type="button"
                        onClick={() => handleSelectLevel('unsafe')}
                        className={`p-2.5 rounded-lg border text-left transition-all active:scale-95 ${
                          resultsLevel === 'unsafe'
                            ? 'bg-[rgba(255,59,78,0.2)] border-[#FF3B4E] text-[#FF3B4E] shadow-[0_0_12px_rgba(255,59,78,0.25)]'
                            : 'bg-black/40 border-white/10 text-[#8CA3C2] hover:border-white/20 hover:text-[#EAF4FF]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-exo text-[10px] uppercase font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-[#FF3B4E]" />
                            Unsafe
                          </span>
                          <span className="text-[10px] text-[#8CA3C2] font-exo">
                            {calculateAllResult.summary?.percentages?.unsafe}%
                          </span>
                        </div>
                        <span className="font-bold text-sm block mt-0.5 text-[#FF3B4E]">
                          {calculateAllResult.summary?.counts?.unsafe?.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-[#8CA3C2] font-exo block truncate">&lt; 3.0 kW deficit</span>
                      </button>
                    </div>
                  </div>

                  {/* Cohort Health Stat Strip */}
                  <div className="grid grid-cols-2 gap-2 font-mono text-xs pt-1">
                    <div className="p-2 rounded-lg bg-[rgba(34,211,238,0.08)] border border-[#22D3EE]/25 flex items-center justify-between">
                      <span className="text-[#8CA3C2] font-exo text-[11px] uppercase">
                        Life Support Feasible:
                      </span>
                      <span className="font-bold text-xs text-[#22D3EE]">
                        {calculateAllResult.summary?.life_support_ok_pct}%{' '}
                        <span className="text-[10px] font-normal text-[#8CA3C2]">
                          ({calculateAllResult.summary?.life_support_ok_count?.toLocaleString()} of {calculateAllResult.summary?.total_scenarios?.toLocaleString()} scenarios)
                        </span>
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-black/40 border border-white/10 flex items-center justify-between">
                      <span className="text-[#8CA3C2] font-exo text-[11px] uppercase">
                        Mean Battery Depletion:
                      </span>
                      <span className="font-bold text-xs text-[#EAF4FF]">
                        {calculateAllResult.summary?.average_survival_hours} h{' '}
                        <span className="text-[10px] font-normal text-[#8CA3C2]">
                          (active discharge scenarios)
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Representative 4-Level Demo Drawer (Show one of each) */}
                {showSamplesDrawer && samplesData && (
                  <div className="p-4 rounded-xl bg-black/45 border border-[rgba(34,211,238,0.35)] space-y-3">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <span className="font-orbitron font-bold text-xs uppercase tracking-wider text-[#22D3EE] flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-[#22D3EE]" />
                        Representative 4-Tier Calibration Samples (Click to load into microgrid)
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowSamplesDrawer(false)}
                        className="text-[11px] font-exo text-[#8CA3C2] hover:text-[#EAF4FF]"
                      >
                        Dismiss
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {[
                        {
                          lvl: 'safe',
                          title: 'SAFE STATE',
                          badgeClass: 'text-[#22E58B] border-[#22E58B]/40 bg-[rgba(34,229,139,0.15)]',
                          icon: CheckCircle2,
                          desc: 'Full habitat load power satisfied',
                        },
                        {
                          lvl: 'watch',
                          title: 'WATCH STATE',
                          badgeClass: 'text-[#FFC233] border-[#FFC233]/40 bg-[rgba(255,194,51,0.15)]',
                          icon: Eye,
                          desc: 'Non-critical loads curtailed',
                        },
                        {
                          lvl: 'critical',
                          title: 'CRITICAL STATE',
                          badgeClass: 'text-[#F97316] border-[#F97316]/40 bg-[rgba(249,115,22,0.15)]',
                          icon: AlertCircle,
                          desc: 'Priority load shedding active',
                        },
                        {
                          lvl: 'unsafe',
                          title: 'UNSAFE STATE',
                          badgeClass: 'text-[#FF3B4E] border-[#FF3B4E]/40 bg-[rgba(255,59,78,0.18)]',
                          icon: AlertTriangle,
                          desc: 'Life Support below 3.0 kW threshold',
                        },
                      ].map((tier) => {
                        const s = samplesData[tier.lvl];
                        if (!s) return null;
                        const isCur = currentScenarioIndex === s.index;
                        const TierIcon = tier.icon;
                        return (
                          <button
                            key={tier.lvl}
                            type="button"
                            onClick={() => applyScenarioToEngine(s, s.index)}
                            className={`p-3 rounded-xl border text-left transition-all active:scale-95 space-y-2 ${
                              isCur
                                ? 'bg-[rgba(34,211,238,0.18)] border-[#22D3EE] shadow-[0_0_12px_rgba(34,211,238,0.25)]'
                                : 'bg-black/50 border-white/10 hover:border-white/25 hover:bg-black/70'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-orbitron font-bold border flex items-center gap-1 ${tier.badgeClass}`}>
                                <TierIcon className="w-3 h-3" />
                                {tier.title}
                              </span>
                              <span className="font-mono text-[10px] text-[#22D3EE] font-bold">
                                {s.scenario_id}
                              </span>
                            </div>
                            <div>
                              <span className="font-exo font-semibold text-xs text-[#EAF4FF] block truncate">
                                {s.name}
                              </span>
                              <span className="font-exo text-[10px] text-[#8CA3C2] block">
                                {tier.desc}
                              </span>
                            </div>
                            <div className="pt-1 border-t border-white/5 grid grid-cols-2 gap-1 text-[10px] font-mono text-[#8CA3C2]">
                              <span>Loss: <strong className="text-[#FFC233]">{(s.solar_loss_pct ?? s.loss ?? 0).toFixed(1)}%</strong></span>
                              <span>Dust: <strong>{Number(s.dust_factor ?? s.dust ?? 0).toFixed(2)}</strong></span>
                              <span>Battery: <strong>{Number(s.battery_soc_kwh ?? s.battery ?? 0).toFixed(1)} kWh</strong></span>
                              <span>Power: <strong className="text-[#EAF4FF]">{Number(s.available_kw ?? 0).toFixed(1)} kW</strong></span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Filtered & Paginated Scenarios Results Table */}
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-exo text-[#8CA3C2]">
                    <div>
                      <span className="flex items-center gap-1.5 text-[#EAF4FF] font-semibold text-sm">
                        <Filter className="w-3.5 h-3.5 text-[#22D3EE]" />
                        {(() => {
                          const matching = (resultsData?.total_matching ?? 0).toLocaleString();
                          const total = (datasetInfo?.total_rows ?? 10000).toLocaleString();
                          switch (resultsLevel) {
                            case 'all':
                              return `All scenarios (${matching} of ${total})`;
                            case 'shortage':
                              return `Shortage scenarios (${matching} of ${total})`;
                            case 'safe':
                              return `Safe scenarios (${matching} of ${total})`;
                            case 'watch':
                              return `Watch scenarios (${matching} of ${total})`;
                            case 'critical':
                              return `Critical scenarios (${matching} of ${total})`;
                            case 'unsafe':
                              return `Unsafe scenarios (${matching} of ${total})`;
                            default:
                              return `Scenarios (${matching} of ${total})`;
                          }
                        })()}
                      </span>
                      <p className="font-exo text-[11px] text-[#8CA3C2] mt-0.5">
                        Click any scenario row to evaluate live load shedding and survival telemetry
                      </p>
                    </div>

                    {/* Sorting & Shuffle toolbar */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-black/50 border border-[rgba(56,189,248,0.25)] rounded-lg px-2.5 py-1 text-xs font-exo">
                        <ArrowUpDown className="w-3 h-3 text-[#22D3EE]" />
                        <label className="text-[11px] text-[#8CA3C2] mr-1">Sort:</label>
                        <select
                          value={resultsSort}
                          onChange={(e) => handleSelectSort(e.target.value)}
                          className="bg-transparent text-[#EAF4FF] text-xs focus:outline-none cursor-pointer"
                        >
                          <option value="worst" className="bg-slate-900 text-[#EAF4FF]">Worst first (lowest kW)</option>
                          <option value="best" className="bg-slate-900 text-[#EAF4FF]">Best first (highest kW)</option>
                          <option value="random" className="bg-slate-900 text-[#EAF4FF]">Random sample</option>
                        </select>
                      </div>

                      {resultsSort === 'random' && (
                        <button
                          type="button"
                          onClick={() => fetchFilteredResults(resultsLevel, 'random', resultsPage)}
                          disabled={loadingResults}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-exo font-semibold text-[#22D3EE] bg-[rgba(34,211,238,0.1)] border border-[rgba(34,211,238,0.3)] hover:bg-[rgba(34,211,238,0.2)] transition-all active:scale-95"
                          title="Generate a fresh random sample of 10 scenarios"
                        >
                          <Shuffle className="w-3 h-3" />
                          <span>Reshuffle</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Results Table */}
                  <div className="overflow-x-auto rounded-xl border border-[rgba(56,189,248,0.25)] bg-black/35">
                    <table className="w-full text-xs font-mono text-left">
                      <thead className="bg-black/60 text-[#8CA3C2] uppercase font-exo text-[10px] tracking-wider border-b border-[rgba(56,189,248,0.2)]">
                        <tr>
                          <th className="px-2.5 py-2">#</th>
                          <th className="px-3 py-2">ID</th>
                          <th className="px-3 py-2">Name</th>
                          <th className="px-2.5 py-2">Category</th>
                          <th className="px-2 py-2 text-right">Loss %</th>
                          <th className="px-2 py-2 text-right">Dust</th>
                          <th className="px-2 py-2 text-right">Battery</th>
                          <th className="px-2.5 py-2 text-right">Available</th>
                          <th className="px-2.5 py-2 text-center">Alert</th>
                          <th className="px-2.5 py-2 text-center">Life Support</th>
                          <th className="px-2.5 py-2 text-right">Survival</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {loadingResults ? (
                          // Loading Skeletons
                          Array.from({ length: 5 }).map((_, skIdx) => (
                            <tr key={`sk-${skIdx}`} className="animate-pulse">
                              <td className="px-2.5 py-2.5"><div className="h-3 w-4 bg-white/10 rounded" /></td>
                              <td className="px-3 py-2.5"><div className="h-3 w-14 bg-white/10 rounded" /></td>
                              <td className="px-3 py-2.5"><div className="h-3 w-32 bg-white/10 rounded" /></td>
                              <td className="px-2.5 py-2.5"><div className="h-3 w-16 bg-white/10 rounded" /></td>
                              <td className="px-2 py-2.5 text-right"><div className="h-3 w-10 ml-auto bg-white/10 rounded" /></td>
                              <td className="px-2 py-2.5 text-right"><div className="h-3 w-8 ml-auto bg-white/10 rounded" /></td>
                              <td className="px-2 py-2.5 text-right"><div className="h-3 w-12 ml-auto bg-white/10 rounded" /></td>
                              <td className="px-2.5 py-2.5 text-right"><div className="h-3 w-12 ml-auto bg-white/10 rounded" /></td>
                              <td className="px-2.5 py-2.5 text-center"><div className="h-3 w-14 mx-auto bg-white/10 rounded" /></td>
                              <td className="px-2.5 py-2.5 text-center"><div className="h-3 w-16 mx-auto bg-white/10 rounded" /></td>
                              <td className="px-2.5 py-2.5 text-right"><div className="h-3 w-8 ml-auto bg-white/10 rounded" /></td>
                            </tr>
                          ))
                        ) : (resultsData?.rows || []).length === 0 ? (
                          // Empty State
                          <tr>
                            <td colSpan={11} className="py-8 text-center text-[#8CA3C2] font-exo">
                              <AlertCircle className="w-6 h-6 mx-auto text-[#8CA3C2]/60 mb-2" />
                              <p className="font-semibold text-sm text-[#EAF4FF]">No scenarios match this filter</p>
                              <p className="text-xs text-[#8CA3C2] mt-0.5">
                                Select another alert level chip or reset the filter.
                              </p>
                            </td>
                          </tr>
                        ) : (
                          // Data Rows
                          (resultsData?.rows || []).map((row, rowIdx) => {
                            const isSelected = currentScenarioIndex === row.index;
                            const alertBadgeClass =
                              row.alert_level === 'safe'
                                ? 'text-[#22E58B] border-[#22E58B]/40 bg-[rgba(34,229,139,0.15)]'
                                : row.alert_level === 'watch'
                                ? 'text-[#FFC233] border-[#FFC233]/40 bg-[rgba(255,194,51,0.15)]'
                                : row.alert_level === 'critical'
                                ? 'text-[#F97316] border-[#F97316]/40 bg-[rgba(249,115,22,0.15)]'
                                : 'text-[#FF3B4E] border-[#FF3B4E]/40 bg-[rgba(255,59,78,0.18)]';

                            const rowNumber =
                              resultsSort === 'random'
                                ? rowIdx + 1
                                : ((resultsData.page - 1) * resultsData.page_size) + rowIdx + 1;

                            return (
                              <tr
                                key={row.scenario_id || rowIdx}
                                onClick={() => applyScenarioToEngine(row, row.index)}
                                className={`cursor-pointer transition-colors ${
                                  isSelected ? 'bg-[rgba(34,211,238,0.15)] border-l-2 border-l-[#22D3EE]' : 'hover:bg-white/10'
                                }`}
                                title={`Click to evaluate ${row.scenario_id} in live microgrid`}
                              >
                                <td className="px-2.5 py-2 text-[#8CA3C2] font-semibold">{rowNumber}</td>
                                <td className="px-3 py-2 text-[#22D3EE] font-bold">{row.scenario_id}</td>
                                <td className="px-3 py-2 text-[#EAF4FF] font-medium font-exo whitespace-nowrap">
                                  {row.name}
                                </td>
                                <td className="px-2.5 py-2 text-[#8CA3C2] font-exo">{row.category}</td>
                                <td className="px-2 py-2 text-right text-[#FFC233]">
                                  {Number(row.solar_loss_pct ?? row.loss ?? 0).toFixed(1)}%
                                </td>
                                <td className="px-2 py-2 text-right text-[#8CA3C2]">
                                  {Number(row.dust_factor ?? row.dust ?? 0).toFixed(2)}
                                </td>
                                <td className="px-2 py-2 text-right text-[#8CA3C2]">
                                  {Number(row.battery_soc_kwh ?? row.battery ?? 0).toFixed(1)} kWh
                                </td>
                                <td className="px-2.5 py-2 text-right font-bold text-[#EAF4FF]">
                                  {Number(row.available_kw ?? 0).toFixed(1)} kW
                                </td>
                                <td className="px-2.5 py-2 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-orbitron font-bold uppercase border ${alertBadgeClass}`}>
                                    {row.alert_level}
                                  </span>
                                </td>
                                <td className="px-2.5 py-2 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                      row.life_support_ok
                                        ? 'text-[#22E58B] bg-[rgba(34,229,139,0.15)] border border-[#22E58B]/30'
                                        : 'text-[#FF3B4E] bg-[rgba(255,59,78,0.15)] border border-[#FF3B4E]/30'
                                    }`}
                                  >
                                    {row.life_support_ok ? 'PROTECTED' : 'DEFICIT'}
                                  </span>
                                </td>
                                <td className="px-2.5 py-2 text-right text-[#8CA3C2]">
                                  {row.survival_hours !== null && row.survival_hours !== undefined ? `${Number(row.survival_hours).toFixed(1)} h` : '—'}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Footer */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 px-1">
                    <span className="font-mono text-xs text-[#8CA3C2]">
                      Page {resultsData?.page || 1} of {(resultsData?.total_pages || 1).toLocaleString()} ({((resultsData?.total_matching ?? 0)).toLocaleString()} matching scenarios)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handlePageChange(resultsPage - 1)}
                        disabled={loadingResults || resultsPage <= 1}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-exo font-semibold text-[#EAF4FF] bg-white/10 border border-white/20 hover:bg-white/15 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Previous</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePageChange(resultsPage + 1)}
                        disabled={loadingResults || !resultsData || resultsPage >= resultsData.total_pages}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-exo font-semibold text-[#EAF4FF] bg-white/10 border border-white/20 hover:bg-white/15 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 13. LIFE SUPPORT AT RISK WARNING - ONLY WHEN alert.life_support_ok === false */}
      {state?.alert?.life_support_ok === false && (
        <div className="p-4 rounded-xl bg-[rgba(255,59,78,0.2)] border-2 border-[#FF3B4E] text-[#FF3B4E] flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-[#FF3B4E]" />
            <div>
              <span className="font-orbitron font-bold text-sm tracking-wide">
                LIFE SUPPORT AT RISK
              </span>
              <span className="font-exo text-xs text-[#EAF4FF]/90 ml-2">
                — {state.alert?.message || 'Available power is below the 3.0 kW Life Support safety threshold.'}
              </span>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FF3B4E] text-white">
            CRITICAL DEFICIT
          </span>
        </div>
      )}

      {/* RESULT CARD (Active Evaluation & Subsystem Load Allocation) */}
      {state?.summary && (
        <div id="simulation-result-card" ref={resultCardRef} className="console-panel p-5 space-y-4 border border-[rgba(56,189,248,0.3)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[rgba(56,189,248,0.2)]">
            <div className="flex items-center gap-2.5">
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-orbitron font-bold border ${
                  state.verdict === 'SAFE'
                    ? 'text-[#22E58B] border-[#22E58B]/40 bg-[rgba(34,229,139,0.15)]'
                    : state.verdict === 'SHORTAGE'
                    ? 'text-[#FFC233] border-[#FFC233]/40 bg-[rgba(255,194,51,0.18)]'
                    : 'text-[#FF3B4E] border-[#FF3B4E]/40 bg-[rgba(255,59,78,0.18)]'
                }`}
              >
                {state.verdict || (state.alert?.life_support_ok === false ? 'UNSAFE' : 'SAFE')}
              </span>
              <p className="font-exo text-sm font-semibold text-[#EAF4FF]">
                {state.summary}
              </p>
            </div>
            <span className="font-mono text-xs text-[#8CA3C2]">
              Available: {power?.available_kw !== null && power?.available_kw !== undefined ? `${Number(power.available_kw).toFixed(1)} kW` : '--'} / Demand: 8.0 kW
            </span>
          </div>

          {/* Proposal Sent Notification Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[rgba(34,211,238,0.12)] border border-[rgba(34,211,238,0.35)]">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-[#22D3EE] shrink-0" />
              <div className="text-xs font-exo text-[#EAF4FF]">
                <strong className="text-[#22D3EE]">Proposal sent to Approval.</strong> Real grid allocation remains unchanged until authorized by flight operations.
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/console/approval')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-orbitron font-semibold uppercase tracking-wider text-[#22D3EE] bg-[rgba(34,211,238,0.18)] hover:bg-[rgba(34,211,238,0.3)] border border-[#22D3EE]/40 transition-all shrink-0 cursor-pointer shadow-[0_0_10px_rgba(34,211,238,0.2)]"
            >
              <span>Go to Approval</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Subsystem Loads List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-exo text-[#8CA3C2] uppercase font-semibold px-2">
              <span>Subsystem</span>
              <div className="flex items-center gap-10 sm:gap-16">
                <span className="w-16 text-right">Needs</span>
                <span className="w-16 text-right">Gets</span>
                <span className="w-24 text-right">Status</span>
              </div>
            </div>
            <div className="space-y-1.5 font-mono text-xs">
              {(state.loads || []).map((load) => {
                const need = Number(load.need_kw ?? 0);
                const gets = Number(load.allocated_kw ?? 0);
                const isFullyPowered = gets >= need - 0.05;
                const isPartial = gets > 0.05 && !isFullyPowered;

                let loadLabel = load.name;
                if (load.id === 'life_support') loadLabel = 'Life Support';
                else if (load.id === 'habitat') loadLabel = 'Habitat';
                else if (load.id === 'comms') loadLabel = 'Communication';
                else if (load.id === 'science') loadLabel = 'Science';
                else if (load.id === 'rover') loadLabel = 'Rover';

                let statusBadge = (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase text-[#22E58B] bg-[rgba(34,229,139,0.15)] border border-[#22E58B]/40">
                    Powered
                  </span>
                );
                if (isPartial) {
                  statusBadge = (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase text-[#FFC233] bg-[rgba(255,194,51,0.15)] border border-[#FFC233]/40">
                      Curtailed
                    </span>
                  );
                } else if (!isFullyPowered) {
                  statusBadge = (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase text-[#FF3B4E] bg-[rgba(255,59,78,0.15)] border border-[#FF3B4E]/40">
                      Shed / Off
                    </span>
                  );
                }

                return (
                  <div
                    key={load.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-black/35 border border-white/5 hover:border-[rgba(56,189,248,0.2)] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-exo font-medium text-[#EAF4FF] text-xs">
                        {loadLabel}
                      </span>
                      {load.id === 'life_support' && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase text-[#22D3EE] bg-[rgba(34,211,238,0.15)] border border-[#22D3EE]/30">
                          Life Critical
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-10 sm:gap-16">
                      <span className="w-16 text-right text-[#8CA3C2]">{need.toFixed(1)} kW</span>
                      <span
                        className={`w-16 text-right font-bold ${
                          isFullyPowered ? 'text-[#22E58B]' : isPartial ? 'text-[#FFC233]' : 'text-[#FF3B4E]'
                        }`}
                      >
                        {gets.toFixed(1)} kW
                      </span>
                      <div className="w-24 flex justify-end">
                        {statusBadge}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 2. RE-PLAN LATENCY BENCHMARK & MATHEMATICAL SOLVER CARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Latency */}
        <div className="console-panel p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="font-exo text-xs uppercase tracking-wider text-[#8CA3C2]">
              Re-Plan Response Latency
            </span>
            <div className="flex items-baseline gap-1.5 font-orbitron font-bold text-3xl text-[#22D3EE] font-orbitron-numbers">
              {replanMs !== null ? replanMs : '--'} <span className="text-xs font-normal text-[#8CA3C2]">ms</span>
            </div>
            <span className="font-exo text-[11px] text-[#22E58B] flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Real-time autonomous convergence
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[rgba(34,211,238,0.12)] border border-[rgba(34,211,238,0.35)] flex items-center justify-center text-[#22D3EE]">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Algorithm */}
        <div className="console-panel p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="font-exo text-xs uppercase tracking-wider text-[#8CA3C2]">
              Optimization Solver Engine
            </span>
            <div className="font-orbitron font-bold text-lg text-[#EAF4FF] truncate">
              PuLP + CBC (linear program)
            </div>
            <span className="font-exo text-[11px] text-[#8CA3C2] block">
              Priority-weighted LP
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[rgba(168,85,247,0.12)] border border-[rgba(168,85,247,0.35)] flex items-center justify-center text-[#A855F7]">
            <Cpu className="w-5 h-5" />
          </div>
        </div>

        {/* Constraints (Computed) */}
        <div className="console-panel p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="font-exo text-xs uppercase tracking-wider text-[#8CA3C2]">
              Decision Space Topology
            </span>
            <div className="font-orbitron font-bold text-lg text-[#EAF4FF]">
              {state?.loads?.length ? `${state.loads.length} Variables / ${state.loads.length + 1} Constraints` : '5 Variables / 6 Constraints'}
            </div>
            <span className="font-exo text-[11px] text-[#22E58B] block">
              Life Support Invariant Enforced
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[rgba(34,229,139,0.12)] border border-[rgba(34,229,139,0.35)] flex items-center justify-center text-[#22E58B]">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. BEFORE / AFTER RUN SNAPSHOT COMPARISON */}
      <div className="console-panel p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[rgba(56,189,248,0.2)]">
          <div>
            <h3 className="font-orbitron font-bold text-base text-[#EAF4FF] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#22D3EE]" />
              BEFORE & AFTER SIMULATION SNAPSHOT
            </h3>
            <p className="font-exo text-xs text-[#8CA3C2]">
              Empirical telemetry delta comparing nominal baseline against active simulated scenario
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Nominal Snapshot */}
          <div className="p-5 rounded-xl bg-black/25 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-orbitron font-bold text-sm text-[#22E58B]">
                NOMINAL BASELINE
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono text-[#22E58B] bg-[rgba(34,229,139,0.15)] border border-[rgba(34,229,139,0.4)]">
                DAYLIGHT PASS
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono-numbers text-xs">
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/10">
                <span className="text-[#8CA3C2] font-exo text-[11px] block">Solar Generation</span>
                <span className="font-bold text-[#EAF4FF] text-sm">8.8 kW</span>
              </div>
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/10">
                <span className="text-[#8CA3C2] font-exo text-[11px] block">Available Power</span>
                <span className="font-bold text-[#EAF4FF] text-sm">11.3 kW</span>
              </div>
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/10">
                <span className="text-[#8CA3C2] font-exo text-[11px] block">Storage Drain</span>
                <span className="font-bold text-[#22E58B] text-sm">0.0 kW (Float)</span>
              </div>
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/10">
                <span className="text-[#8CA3C2] font-exo text-[11px] block">Survival Headroom</span>
                <span className="font-bold text-[#22E58B] text-sm">Sustained</span>
              </div>
            </div>
          </div>

          {/* Active Run Snapshot */}
          <div className="p-5 rounded-xl bg-black/25 border border-[#FFB020]/45 space-y-3 shadow-[0_0_15px_rgba(255,176,32,0.1)]">
            <div className="flex items-center justify-between">
              <span className="font-orbitron font-bold text-sm text-[#FFB020]">
                ACTIVE SIMULATION STATE
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono text-[#FFB020] bg-[rgba(255,176,32,0.15)] border border-[rgba(255,176,32,0.4)]">
                ACTIVE TELEMETRY
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono-numbers text-xs">
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/10">
                <span className="text-[#8CA3C2] font-exo text-[11px] block">Solar Generation</span>
                <span className="font-bold text-[#FFB020] text-sm">
                  {currentSolar !== null ? `${currentSolar.toFixed(1)} kW` : '--'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/10">
                <span className="text-[#8CA3C2] font-exo text-[11px] block">Available Power</span>
                <span className="font-bold text-[#EAF4FF] text-sm">
                  {currentAvailable !== null ? `${currentAvailable.toFixed(1)} kW` : '--'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/10">
                <span className="text-[#8CA3C2] font-exo text-[11px] block">Storage Drain</span>
                <span className="font-bold text-[#FFC233] text-sm">
                  {backendStorageDrain !== null
                    ? backendStorageDrain > 0.001
                      ? `${backendStorageDrain.toFixed(1)} kW (Discharge)`
                      : '0.0 kW (Float)'
                    : '--'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/10">
                <span className="text-[#8CA3C2] font-exo text-[11px] block">Survival Headroom</span>
                {survival.hours_now === null ? (
                  <span className="font-bold text-sm text-[#22E58B]">Sustained</span>
                ) : Number(survival.hours_now) <= 0.001 ? (
                  <span className="font-bold text-sm text-[#FF3B4E]">0 h (unsafe)</span>
                ) : (
                  <span
                    className={`font-bold text-sm ${
                      Number(survival.hours_now) < 6 ? 'text-[#FF3B4E]' : 'text-[#22E58B]'
                    }`}
                  >
                    {Number(survival.hours_now).toFixed(1)} Hours
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
