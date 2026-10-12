import React from 'react';
import { Link } from 'react-router-dom';
import { LunarHeroSvg } from '../components/LunarHeroSvg';
import {
  TrendingDown,
  Activity,
  Sliders,
  Layers,
  ShieldCheck,
  Shield,
  ArrowRight,
  ChevronDown,
  AlertOctagon,
  Cpu,
  UserCheck,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export const LandingPage = () => {
  const scrollToHowItWorks = () => {
    const el = document.getElementById('how-it-works');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const steps = [
    {
      num: '01',
      title: 'Predict',
      icon: TrendingDown,
      color: '#FFC857',
      desc: 'Forecasts solar drop trajectories and dust events up to 24 hours ahead.',
    },
    {
      num: '02',
      title: 'Calculate risk',
      icon: Activity,
      color: '#38BDF8',
      desc: 'Computes habitat power deficit and reserve battery survival depletion curves.',
    },
    {
      num: '03',
      title: 'Optimize',
      icon: Sliders,
      color: '#34D399',
      desc: 'Rations electricity strictly across 5 priority tiers to protect life support.',
    },
    {
      num: '04',
      title: 'Simulate',
      icon: Layers,
      color: '#818CF8',
      desc: 'Verifies digital twin electrical stability before surfacing advice to operators.',
    },
    {
      num: '05',
      title: 'Respond & explain',
      icon: ShieldCheck,
      color: '#22C55E',
      desc: 'Delivers plain-language, load-by-load rationales for every shed decision.',
    },
  ];

  const priorityLadder = [
    {
      priority: 1,
      name: 'Life support',
      tier: 'Critical',
      need: '3.0 kW',
      badgeClass: 'bg-red-500/15 text-red-400 border-red-500/30',
      desc: 'O2 scrubbers, atmospheric pressurization, thermal loops. Never shed in survivable states.',
      highlight: true,
    },
    {
      priority: 2,
      name: 'Habitat systems',
      tier: 'High',
      need: '2.0 kW',
      badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      desc: 'Cabin lighting, air circulation, water recycling. Throttled to preserve life support.',
      highlight: false,
    },
    {
      priority: 3,
      name: 'Communication',
      tier: 'High',
      need: '1.2 kW',
      badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      desc: 'Earth high-gain dish throttled to emergency VHF beacon during power deficits.',
      highlight: false,
    },
    {
      priority: 4,
      name: 'Science experiments',
      tier: 'Lower',
      need: '1.0 kW',
      badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
      desc: 'Regolith spectrometers and drilling operations paused; samples safely insulated.',
      highlight: false,
    },
    {
      priority: 5,
      name: 'Rover',
      tier: 'Lowest',
      need: '0.8 kW',
      badgeClass: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
      desc: 'Dock charging cut first; pressurized rovers retain sufficient dormant internal reserves.',
      highlight: false,
    },
  ];

  return (
    <div className="min-h-screen spacegrid-pattern text-text flex flex-col selection:bg-demand/30 selection:text-text">
      {/* Top Navigation */}
      <nav aria-label="Global Navigation" className="w-full bg-bg-raised/95 border-b border-border sticky top-0 z-40 backdrop-blur-sm px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-demand/50 rounded-lg p-1">
            <div className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center text-solar shadow-inner group-hover:border-demand/40 transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" fill="#FFC857" fillOpacity="0.2" />
                <circle cx="12" cy="12" r="4" stroke="#FFC857" />
                <ellipse cx="12" cy="12" rx="9" ry="4.5" transform="rotate(-25 12 12)" stroke="#38BDF8" strokeDasharray="3 2" />
                <circle cx="19" cy="8.5" r="1.5" fill="#38BDF8" />
              </svg>
            </div>
            <div>
              <span className="font-heading font-bold text-sm tracking-wider text-text block">
                SPACEGRID AI
              </span>
              <span className="text-[10px] text-text-muted leading-none">
                Lunar Habitat Energy Advisor
              </span>
            </div>
          </Link>

          {/* Nav Links & CTA */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={scrollToHowItWorks}
              className="hidden sm:inline-block text-xs text-text-muted hover:text-text font-medium tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-demand/50 rounded px-2 py-1"
            >
              How It Works
            </button>

            <Link
              to="/console"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-demand hover:bg-sky-400 text-slate-950 font-heading font-semibold text-xs tracking-wider uppercase transition-all shadow-glow hover:shadow-lg active:scale-95 focus:outline-none focus:ring-2 focus:ring-demand focus:ring-offset-2 focus:ring-offset-bg"
            >
              <span>Open Mission Console</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section aria-labelledby="hero-heading" className="w-full pt-8 pb-14 md:py-20 px-4 lg:px-8 border-b border-border/60">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Text Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-700/80 text-text-muted text-[11px] font-mono tracking-wide">
              <span className="w-2 h-2 rounded-full bg-demand animate-pulse" />
              <span>DIGITAL TWIN · AUTONOMOUS ADVISORY SYSTEM</span>
            </div>

            <h1 id="hero-heading" className="font-heading font-extrabold text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight text-text leading-[1.1]">
              Predict. Protect. Explain.
            </h1>

            <p className="text-base sm:text-lg text-text-muted max-w-xl font-normal leading-relaxed">
              An advisory energy brain for Moon bases when solar power drops.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <Link
                to="/console"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-demand hover:bg-sky-400 text-slate-950 font-heading font-bold text-sm tracking-wider uppercase transition-all shadow-glow active:scale-95 focus:outline-none focus:ring-2 focus:ring-demand focus:ring-offset-2 focus:ring-offset-bg text-center"
              >
                <span>Open Mission Console</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>

              <button
                type="button"
                onClick={scrollToHowItWorks}
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-card hover:bg-bg-raised text-text border border-border text-xs font-semibold uppercase tracking-wider transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-demand/50 focus:ring-offset-1 focus:ring-offset-bg text-center"
              >
                <span>How it works</span>
                <ChevronDown className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
              </button>
            </div>

            {/* Quick Micro-Telemetry Badges */}
            <div className="pt-4 grid grid-cols-3 gap-2 border-t border-border/60 text-[11px] font-mono text-text-muted">
              <div>
                <span className="block font-bold text-text">MOON BASE ALPHA</span>
                <span>Virtual Digital Twin</span>
              </div>
              <div>
                <span className="block font-bold text-ok">ADVISORY MODE</span>
                <span>Flight Director Support</span>
              </div>
              <div>
                <span className="block font-bold text-solar">24H HORIZON</span>
                <span>PV Deficit Forecast</span>
              </div>
            </div>
          </div>

          {/* Right SVG Column */}
          <div className="lg:col-span-5 flex items-center justify-center">
            <div className="mission-card w-full p-2 sm:p-4 bg-card/60 shadow-card">
              <LunarHeroSvg />
              <div className="mt-2 text-center">
                <span className="telemetry-caption text-[10px]">
                  SOLAR OBSCURATION SIMULATION · HABITAT POWER MODEL
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 1: "How it works" */}
      <section id="how-it-works" aria-labelledby="how-it-works-heading" className="w-full py-16 px-4 lg:px-8 border-b border-border/60">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="telemetry-caption text-[11px] text-demand">SYSTEM WORKFLOW</span>
            <h2 id="how-it-works-heading" className="font-heading font-bold text-2xl sm:text-3xl text-text">
              How it works
            </h2>
            <p className="text-xs sm:text-sm text-text-muted">
              Five continuous steps that turn solar drops into actionable, transparent load-sharing advisories.
            </p>
          </div>

          {/* Horizontal Timeline */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.title}
                  className="mission-card p-4 sm:p-5 flex flex-col justify-between relative group hover:border-border/80 transition-all"
                >
                  <div>
                    {/* Step Number & Icon */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-xs font-bold text-text-muted group-hover:text-text transition-colors">
                        {step.num}
                      </span>
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center bg-bg-raised border border-border"
                        style={{ color: step.color }}
                      >
                        <Icon className="w-4 h-4" aria-hidden="true" />
                      </div>
                    </div>

                    <h3 className="font-heading font-bold text-sm text-text mb-2">
                      {step.title}
                    </h3>

                    <p className="text-xs text-text-muted leading-relaxed">
                      {step.desc}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/50 text-[10px] font-mono text-text-muted">
                    STEP {idx + 1} OF 5
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 2: "Who gets power first" */}
      <section aria-labelledby="priority-ladder-heading" className="w-full py-16 px-4 lg:px-8 border-b border-border/60">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="telemetry-caption text-[11px] text-solar">ALLOCATION MATRIX</span>
            <h2 id="priority-ladder-heading" className="font-heading font-bold text-2xl sm:text-3xl text-text">
              Who gets power first
            </h2>
            <p className="text-xs sm:text-sm text-text-muted">
              A strict survivability hierarchy enforced by the SPACEGRID optimizer.
            </p>
          </div>

          {/* Priority Ladder Stack */}
          <div className="max-w-4xl mx-auto space-y-3">
            {priorityLadder.map((load) => (
              <div
                key={load.name}
                className={`mission-card p-3.5 sm:p-4 transition-all ${
                  load.highlight
                    ? 'border-l-4 border-l-ok bg-bg-raised/80 shadow-glow'
                    : 'bg-card/70'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-text-muted w-6 text-center">
                      #{load.priority}
                    </span>
                    {load.highlight ? (
                      <Shield className="w-4 h-4 text-ok flex-shrink-0" aria-hidden="true" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-slate-600" />
                    )}
                    <span className="font-heading font-bold text-sm text-text">
                      {load.name}
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-semibold ${load.badgeClass}`}>
                      {load.tier}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-text-muted">Base need:</span>
                    <span className="font-mono-numbers font-bold text-text">{load.need}</span>
                  </div>
                </div>

                <p className="text-xs text-text-muted mt-2 sm:pl-9 leading-relaxed">
                  {load.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Note on why sharing power equally would starve life support */}
          <div className="max-w-4xl mx-auto p-4 sm:p-5 rounded-card bg-danger/10 border border-danger/30 text-xs text-text space-y-2">
            <div className="flex items-center gap-2 text-danger font-bold uppercase tracking-wider text-xs">
              <AlertOctagon className="w-4 h-4 flex-shrink-0 text-danger" aria-hidden="true" />
              <span>Why equal power sharing is catastrophic in space</span>
            </div>
            <p className="text-text-muted leading-relaxed">
              If an available 5.5 kW solar-battery supply is split equally across all five loads, each system receives only 1.1 kW.
              Because <strong>Life Support requires a minimum of 3.0 kW</strong> to operate oxygen generation and cabin pressurization loops,
              an equal split deprives Life Support of 63% of its vital power. Within hours, atmospheric scrubbers stall.
              SPACEGRID AI strictly prevents equal-split starvation by prioritizing mission survivability.
            </p>
          </div>
        </div>
      </section>

      {/* Section 3: "The human stays in control" */}
      <section aria-labelledby="human-control-heading" className="w-full py-16 px-4 lg:px-8 border-b border-border/60">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="telemetry-caption text-[11px] text-battery">FLIGHT OPERATOR GOVERNANCE</span>
            <h2 id="human-control-heading" className="font-heading font-bold text-2xl sm:text-3xl text-text">
              The human stays in control
            </h2>
            <p className="text-xs sm:text-sm text-text-muted">
              SPACEGRID AI is designed as a mission-control advisor, not an autonomous hardware actuator.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Card 1 */}
            <div className="mission-card p-5 space-y-3">
              <div className="w-9 h-9 rounded-lg bg-bg-raised border border-border flex items-center justify-center text-demand">
                <Cpu className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="font-heading font-bold text-base text-text">
                Advisory Mode Only
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Operating strictly as a software digital twin, the AI calculates recommendations without issuing commands to electrical relays.
              </p>
            </div>

            {/* Card 2 */}
            <div className="mission-card p-5 space-y-3">
              <div className="w-9 h-9 rounded-lg bg-bg-raised border border-border flex items-center justify-center text-ok">
                <UserCheck className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="font-heading font-bold text-base text-text">
                Approve & Reject Workflow
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Every re-plan requires human operator consent. Operators can approve, reject, or escalate plans in real time.
              </p>
            </div>

            {/* Card 3 */}
            <div className="mission-card p-5 space-y-3 border-amber-500/30">
              <div className="w-9 h-9 rounded-lg bg-bg-raised border border-border flex items-center justify-center text-solar">
                <Lock className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="font-heading font-bold text-base text-text">
                Digital Twin Boundaries
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                <strong className="text-text">Software prototype, not connected to real hardware.</strong> Designed to simulate habitat scenarios for lunar infrastructure readiness.
              </p>
            </div>
          </div>

          {/* Console CTA Banner */}
          <div className="max-w-3xl mx-auto p-6 rounded-card bg-bg-raised border border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div>
              <h3 className="font-heading font-bold text-base text-text">
                Ready to test solar drop telemetry?
              </h3>
              <p className="text-xs text-text-muted mt-1">
                Access the real-time advisor console, trigger a 70% drop, and evaluate power re-plans.
              </p>
            </div>
            <Link
              to="/console"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-demand hover:bg-sky-400 text-slate-950 font-heading font-semibold text-xs tracking-wider uppercase transition-all shadow-glow active:scale-95 flex-shrink-0"
            >
              <span>Launch Console</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full bg-bg-raised/90 border-t border-border py-8 px-4 lg:px-8 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted">
          <div className="flex items-center gap-3">
            <span className="font-heading font-bold text-text">SPACEGRID AI</span>
            <span>·</span>
            <span>Lunar Habitat Energy Advisor</span>
          </div>

          {/* Placeholders as requested */}
          <div className="flex items-center gap-4 text-center font-mono text-[11px]">
            <span className="px-2 py-0.5 rounded bg-card border border-border text-text">
              TEAM: [TEAM NAME]
            </span>
            <span className="px-2 py-0.5 rounded bg-card border border-border text-text">
              EVENT: [EVENT NAME]
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/console" className="hover:text-demand transition-colors">
              Mission Console
            </Link>
            <span className="text-[10px] text-text-muted/60">
              SEC-OP-2026-LUNAR-B
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
