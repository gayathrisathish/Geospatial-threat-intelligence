import { formatDate } from '../utils/formatters.js';

export default function Navbar({ lastUpdated, hexCount, anomalyCount }) {
  return (
    <nav className="bg-white border-b border-slate-300 px-4 md:px-6 py-3">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 leading-none">GeoSentinel</h1>
          <p className="text-[11px] text-slate-500 uppercase tracking-[0.12em] mt-1">Threat Intelligence Dashboard</p>
        </div>

        <div className="flex items-center gap-2 md:gap-3 flex-wrap lg:justify-center">
          <div className="px-3 py-2 rounded-md bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
            SECTORS: <span className="text-slate-900">{hexCount}</span>
          </div>
          <div className={`px-3 py-2 rounded-md border text-xs font-semibold ${anomalyCount > 0 ? 'bg-red-50 border-red-200 text-red-600' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
            ANOMALIES: <span>{anomalyCount}</span>
          </div>
          <div className="px-3 py-2 rounded-md bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
            UPDATED: <span className="font-mono text-slate-900">{formatDate(lastUpdated)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 lg:justify-end">
          <span className="inline-block w-2.5 h-2.5 bg-emerald-500 rounded-full pulse-dot"></span>
          <span className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Live</span>
        </div>
      </div>
    </nav>
  );
}
