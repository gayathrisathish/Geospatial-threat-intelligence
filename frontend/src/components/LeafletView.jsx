import { useEffect, useMemo } from 'react';
import { MapContainer, Polygon, TileLayer, Tooltip, ZoomControl, useMap } from 'react-leaflet';
import { cellToBoundary } from 'h3-js';
import { threatColor } from '../utils/colorScale.js';
import { formatHexId, formatScore } from '../utils/formatters.js';
import HexLegend from './HexLegend.jsx';

const DEFAULT_CENTER = [48.0, 35.0];
const DEFAULT_ZOOM = 5;

function clampZoom(zoom) {
  return Math.min(18, Math.max(3, zoom));
}

function asRgbaFromHex(hex, alpha) {
  const sanitized = hex.replace('#', '');
  const value = sanitized.length === 3
    ? sanitized.split('').map((ch) => ch + ch).join('')
    : sanitized;

  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function LeafletView({
  hexCells,
  selectedHex,
  onHexClick,
  initialCenter,
  initialZoom = 9,
}) {
  const polygonData = useMemo(
    () =>
      (Array.isArray(hexCells) ? hexCells : []).map((cell) => ({
        ...cell,
        positions: cellToBoundary(cell.hex_id).map(([lat, lng]) => [lat, lng]),
      })),
    [hexCells]
  );

  function MapCameraController() {
    const map = useMap();

    useEffect(() => {
      const target =
        selectedHex?.lat != null && selectedHex?.lng != null
          ? [selectedHex.lat, selectedHex.lng]
          : initialCenter?.lat != null && initialCenter?.lng != null
          ? [initialCenter.lat, initialCenter.lng]
          : DEFAULT_CENTER;

      const zoom =
        selectedHex?.lat != null && selectedHex?.lng != null
          ? 9
          : initialCenter?.lat != null && initialCenter?.lng != null
          ? clampZoom(initialZoom)
          : DEFAULT_ZOOM;

      map.flyTo(target, zoom, { duration: 1 });
    }, [map, selectedHex?.lat, selectedHex?.lng, initialCenter?.lat, initialCenter?.lng, initialZoom]);

    return null;
  }

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        minZoom={3}
        maxZoom={18}
        zoomControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors &copy; CARTO"
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <ZoomControl position="bottomright" />
        <MapCameraController />

        {polygonData.map((cell) => {
          const isSelected = cell.hex_id === selectedHex?.hex_id;
          const isAnomaly = cell.anomaly_flag === 1;
          const color = threatColor(cell.threat_score);

          return (
            <Polygon
              key={cell.hex_id}
              positions={cell.positions}
              pathOptions={{
                color: isSelected ? '#ffffff' : color,
                dashArray: !isSelected && isAnomaly ? '6,4' : undefined,
                weight: isSelected ? 3 : isAnomaly ? 1.5 : 1,
                fillColor: asRgbaFromHex(color, isSelected ? 0.42 : 0.26),
                fillOpacity: isSelected ? 0.5 : 0.28,
                opacity: isSelected ? 1 : 0.8,
              }}
              eventHandlers={{
                click: () => {
                  onHexClick(cell);
                },
              }}
            >
              <Tooltip direction="top" sticky>
                <div className="font-data text-[11px]">
                  <div>{formatHexId(cell.hex_id)}</div>
                  <div>Threat: {formatScore(cell.threat_score)}</div>
                </div>
              </Tooltip>
            </Polygon>
          );
        })}
      </MapContainer>

      <HexLegend />
    </div>
  );
}
