/**
 * Forecast Legend Component
 * Explains the propagation visualization on the map
 */

export default function ForecastLegend() {
  return (
    <div className="absolute bottom-4 left-4 bg-white border-2 border-slate-300 rounded-lg shadow-lg p-3 max-w-xs z-[400] text-xs">
      <h4 className="font-bold text-slate-900 mb-2 uppercase tracking-wide">Threat Propagation</h4>
      
      <div className="space-y-2 text-slate-700">
        {/* Current Threat */}
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#ef4444' }}></div>
          <span>Current Threat (selected hex)</span>
        </div>

        {/* Propagation Rings */}
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-cyan-500" style={{ borderDasharray: '2,2' }}></div>
          <span>Spread zone (50-150 km)</span>
        </div>

        {/* Glow */}
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full opacity-30" style={{ backgroundColor: '#0891b2' }}></div>
          <span>Influence radius</span>
        </div>
      </div>

      <div className="border-t border-slate-200 mt-2 pt-2">
        <p className="text-slate-600 text-xs italic">
          Click a sector to see its 7/14/30-day threat propagation forecast.
        </p>
      </div>
    </div>
  );
}
