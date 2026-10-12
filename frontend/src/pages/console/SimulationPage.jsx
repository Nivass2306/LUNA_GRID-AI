import React, { useState, useRef } from 'react';
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
  Upload,
  Download,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';
import { useSpacegridState } from '../../context/SpacegridContext';
import { useToast } from '../../context/ToastContext';
import { getScenarios, simulateDataset } from '../../lib/api';

function splitCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' || ch === "'") {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) {
    return { error: 'CSV file is empty or has no data rows', rows: [] };
  }
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const required = ['solar_loss_pct', 'dust_factor', 'battery_soc_kwh'];
  const missing = required.filter((col) => !headers.includes(col));
  if (missing.length > 0) {
    return {
      error: `Missing required column(s): ${missing.join(', ')}. Required columns: solar_loss_pct, dust_factor, battery_soc_kwh`,
      rows: [],
    };
  }

  const idxLoss = headers.indexOf('solar_loss_pct');
  const idxDust = headers.indexOf('dust_factor');
  const idxBatt = headers.indexOf('battery_soc_kwh');
  const idxName = headers.indexOf('name');
  const idxId = headers.indexOf('id') !== -1 ? headers.indexOf('id') : headers.indexOf('scenario_id');
  const idxVerdict = headers.indexOf('expected_verdict') !== -1 ? headers.indexOf('expected_verdict') : headers.indexOf('verdict');
  const idxAvail = headers.indexOf('expected_available_kw') !== -1 ? headers.indexOf('expected_available_kw') : headers.indexOf('available_kw');

  const rows = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = splitCsvLine(lines[i]);
    if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) continue;
    const rowNum = i;

    const lossRaw = parts[idxLoss]?.trim();
    const dustRaw = parts[idxDust]?.trim();
    const battRaw = parts[idxBatt]?.trim();

    const lossVal = lossRaw !== '' && lossRaw !== undefined ? Number(lossRaw) : NaN;
    const dustVal = dustRaw !== '' && dustRaw !== undefined ? Number(dustRaw) : 0;
    const battVal = battRaw !== '' && battRaw !== undefined ? Number(battRaw) : undefined;

    if (isNaN(lossVal) || lossVal < 0 || lossVal > 100) {
      errors.push(`Row ${rowNum}: solar_loss_pct must be a number between 0 and 100 (got "${lossRaw}")`);
    }
    if (isNaN(dustVal) || dustVal < 0 || dustVal > 1) {
      errors.push(`Row ${rowNum}: dust_factor must be a number between 0 and 1 (got "${dustRaw}")`);
    }
    if (battVal !== undefined && (isNaN(battVal) || battVal < 0 || battVal > 20)) {
      errors.push(`Row ${rowNum}: battery_soc_kwh must be a number between 0 and 20 (got "${battRaw}")`);
    }

    const rowObj = {
      solar_loss_pct: isNaN(lossVal) ? 0 : lossVal,
      dust_factor: isNaN(dustVal) ? 0 : dustVal,
    };
    if (battVal !== undefined && !isNaN(battVal)) {
      rowObj.battery_soc_kwh = battVal;
    }
    if (idxName !== -1 && parts[idxName]) {
      rowObj.name = parts[idxName].trim();
    }
    if (idxId !== -1 && parts[idxId]) {
      rowObj.id = parts[idxId].trim();
    }
    if (idxVerdict !== -1 && parts[idxVerdict]) {
      rowObj.expected_verdict = parts[idxVerdict].trim();
    }
    if (idxAvail !== -1 && parts[idxAvail]) {
      rowObj.expected_available_kw = Number(parts[idxAvail].trim());
    }

    rows.push(rowObj);
  }

  return { rows, errors: errors.length > 0 ? errors : null };
}

