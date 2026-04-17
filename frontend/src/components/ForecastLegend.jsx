/**
 * Forecast Legend Component
 * Explains the propagation visualization on the map
 */

export default function ForecastLegend() {
  return (
    <div className="absolute bottom-4 left-4 bg-white border-2 border-slate-300 rounded-lg shadow-lg p-3 max-w-xs z-[400] text-xs">
      <h4 className="font-bold text-slate-900 mb-2 uppercase tracking-wide">Map Risk Legend</h4>

      <div className="space-y-2 text-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#22c55e' }}></div>
          <span>Low risk</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f97316' }}></div>
          <span>Medium risk</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }}></div>
          <span>High risk</span>
        </div>
      </div>

      <div className="border-t border-slate-200 mt-2 pt-2">
        <p className="text-slate-600 text-xs">
          Dashed rings show the selected sector's projected influence zone.
        </p>
      </div>
    </div>
  );
}
