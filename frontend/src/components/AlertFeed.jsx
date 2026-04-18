import { useEffect, useMemo, useRef, useState } from 'react';
import { threatColor, threatLabel } from '../utils/colorScale.js';
import { formatHexId, formatScore, formatTimeAgo } from '../utils/formatters.js';

export default function AlertFeed({ alerts, onAlertClick, onOpenAlerts }) {
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [freshAlertIds, setFreshAlertIds] = useState(() => new Set());
  const seenIdsRef = useRef(new Set());

  const sortedAlerts = useMemo(
    () => [...alerts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 14),
    [alerts]
  );

  useEffect(() => {
    const createdFresh = [];
    sortedAlerts.forEach((alert) => {
      const alertId = `${alert.hex_id}-${alert.created_at}`;
      if (!seenIdsRef.current.has(alertId)) {
        createdFresh.push(alertId);
        seenIdsRef.current.add(alertId);
      }
    });

    if (createdFresh.length === 0) return;

    setFreshAlertIds((prev) => {
      const next = new Set(prev);
      createdFresh.forEach((id) => next.add(id));
      return next;
    });

    if (soundEnabled) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (AudioCtor) {
        const ctx = new AudioCtor();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.value = 740;
        gain.gain.value = 0.02;
        osc.start();
        osc.stop(ctx.currentTime + 0.065);
      }
    }

    const timer = setTimeout(() => {
      setFreshAlertIds((prev) => {
        const next = new Set(prev);
        createdFresh.forEach((id) => next.delete(id));
        return next;
      });
    }, 1300);

    return () => clearTimeout(timer);
  }, [sortedAlerts, soundEnabled]);

  const tickerRows = useMemo(() => {
    return sortedAlerts.map((alert) => {
      const alertId = `${alert.hex_id}-${alert.created_at}`;
      const severity = threatLabel(alert.threat_score);
      const color = threatColor(alert.threat_score);
      return {
        ...alert,
        alertId,
        severity,
        color,
      };
    });
  }, [sortedAlerts]);

  if (!tickerRows.length) {
    return (
      <aside className="h-full bg-slate-900 border-l border-slate-700 p-3 flex flex-col">
        <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 mb-3">Live Alert Rail</div>
        <div className="flex-1 rounded border border-slate-700 bg-slate-800/60 flex items-center justify-center px-2 text-center text-xs text-slate-400">
          No live alerts yet.
        </div>
      </aside>
    );
  }

  const loopRows = [...tickerRows, ...tickerRows];

  return (
    <aside className="h-full bg-slate-900 border-l border-slate-700 flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between">
        <button
          onClick={onOpenAlerts}
          className="text-[10px] uppercase tracking-[0.14em] text-slate-200 font-semibold hover:text-white transition-colors"
        >
          Live Alert Rail ({alerts.length})
        </button>
        <button
          type="button"
          onClick={() => setSoundEnabled((v) => !v)}
          className={`text-[10px] px-2 py-1 rounded border uppercase tracking-[0.12em] transition-colors ${
            soundEnabled
              ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
              : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-400'
          }`}
          title="Toggle alert beep"
        >
          Sound {soundEnabled ? 'On' : 'Off'}
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <div className="alert-vertical-track flex flex-col gap-2 p-2">
          {loopRows.map((alert, idx) => {
            const isFresh = freshAlertIds.has(alert.alertId);
            const isAnomaly = alert.anomaly_flag === 1;

            return (
              <button
                key={`${alert.alertId}-${idx}`}
                type="button"
                onClick={() => onAlertClick?.(alert.hex_id)}
                className={`text-left rounded border border-slate-700/80 bg-slate-800/85 p-2.5 transition-colors hover:bg-slate-700/90 ${
                  isFresh ? 'alert-entry-flash' : ''
                } ${isAnomaly ? 'alert-anomaly-pulse' : ''}`}
                style={{ borderLeft: `4px solid ${alert.color}` }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: alert.color }}>
                    {alert.severity}
                  </span>
                  <span className="text-[10px] text-slate-300">{formatTimeAgo(alert.created_at)}</span>
                </div>
                <div className="text-xs text-slate-100 font-semibold mb-1">{formatHexId(alert.hex_id)}</div>
                <div className="text-[10px] text-slate-300 uppercase tracking-[0.08em]">
                  Score {formatScore(alert.threat_score)}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
