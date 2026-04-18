import { useMemo } from 'react';

function threatTone(score) {
  if (score >= 75) {
    return {
      line: '#ef4444',
      glow: 'rgba(239, 68, 68, 0.25)',
      badge: 'CRITICAL',
      badgeClass: 'bg-red-500/25 text-red-200 border-red-400/40',
    };
  }

  if (score >= 50) {
    return {
      line: '#f97316',
      glow: 'rgba(249, 115, 22, 0.25)',
      badge: 'HIGH',
      badgeClass: 'bg-orange-500/25 text-orange-200 border-orange-300/40',
    };
  }

  if (score >= 25) {
    return {
      line: '#eab308',
      glow: 'rgba(234, 179, 8, 0.2)',
      badge: 'ELEVATED',
      badgeClass: 'bg-yellow-500/20 text-yellow-100 border-yellow-300/35',
    };
  }

  return {
    line: '#22c55e',
    glow: 'rgba(34, 197, 94, 0.2)',
    badge: 'STABLE',
    badgeClass: 'bg-emerald-500/20 text-emerald-100 border-emerald-300/35',
  };
}

export default function ThreatTicker({ hexCells, onSelectHex, selectedHexId }) {
  const tickerRows = useMemo(() => {
    const sorted = [...(hexCells || [])]
      .sort((a, b) => {
        if (b.anomaly_flag !== a.anomaly_flag) {
          return b.anomaly_flag - a.anomaly_flag;
        }
        return b.threat_score - a.threat_score;
      })
      .slice(0, 5);

    return sorted.map((cell) => {
      const tone = threatTone(cell.threat_score);
      const delta = (cell.threat_score - 50) * 0.32 + (cell.anomaly_flag ? 4.8 : -1.7);

      return {
        ...cell,
        delta,
        ...tone,
      };
    });
  }, [hexCells]);

  if (!tickerRows.length) {
    return (
      <div className="h-[88px] border-t border-slate-700 bg-slate-900 flex items-center px-4 text-slate-300 text-sm uppercase tracking-[0.12em]">
        Awaiting live conflict intensity feed...
      </div>
    );
  }

  const scrollingRows = [...tickerRows, ...tickerRows];

  return (
    <div className="h-[74px] border-t border-slate-700 bg-slate-900 text-slate-100 overflow-hidden">
      <div className="ops-ticker-track h-full flex items-center gap-3 px-3">
        {scrollingRows.map((cell, idx) => (
          <button
            key={`${cell.hex_id}-${idx}`}
            type="button"
            onClick={() => onSelectHex?.(cell)}
            className={`w-[360px] h-[54px] shrink-0 rounded-md border bg-slate-800/80 backdrop-blur-sm px-3 py-2 flex items-center justify-between text-left transition-colors ${
              selectedHexId === cell.hex_id
                ? 'border-cyan-300/70 ring-1 ring-cyan-300/60'
                : 'border-slate-600/60 hover:border-slate-400/80'
            }`}
            title={`Focus sector ${cell.hex_id}`}
          >
            <div className="min-w-0 flex items-center gap-3">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cell.badgeClass}`}>
                {cell.badge}
              </span>
              <span className="text-[11px] font-semibold tracking-[0.14em] text-slate-300">
                SECTOR {cell.hex_id.slice(-4).toUpperCase()}
              </span>
              <span className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
                Intensity
              </span>
              <span className="text-sm font-semibold" style={{ color: cell.line }}>
                {cell.threat_score.toFixed(0)}
              </span>
            </div>
            <div className="flex items-center gap-3 pl-3 border-l border-slate-600/70">
              <span className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Trend</span>
              <span className={`text-xs font-semibold ${cell.delta >= 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                {cell.delta >= 0 ? 'UP ' : 'DOWN '}
                {cell.delta >= 0 ? '+' : ''}{cell.delta.toFixed(1)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
