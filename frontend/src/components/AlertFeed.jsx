import { threatColor } from '../utils/colorScale.js';
import { formatHexId, formatScore, formatTimeAgo } from '../utils/formatters.js';

export default function AlertFeed({ alerts, onAlertClick }) {
  const sortedAlerts = [...alerts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <div className="bg-white border-b border-slate-300 flex flex-col overflow-hidden min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Active Alerts</h2>
        <span className="inline-flex items-center justify-center min-w-7 h-7 rounded-md bg-red-100 text-red-700 text-xs font-bold px-2">
          {alerts.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {alerts.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            No alerts triggered
          </div>
        ) : (
          <div className="space-y-2">
            {sortedAlerts.slice(0, 10).map((alert) => {
              const col = threatColor(alert.threat_score);
              const alertType = alert.alert_type || 'MONITORING';

              return (
                <div
                  key={`${alert.hex_id}-${alert.created_at}`}
                  onClick={() => onAlertClick(alert.hex_id)}
                  className="p-3 bg-slate-50 hover:bg-slate-100 rounded-md cursor-pointer transition-colors border border-slate-200 border-l-4"
                  style={{ borderLeftColor: col }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-slate-500">
                      {formatHexId(alert.hex_id)}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatTimeAgo(alert.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold" style={{ color: col }}>
                      Score: {formatScore(alert.threat_score)}
                    </span>
                    <span className="text-xs font-bold uppercase text-slate-600">
                      {alertType}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
