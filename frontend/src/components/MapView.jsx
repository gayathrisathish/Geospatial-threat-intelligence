import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Tooltip, Circle, useMap } from 'react-leaflet';
import { cellToBoundary } from 'h3-js';
import { severityBucket, threatColor, threatPlainLabel } from '../utils/colorScale.js';
import { formatHexId, formatScore } from '../utils/formatters.js';
import { generateForecastForHex, generatePropagationFrames } from '../services/forecast.js';
import ForecastLegend from './ForecastLegend.jsx';

function FitToHexCells({ hexCells }) {
  const map = useMap();

  useEffect(() => {
    if (!hexCells?.length) return;

    const bounds = hexCells
      .filter((cell) => Number.isFinite(cell.lat) && Number.isFinite(cell.lng))
      .map((cell) => [cell.lat, cell.lng]);

    if (!bounds.length) return;
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 9 });
  }, [map, hexCells]);

  return null;
}

/**
 * Propagation Visualization Layer
 * Shows circles and halos around selected hex to visualize threat spread
 */
function PropagationOverlay({ selectedHex, hexCells }) {
  const [forecast, setForecast] = useState(null);

  useEffect(() => {
    if (!selectedHex || !hexCells) {
      setForecast(null);
      return;
    }

    const data = generateForecastForHex(selectedHex.hex_id, hexCells);
    setForecast(data);
  }, [selectedHex, hexCells]);

  if (!forecast) return null;

  // Create concentric circles showing threat spread zones
  const ringRadii = [50, 100, 150]; // km
  const ringOpacities = [0.3, 0.2, 0.1];

  return (
    <>
      {/* Propagation rings */}
      {ringRadii.map((radius, idx) => (
        <Circle
          key={`ring-${idx}`}
          center={[selectedHex.lat, selectedHex.lng]}
          radius={radius * 1000} // Convert km to meters for Leaflet
          pathOptions={{
            fillColor: '#0891b2', // cyan
            fillOpacity: ringOpacities[idx],
            color: '#0891b2',
            weight: 1,
            dashArray: '5, 5',
            lineCap: 'round',
          }}
        />
      ))}

      {/* Central glow for selected hex */}
      <Circle
        center={[selectedHex.lat, selectedHex.lng]}
        radius={15000} // 15 km glow radius
        pathOptions={{
          fillColor: threatColor(forecast.current_score),
          fillOpacity: 0.15,
          color: 'transparent',
          weight: 0,
        }}
      />
    </>
  );
}

export default function MapView({ hexCells, selectedHex, onHexClick, isLoading }) {
  const [forecastFrames, setForecastFrames] = useState([]);

  useEffect(() => {
    if (!selectedHex || !hexCells) {
      setForecastFrames([]);
      return;
    }
    const frames = generatePropagationFrames(selectedHex.hex_id, hexCells);
    setForecastFrames(frames);
  }, [selectedHex, hexCells]);

  return (
    <div className="w-full h-full relative">
      {isLoading && (
        <div className="absolute inset-0 z-[1200] bg-slate-100/80 flex items-center justify-center">
          <div className="text-sm text-slate-700 font-semibold">Loading sectors...</div>
        </div>
      )}

      <MapContainer
        center={[24.8, 93.9]}
        zoom={7}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; CartoDB contributors'
        />
        <FitToHexCells hexCells={hexCells} />
        <PropagationOverlay selectedHex={selectedHex} hexCells={hexCells} />

        {hexCells.map((cell) => {
          const boundary = cellToBoundary(cell.hex_id);
          // h3-js returns [lat, lng] pairs, Leaflet expects [lat, lng]
          const positions = boundary;

          const isSelected = cell.hex_id === selectedHex?.hex_id;
          const isAnomaly = cell.anomaly_flag === 1;

          let borderColor = 'transparent';
          let borderWeight = 0;
          let borderDashArray = undefined;

          if (isSelected) {
            borderColor = '#0f172a';
            borderWeight = 3.2;
          } else if (isAnomaly) {
            borderColor = '#334155';
            borderWeight = 1.8;
            borderDashArray = '4';
          }

          const riskLabel = threatPlainLabel(cell.threat_score);
          const severity = severityBucket(cell.threat_score);
          const tooltipSummary =
            severity === 'high'
              ? 'Immediate monitoring recommended.'
              : severity === 'medium'
              ? 'Watch for escalation signals.'
              : 'Stable sector with low immediate concern.';

          return (
            <Polygon
              key={cell.hex_id}
              positions={positions}
              fillColor={threatColor(cell.threat_score)}
              fillOpacity={0.58}
              color={borderColor}
              weight={borderWeight}
              dashArray={borderDashArray}
              interactive={true}
              eventHandlers={{
                click: () => onHexClick(cell),
              }}
            >
              <Tooltip direction="center" permanent={false} offset={[0, 0]}>
                <div className="text-xs leading-snug">
                  <div className="font-semibold text-slate-900">{formatHexId(cell.hex_id)}</div>
                  <div className="text-slate-700">{riskLabel} (Score {formatScore(cell.threat_score)})</div>
                  <div className="text-slate-500">{tooltipSummary}</div>
                </div>
              </Tooltip>
            </Polygon>
          );
        })}

        {selectedHex && (
          <Circle
            center={[selectedHex.lat, selectedHex.lng]}
            radius={7000}
            pathOptions={{
              fillOpacity: 0,
              color: '#0f172a',
              weight: 2,
            }}
          />
        )}
      </MapContainer>

      {selectedHex && (
        <div className="absolute top-4 left-4 z-[450] bg-white border border-slate-300 rounded-md px-3 py-2 shadow text-xs text-slate-700">
          <div className="uppercase tracking-wide text-[10px] text-slate-500">Pinned sector</div>
          <div className="font-semibold text-slate-900">{formatHexId(selectedHex.hex_id)}</div>
          <div>{threatPlainLabel(selectedHex.threat_score)}</div>
        </div>
      )}

      {/* Forecast Legend */}
      {selectedHex && <ForecastLegend />}
    </div>
  );
}
