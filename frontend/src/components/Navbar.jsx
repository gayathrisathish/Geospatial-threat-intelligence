import { useEffect, useMemo, useState } from 'react';

const COUNTER_DURATION_MS = 1500;
const STAT_TARGETS = {
  sectors: 247,
  anomalies: 12,
  events: 891,
};

function padCount(value, size) {
  return Math.max(0, Math.round(value)).toString().padStart(size, '0');
}

function formatIstClock(date) {
  return date.toLocaleTimeString('en-GB', {
    hour12: false,
    timeZone: 'Asia/Kolkata',
  });
}

export default function Navbar({ viewMode = 'globe', onViewModeChange }) {
  const [clock, setClock] = useState(() => new Date());
  const [counters, setCounters] = useState({ sectors: 0, anomalies: 0, events: 0 });

  useEffect(() => {
    const start = performance.now();
    let frameId = null;

    const tick = (timestamp) => {
      const progress = Math.min(1, (timestamp - start) / COUNTER_DURATION_MS);
      const eased = 1 - Math.pow(1 - progress, 3);

      setCounters({
        sectors: STAT_TARGETS.sectors * eased,
        anomalies: STAT_TARGETS.anomalies * eased,
        events: STAT_TARGETS.events * eased,
      });

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setClock(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const clockText = useMemo(() => formatIstClock(clock), [clock]);

  return (
    <nav className="bg-slate-900 border-b border-slate-700 px-4 md:px-6 py-3.5 text-slate-100">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-[220px]">
          <span className="signal-dot-pulse inline-block w-2.5 h-2.5 bg-red-500 rounded-full" />
          <div>
            <h1
              className="font-ui text-xl leading-none tracking-[0.24em] text-slate-100 uppercase"
              style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700 }}
            >
              GeoSentinel
            </h1>
            <p
              className="font-data text-[10px] text-slate-400 uppercase tracking-[0.26em] mt-1"
              style={{ fontFamily: 'Share Tech Mono, monospace' }}
            >
              Threat Intelligence Dashboard
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full xl:w-auto xl:min-w-[620px]">
          <div className="px-3 py-2.5 rounded-md bg-slate-800 border border-slate-600/80">
            <div className="font-ui text-[10px] uppercase tracking-[0.16em] text-slate-400">Sectors Monitored</div>
            <div
              className="font-data text-xl text-slate-100"
              style={{ fontFamily: 'Share Tech Mono, monospace' }}
            >
              {padCount(counters.sectors, 3)}
            </div>
          </div>
          <div className="px-3 py-2.5 rounded-md bg-red-950/30 border border-red-500/50">
            <div className="font-ui text-[10px] uppercase tracking-[0.16em] text-red-200">Anomalies Detected</div>
            <div
              className="font-data text-xl text-red-300"
              style={{ fontFamily: 'Share Tech Mono, monospace' }}
            >
              {padCount(counters.anomalies, 2)}
            </div>
          </div>
          <div className="px-3 py-2.5 rounded-md bg-slate-800 border border-slate-600/80">
            <div className="font-ui text-[10px] uppercase tracking-[0.16em] text-slate-400">Threat Events</div>
            <div
              className="font-data text-xl text-slate-100"
              style={{ fontFamily: 'Share Tech Mono, monospace' }}
            >
              {padCount(counters.events, 3)}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start xl:items-end min-w-[220px] gap-1.5">
          <div className="inline-flex items-center rounded-full border border-slate-600 bg-slate-800/80 p-1">
            <button
              type="button"
              onClick={() => onViewModeChange?.('globe')}
              className={`px-3 py-1 text-[11px] uppercase tracking-[0.12em] rounded-full font-ui transition-colors ${
                viewMode === 'globe'
                  ? 'bg-cyan-500/30 text-cyan-100'
                  : 'text-slate-300 hover:text-slate-100'
              }`}
            >
              🌍 Globe
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange?.('map')}
              className={`px-3 py-1 text-[11px] uppercase tracking-[0.12em] rounded-full font-ui transition-colors ${
                viewMode === 'map'
                  ? 'bg-cyan-500/30 text-cyan-100'
                  : 'text-slate-300 hover:text-slate-100'
              }`}
            >
              🗺 Map
            </button>
          </div>
          <div
            className="font-data text-base text-cyan-300 tracking-[0.08em]"
            style={{ fontFamily: 'Share Tech Mono, monospace' }}
          >
            IST {clockText}
          </div>
          <div className="font-ui text-[10px] uppercase tracking-[0.14em] gs-accent-amber mt-0.5">
            Classification: Unclassified // Demo
          </div>
        </div>
      </div>
    </nav>
  );
}
