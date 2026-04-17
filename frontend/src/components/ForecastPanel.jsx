import { useState, useEffect } from 'react';
import { fetchForecast } from '../api.js';
import { formatForecastMetric } from '../services/forecast.js';
import { threatColor, threatLabel } from '../utils/colorScale.js';

export default function ForecastPanel({ selectedHex, hexCells, onForecastChange }) {
  const [forecast, setForecast] = useState(null);
  const [forecastError, setForecastError] = useState('');
  const [horizon, setHorizon] = useState(14); // 7, 14, or 30
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationDay, setAnimationDay] = useState(0);
  const [confidenceFilter, setConfidenceFilter] = useState(0.5);

  // Generate forecast when hex changes
  useEffect(() => {
    const loadForecast = async () => {
      if (!selectedHex) {
        setForecast(null);
        setForecastError('');
        return;
      }

      const { data, error } = await fetchForecast(selectedHex.hex_id);
      if (data) {
        setForecast(data);
        setForecastError('');
      } else {
        setForecast(null);
        setForecastError(error || 'Forecast unavailable');
      }

      setAnimationDay(0);
      setIsAnimating(false);
    };

    if (!selectedHex) {
      setForecast(null);
      setForecastError('');
      return;
    }

    loadForecast();
  }, [selectedHex]);

  // Handle animation loop
  useEffect(() => {
    if (!isAnimating || !forecast) return;

    const interval = setInterval(() => {
      setAnimationDay((prev) => {
        if (prev >= horizon) {
          setIsAnimating(false);
          return prev;
        }
        return prev + 1;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isAnimating, forecast, horizon]);

  if (!selectedHex) {
    return null;
  }

  if (!forecast) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-lg p-5 mb-4 text-white">
        <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 mb-3">
          Threat Propagation Forecast
        </h3>
        <p className="text-sm text-slate-300">Live forecast is unavailable right now.</p>
        {forecastError && <p className="text-xs text-red-300 mt-2">{forecastError}</p>}
        <p className="text-xs text-slate-400 mt-3">Ensure backend is running on port 8001 and models are trained.</p>
      </div>
    );
  }

  // Get forecast data for selected horizon
  const forecastKey =
    horizon === 7 ? 'day_7' : horizon === 14 ? 'day_14' : 'day_30';
  const forecastData = forecast.forecast[forecastKey];
  const currentScore = forecast.current_score;
  const projectedScore = forecastData.score;
  const escalationProb = forecastData.escalation_probability;
  const confidence = forecastData.confidence;

  // Determine if escalation is likely
  const isEscalating = projectedScore > currentScore;
  const escalationAmount = Math.abs(projectedScore - currentScore);

  // Filter influenced by confidence
  const influencedBy = forecast.influenced_by.filter(
    (inf) => inf.threat_level / 100 >= confidenceFilter
  );

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-lg p-5 mb-4 text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-700">
        <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400">
          Threat Propagation Forecast
        </h3>
        <div className="flex gap-1">
          <button
            onClick={() => {
              setIsAnimating(!isAnimating);
            }}
            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs font-semibold transition-colors"
            title={isAnimating ? 'Pause animation' : 'Play animation'}
          >
            {isAnimating ? '⏸' : '▶'}
          </button>
          <button
            onClick={() => {
              setAnimationDay(0);
              setIsAnimating(false);
            }}
            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs font-semibold transition-colors"
            title="Reset simulation"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Forecast Horizon Selector */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase">
          Forecast Horizon
        </label>
        <div className="flex gap-2">
          {[7, 14, 30].map((days) => (
            <button
              key={days}
              onClick={() => {
                setHorizon(days);
                setAnimationDay(0);
              }}
              className={`flex-1 py-2 px-3 rounded text-sm font-bold uppercase transition-all ${
                horizon === days
                  ? 'bg-cyan-500 text-slate-900'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>

      {/* Animation Day Display */}
      {isAnimating && (
        <div className="mb-3 p-2 bg-slate-700 rounded text-center">
          <span className="text-xs text-slate-300">Day</span>
          <div className="text-2xl font-bold text-cyan-400">{animationDay}</div>
        </div>
      )}

      {/* Score Comparison */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Current Score */}
        <div className="bg-slate-700 border border-slate-600 rounded p-3">
          <div className="text-xs text-slate-400 uppercase mb-1">Now</div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold" style={{ color: threatColor(currentScore) }}>
              {formatForecastMetric(currentScore, 'score')}
            </span>
            <span className="text-xs text-slate-500">/ 100</span>
          </div>
          <div className="text-xs mt-1 text-slate-400">
            {threatLabel(currentScore)}
          </div>
        </div>

        {/* Projected Score */}
        <div className="bg-slate-700 border border-slate-600 rounded p-3">
          <div className="text-xs text-slate-400 uppercase mb-1">
            Day {horizon}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold" style={{ color: threatColor(projectedScore) }}>
              {formatForecastMetric(projectedScore, 'score')}
            </span>
            <span className="text-xs text-slate-500">/ 100</span>
          </div>
          {isEscalating ? (
            <div className="text-xs mt-1 text-red-400 font-semibold">
              ↑ +{Math.round(escalationAmount)}
            </div>
          ) : (
            <div className="text-xs mt-1 text-green-400 font-semibold">
              ↓ -{Math.round(escalationAmount)}
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Escalation Probability */}
        <div>
          <label className="text-xs text-slate-400 uppercase mb-1 block">
            Escalation Risk
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-slate-700 rounded overflow-hidden">
              <div
                className="h-full bg-red-500 transition-all"
                style={{ width: `${escalationProb * 100}%` }}
              />
            </div>
            <span className="text-sm font-bold w-10 text-right">
              {formatForecastMetric(escalationProb, 'probability')}
            </span>
          </div>
        </div>

        {/* Confidence */}
        <div>
          <label className="text-xs text-slate-400 uppercase mb-1 block">
            Forecast Confidence
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-slate-700 rounded overflow-hidden">
              <div
                className="h-full bg-cyan-500 transition-all"
                style={{ width: `${confidence * 100}%` }}
              />
            </div>
            <span className="text-sm font-bold w-10 text-right">
              {formatForecastMetric(confidence, 'confidence')}
            </span>
          </div>
        </div>
      </div>

      {/* Confidence Filter */}
      <div className="mb-4 pb-4 border-b border-slate-700">
        <label className="text-xs text-slate-400 uppercase mb-2 block">
          Show neighbors with threat ≥ {Math.round(confidenceFilter * 100)}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={confidenceFilter * 100}
          onChange={(e) => setConfidenceFilter(parseInt(e.target.value) / 100)}
          className="w-full h-2 bg-slate-700 rounded appearance-none cursor-pointer accent-cyan-500"
        />
      </div>

      {/* Influenced By */}
      {influencedBy.length > 0 && (
        <div>
          <label className="text-xs text-slate-400 uppercase mb-2 block font-semibold">
            Influencing Sectors ({influencedBy.length})
          </label>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {influencedBy.map((inf) => (
              <div
                key={inf.hex_id}
                className="p-2 bg-slate-700 border border-slate-600 rounded text-xs"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono text-cyan-300">{inf.hex_id.slice(0, 8)}...</span>
                  <span className="font-bold" style={{ color: threatColor(inf.threat_level) }}>
                    {Math.round(inf.threat_level)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400 text-xs">
                  <span>{inf.distance_km.toFixed(0)} km away</span>
                  <span>+{Math.round(inf.contribution)} impact</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Notice */}
      <div className="mt-4 p-3 bg-cyan-900 border border-cyan-700 rounded text-xs text-cyan-200">
        <span className="font-semibold">Forecast Source:</span> Real backend GNN inference from /forecast.
      </div>
    </div>
  );
}
