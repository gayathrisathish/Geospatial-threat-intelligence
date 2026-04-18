export default function HexLegend() {
  return (
    <div className="absolute bottom-3 left-3 z-[1200] pointer-events-none">
      <div className="rounded-md border border-slate-600/70 bg-slate-100/92 px-3 py-2 text-[10px] text-slate-900 shadow-lg">
        <div className="font-data uppercase tracking-[0.14em] text-slate-700 mb-1">Hex Legend</div>
        <div className="space-y-1 font-data">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: '#22c55e' }}></span>
            <span>LOW (0-25)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: '#eab308' }}></span>
            <span>MODERATE (25-50)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: '#f97316' }}></span>
            <span>HIGH (50-75)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: '#ef4444' }}></span>
            <span>CRITICAL (75-100)</span>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-slate-700/70">
            <span className="inline-flex items-center justify-center w-3 h-3 border border-slate-700 border-dashed rounded-sm">⬡</span>
            <span>DASHED BORDER = ANOMALY</span>
          </div>
        </div>
      </div>
    </div>
  );
}