export const SimulationPage = () => {
  const {
    state,
    simulateSolarDrop,
    simulateBlackout,
    simulateCustom,
    simulatePreset,
    reset,
    replanning,
  } = useSpacegridState();
  const { showToast } = useToast();

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

  // Dataset batch states
  const [datasetSource, setDatasetSource] = useState('none'); // 'none' | 'library' | 'uploaded'
  const [datasetRows, setDatasetRows] = useState([]);
  const [datasetValidationErrors, setDatasetValidationErrors] = useState(null);
  const [datasetResults, setDatasetResults] = useState(null);
  const [datasetLoading, setDatasetLoading] = useState(false);
  const [calculatingDataset, setCalculatingDataset] = useState(false);
  const [datasetError, setDatasetError] = useState(null);
  const fileInputRef = useRef(null);

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

  const handleUseLibrary = async () => {
    try {
      setDatasetLoading(true);
      setDatasetError(null);
      setDatasetValidationErrors(null);
      setDatasetResults(null);
      const scenarios = await getScenarios();
      setDatasetRows(scenarios);
      setDatasetSource('library');
      showToast({
        message: `Loaded ${scenarios.length} built-in benchmark scenarios.`,
        type: 'success',
      });
    } catch (err) {
      setDatasetError(err.message || 'Failed to load scenarios from backend');
    } finally {
      setDatasetLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDatasetLoading(true);
    setDatasetError(null);
    setDatasetResults(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result;
        const res = parseCsv(content);
        if (res.error) {
          setDatasetValidationErrors([res.error]);
          setDatasetRows([]);
        } else {
          setDatasetRows(res.rows);
          setDatasetValidationErrors(res.errors);
          setDatasetSource('uploaded');
          showToast({
            message: `Loaded ${res.rows.length} rows from CSV file.`,
            type: res.errors ? 'warn' : 'success',
          });
        }
      } catch (err) {
        setDatasetError(err.message || 'Failed to parse CSV file');
      } finally {
        setDatasetLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setDatasetError('Failed to read the selected file.');
      setDatasetLoading(false);
    };
    reader.readAsText(file);
  };

  const handleCalculateAll = async () => {
    if (datasetRows.length === 0) return;
    if (datasetValidationErrors && datasetValidationErrors.length > 0) {
      showToast({
        message: 'Cannot calculate dataset with validation errors. Please fix errors first.',
        type: 'danger',
      });
      return;
    }
    try {
      setCalculatingDataset(true);
      setDatasetError(null);
      const payload = datasetSource === 'library' ? { library: true } : { rows: datasetRows };
      const res = await simulateDataset(payload);
      setDatasetResults(res);
      showToast({
        message: `Evaluated ${res.rows?.length || 0} scenarios across 3 allocation policies.`,
        type: 'success',
      });
    } catch (err) {
      if (err.status === 422) {
        let msg = 'Validation error: Invalid input parameters';
        if (err.detail) {
          if (typeof err.detail === 'string') msg = err.detail;
          else if (Array.isArray(err.detail)) msg = err.detail.map((d) => d.msg || JSON.stringify(d)).join('; ');
        }
        setDatasetError(msg);
      } else {
        setDatasetError(err.message || 'Failed to evaluate dataset');
      }
    } finally {
      setCalculatingDataset(false);
    }
  };

  const handleRowClick = async (row) => {
    try {
      if (row.id && row.id.startsWith('S')) {
        await simulatePreset(row.id);
        showToast({
          message: `Applied scenario ${row.id} (${row.name}) to live dashboard.`,
          type: 'success',
        });
      } else {
        await simulateCustom({
          solar_drop_pct: row.solar_loss_pct,
          dust_factor: row.dust_factor,
          battery_soc_kwh: row.battery_soc_kwh,
        });
        showToast({
          message: `Applied ${row.name || 'custom scenario'} to live dashboard.`,
          type: 'success',
        });
      }
    } catch (err) {
      showToast({
        message: err.message || 'Failed to apply scenario to live dashboard.',
        type: 'danger',
      });
    }
  };

  const handleDownloadResultsCsv = () => {
    if (!datasetResults || !datasetResults.rows) return;
    const headers = [
      'id',
      'name',
      'solar_loss_pct',
      'dust_factor',
      'battery_soc_kwh',
      'solar_kw',
      'usable_battery_kw',
      'available_kw',
      'verdict',
      'life_support_ok',
      'unmet_kw',
      'matches_expected',
      'equal_split_ls_ok',
      'fixed_rules_ls_ok',
      'spacegrid_ls_ok',
    ];
    const csvRows = [headers.join(',')];
    for (const r of datasetResults.rows) {
      const rowValues = [
        r.id || '',
        `"${(r.name || '').replace(/"/g, '""')}"`,
        r.solar_loss_pct ?? '',
        r.dust_factor ?? '',
        r.battery_soc_kwh ?? '',
        r.solar_kw ?? '',
        r.usable_battery_kw ?? '',
        r.available_kw ?? '',
        r.verdict ?? '',
        r.life_support_ok ?? '',
        r.unmet_kw ?? '',
        r.matches_expected ?? '',
        r.policies?.equal_split?.life_support_ok ?? '',
        r.policies?.fixed_rules?.life_support_ok ?? '',
        r.policies?.spacegrid?.life_support_ok ?? '',
      ];
      csvRows.push(rowValues.join(','));
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'simulation_dataset_results.csv');
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

        {/* DATASET TAB: BATCH DATASET PROCESSING */}
        {activeTab === 'dataset' && (
          <div className="p-4 rounded-xl bg-black/30 border border-[rgba(56,189,248,0.18)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="font-orbitron font-bold text-xs uppercase tracking-wider text-[#22D3EE] flex items-center gap-2">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#22D3EE]" />
                  Batch Dataset Evaluation (POST /simulate/dataset)
                </span>
                <p className="font-exo text-[11px] text-[#8CA3C2] mt-0.5">
                  Required columns: <code className="text-[#22D3EE]">solar_loss_pct</code>, <code className="text-[#22D3EE]">dust_factor</code>, <code className="text-[#22D3EE]">battery_soc_kwh</code>
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleUseLibrary}
                  disabled={datasetLoading || calculatingDataset}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-exo font-semibold text-[#22D3EE] bg-[rgba(34,211,238,0.12)] border border-[rgba(34,211,238,0.35)] hover:bg-[rgba(34,211,238,0.22)] transition-all active:scale-95 disabled:opacity-50"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Use built-in library (30 scenarios)</span>
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={datasetLoading || calculatingDataset}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-exo font-semibold text-[#EAF4FF] bg-white/10 border border-white/20 hover:bg-white/15 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload CSV</span>
                </button>
              </div>
            </div>

            {/* Validation errors */}
            {datasetValidationErrors && datasetValidationErrors.length > 0 && (
              <div className="p-3 rounded-lg bg-[rgba(255,59,78,0.18)] border border-[#FF3B4E]/60 text-[#FF3B4E] text-xs font-mono space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-[#FF3B4E]" />
                  <span>Validation Errors Detected ({datasetValidationErrors.length}):</span>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-0.5 pl-5">
                  {datasetValidationErrors.slice(0, 10).map((err, i) => (
                    <div key={i}>• {err}</div>
                  ))}
                  {datasetValidationErrors.length > 10 && (
                    <div className="text-[#8CA3C2]">...and {datasetValidationErrors.length - 10} more errors</div>
                  )}
                </div>
              </div>
            )}

            {/* Backend error */}
            {datasetError && (
              <div className="p-3 rounded-lg bg-[rgba(255,59,78,0.18)] border border-[#FF3B4E]/60 text-[#FF3B4E] text-xs font-mono flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#FF3B4E]" />
                <div className="flex-1">
                  <span className="font-bold">Backend Error: </span>
                  <span>{datasetError}</span>
                </div>
              </div>
            )}

            {/* Preview of rows */}
            {datasetRows && datasetRows.length > 0 && !datasetResults && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-[#8CA3C2] font-exo">
                  <span>
                    Dataset loaded: <strong className="text-[#EAF4FF]">{datasetRows.length} rows</strong> ({datasetSource === 'library' ? 'Built-in Library' : 'Uploaded CSV'})
                  </span>
                  <span>Showing preview of first {Math.min(5, datasetRows.length)} rows</span>
                </div>

                <div className="overflow-x-auto rounded-lg border border-[rgba(56,189,248,0.2)]">
                  <table className="w-full text-xs font-mono text-left">
                    <thead className="bg-black/50 text-[#8CA3C2] uppercase font-exo text-[10px] tracking-wider border-b border-[rgba(56,189,248,0.2)]">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Loss %</th>
                        <th className="px-3 py-2">Dust</th>
                        <th className="px-3 py-2">Battery (kWh)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 bg-black/25">
                      {datasetRows.slice(0, 5).map((row, idx) => (
                        <tr key={idx} className="hover:bg-white/5">
                          <td className="px-3 py-2 text-[#8CA3C2]">{row.id || idx + 1}</td>
                          <td className="px-3 py-2 text-[#EAF4FF] font-medium font-exo">{row.name || `Scenario ${idx + 1}`}</td>
                          <td className="px-3 py-2 text-[#FFC233]">{row.solar_loss_pct}%</td>
                          <td className="px-3 py-2 text-[#8CA3C2]">{row.dust_factor}</td>
                          <td className="px-3 py-2 text-[#22D3EE]">{row.battery_soc_kwh ?? '--'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleCalculateAll}
                    disabled={calculatingDataset || (datasetValidationErrors && datasetValidationErrors.length > 0)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#22D3EE] to-[#0284C7] text-slate-950 font-orbitron font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:brightness-110 active:scale-95 disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-slate-950" />
                    <span>{calculatingDataset ? 'Calculating all scenarios...' : 'Calculate all'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Results table & summary counts */}
            {datasetResults && (
              <div className="space-y-4 pt-2">
                {/* Summary counts */}
                <div className="p-4 rounded-xl bg-black/40 border border-[rgba(56,189,248,0.25)] space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/10">
                    <span className="font-orbitron font-bold text-xs uppercase tracking-wider text-[#22D3EE] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#22D3EE]" />
                      Dataset Evaluation Summary ({datasetResults.summary?.total_rows} Scenarios)
                    </span>
                    <button
                      type="button"
                      onClick={handleDownloadResultsCsv}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-exo font-semibold text-[#22D3EE] bg-[rgba(34,211,238,0.15)] border border-[rgba(34,211,238,0.4)] hover:bg-[rgba(34,211,238,0.25)] transition-all active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download results CSV</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 font-mono text-xs">
                    <div className="p-2.5 rounded-lg bg-[rgba(34,229,139,0.1)] border border-[#22E58B]/30">
                      <span className="text-[#8CA3C2] font-exo text-[10px] block">SAFE</span>
                      <span className="font-bold text-base text-[#22E58B]">{datasetResults.summary?.safe_count}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[rgba(255,194,51,0.1)] border border-[#FFC233]/30">
                      <span className="text-[#8CA3C2] font-exo text-[10px] block">SHORTAGE</span>
                      <span className="font-bold text-base text-[#FFC233]">{datasetResults.summary?.shortage_count}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[rgba(255,59,78,0.1)] border border-[#FF3B4E]/30">
                      <span className="text-[#8CA3C2] font-exo text-[10px] block">UNSAFE</span>
                      <span className="font-bold text-base text-[#FF3B4E]">{datasetResults.summary?.unsafe_count}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[rgba(34,211,238,0.1)] border border-[#22D3EE]/30">
                      <span className="text-[#8CA3C2] font-exo text-[10px] block">Equal Split LS Fails</span>
                      <span className="font-bold text-base text-[#22D3EE]">
                        {datasetResults.summary?.equal_split_fails_spacegrid_ok}
                        <span className="text-[10px] text-[#8CA3C2] font-normal block font-exo">(Spacegrid protects LS)</span>
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-black/50 border border-white/10">
                      <span className="text-[#8CA3C2] font-exo text-[10px] block">Optimizer Time</span>
                      <span className="font-bold text-base text-[#EAF4FF]">{datasetResults.summary?.optimizer_time_ms} ms</span>
                    </div>
                  </div>
                </div>

                {/* Results Table */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-exo text-[#8CA3C2]">
                    <span>💡 Tip: Click any row to load into the live dashboard</span>
                    <span className="font-mono text-[11px]">{datasetResults.rows?.length} scenarios computed</span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-[rgba(56,189,248,0.25)] bg-black/30">
                    <table className="w-full text-xs font-mono text-left">
                      <thead className="bg-black/60 text-[#8CA3C2] uppercase font-exo text-[10px] tracking-wider border-b border-[rgba(56,189,248,0.2)]">
                        <tr>
                          <th className="px-3 py-2.5">Name</th>
                          <th className="px-2.5 py-2.5 text-right">Loss %</th>
                          <th className="px-2.5 py-2.5 text-right">Dust</th>
                          <th className="px-2.5 py-2.5 text-right">Battery</th>
                          <th className="px-2.5 py-2.5 text-right">Solar</th>
                          <th className="px-2.5 py-2.5 text-right">Available</th>
                          <th className="px-3 py-2.5 text-center">Verdict</th>
                          <th className="px-3 py-2.5 text-center">Life Support</th>
                          <th className="px-2.5 py-2.5 text-right">Unmet kW</th>
                          <th className="px-3 py-2.5 text-center">Match</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {datasetResults.rows.map((row, idx) => {
                          const verdictClass =
                            row.verdict === 'SAFE'
                              ? 'text-[#22E58B] border-[#22E58B]/40 bg-[rgba(34,229,139,0.15)]'
                              : row.verdict === 'SHORTAGE'
                              ? 'text-[#FFC233] border-[#FFC233]/40 bg-[rgba(255,194,51,0.15)]'
                              : 'text-[#FF3B4E] border-[#FF3B4E]/40 bg-[rgba(255,59,78,0.18)]';

                          return (
                            <tr
                              key={idx}
                              onClick={() => handleRowClick(row)}
                              className="hover:bg-white/10 cursor-pointer transition-colors"
                              title={`Click to load ${row.name || row.id} into live dashboard`}
                            >
                              <td className="px-3 py-2 text-[#EAF4FF] font-medium font-exo whitespace-nowrap">
                                {row.id ? <span className="font-mono text-[#22D3EE] mr-1.5 font-bold">{row.id}</span> : null}
                                {row.name || `Scenario ${idx + 1}`}
                              </td>
                              <td className="px-2.5 py-2 text-right text-[#FFC233]">{row.solar_loss_pct}%</td>
                              <td className="px-2.5 py-2 text-right text-[#8CA3C2]">{row.dust_factor}</td>
                              <td className="px-2.5 py-2 text-right text-[#8CA3C2]">{row.battery_soc_kwh}</td>
                              <td className="px-2.5 py-2 text-right text-[#EAF4FF] font-semibold">{row.solar_kw.toFixed(1)}</td>
                              <td className="px-2.5 py-2 text-right text-[#22D3EE] font-bold">{row.available_kw.toFixed(1)}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-orbitron font-bold border ${verdictClass}`}>
                                  {row.verdict}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    row.life_support_ok
                                      ? 'text-[#22E58B] bg-[rgba(34,229,139,0.15)] border border-[#22E58B]/30'
                                      : 'text-[#FF3B4E] bg-[rgba(255,59,78,0.15)] border border-[#FF3B4E]/30'
                                  }`}
                                >
                                  {row.life_support_ok ? 'OK (3.0)' : 'DEFICIT'}
                                </span>
                              </td>
                              <td className="px-2.5 py-2 text-right text-[#8CA3C2]">{row.unmet_kw.toFixed(1)}</td>
                              <td className="px-3 py-2 text-center">
                                {row.matches_expected === true ? (
                                  <div className="flex flex-col items-center">
                                    <span className="text-[#22E58B] flex items-center justify-center gap-1 font-semibold text-[10px]">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Match
                                    </span>
                                    {row.swap_detected && (
                                      <span className="text-[#FFC233] text-[9px] font-mono leading-none">(weight swap)</span>
                                    )}
                                  </div>
                                ) : row.matches_expected === false ? (
                                  <span className="text-[#FF3B4E] flex items-center justify-center gap-1 font-semibold text-[10px]">
                                    <AlertTriangle className="w-3.5 h-3.5" /> Mismatch
                                  </span>
                                ) : (
                                  <span className="text-[#8CA3C2] text-[10px]">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
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
        <div className="console-panel p-5 space-y-4 border border-[rgba(56,189,248,0.3)]">
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
