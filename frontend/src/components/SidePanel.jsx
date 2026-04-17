import { threatColor, threatLabel } from '../utils/colorScale.js';
import { formatHexId, formatScore, formatSignal, formatDate } from '../utils/formatters.js';
import ForecastPanel from './ForecastPanel.jsx';

export default function SidePanel({ selectedHex, hexDetail, onGenerateSitrep, onOpenChat, hexCells }) {
  if (!selectedHex) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-50 text-slate-500 p-8">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 9l6-6m0 0l6 6m-6-6v12m0 0l-6-6m6 6l6-6" />
          </svg>
          <p className="text-sm">Click any sector on the map to inspect</p>
        </div>
      </div>
    );
  }

  const isLoading = !hexDetail;
  const score = selectedHex.threat_score;
  const threatCol = threatColor(score);
  const threatLab = threatLabel(score);

  const normalizedSignal = (key, value) => {
    if (key === 'conflict_intensity') return Math.min(100, Math.max(0, value * 100));
    if (key === 'total_fatalities') return Math.min(100, Math.max(0, (value / 300) * 100));
    if (key === 'firms_signal') return Math.min(100, Math.max(0, value));
    if (key === 'gdelt_sentiment') return Math.min(100, Math.max(0, ((-value + 1) / 11) * 100));
    return 0;
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 md:p-5">
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-4">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">
              Sector
            </div>
            <div className="text-sm font-semibold text-slate-900">
              {formatHexId(selectedHex.hex_id)}
            </div>
          </div>
          <span
            className="px-3 py-1 rounded text-xs font-bold text-white uppercase"
            style={{ backgroundColor: threatCol }}
          >
            {threatLab}
          </span>
        </div>

        <div className="p-4 text-center">
          <div className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Threat Score</div>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-5xl font-bold" style={{ color: threatCol }}>
              {formatScore(score)}
            </span>
            <span className="text-xl text-slate-400">/ 100</span>
          </div>
        </div>

        {selectedHex.anomaly_flag === 1 && (
          <div className="px-4 py-3 border-t border-slate-200 bg-red-50">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 bg-red-500 rounded-full pulse-dot"></span>
              <span className="text-sm font-semibold text-red-700 uppercase tracking-wide">Anomaly Detected</span>
            </div>
          </div>
        )}
      </div>

      {/* Threat Propagation Forecast Section */}
      <ForecastPanel selectedHex={selectedHex} hexCells={hexCells} />

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
        <section className="bg-white border border-slate-200 rounded-lg p-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3">Intelligence Signals</h3>
          <div className="space-y-3">
            {Object.entries(selectedHex.signals).map(([key, value]) => {
              const barPercent = normalizedSignal(key, value);
              const isHighThreat = barPercent > 70;
              const barColor = isHighThreat ? '#ef4444' : '#f97316';

              return (
                <div key={key}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-600">{formatSignal(key, value)}</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded overflow-hidden">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${barPercent}%`,
                        backgroundColor: barColor,
                        opacity: 0.65 + (barPercent / 100) * 0.35,
                      }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3">Recent Events</h3>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 bg-slate-200 rounded opacity-50 animate-pulse"></div>
              ))}
            </div>
          ) : hexDetail?.recent_events && hexDetail.recent_events.length > 0 ? (
            <div className="space-y-2">
              {hexDetail.recent_events.slice(0, 5).map((event) => (
                <div key={event.id} className="text-xs p-3 bg-slate-50 border border-slate-200 rounded">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-mono text-slate-500">{formatDate(event.event_date)}</span>
                    {event.fatalities > 0 && (
                      <span className="text-red-600 font-semibold">{event.fatalities} fatalities</span>
                    )}
                  </div>
                  <div className="text-slate-700">{event.event_type}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No events recorded</p>
          )}
        </section>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          onClick={onGenerateSitrep}
          className="w-full bg-red-700 hover:bg-red-800 text-white font-semibold py-2.5 px-4 rounded text-sm uppercase tracking-wide transition-colors"
        >
          Generate SITREP
        </button>
        <button
          onClick={onOpenChat}
          className="w-full bg-slate-700 hover:bg-slate-800 text-white font-semibold py-2.5 px-4 rounded text-sm uppercase tracking-wide transition-colors"
        >
          Ask Analyst
        </button>
      </div>
    </div>
  );
}
