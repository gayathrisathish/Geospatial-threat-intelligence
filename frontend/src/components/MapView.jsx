import { useRef, useState, useEffect, useMemo } from 'react';
import Globe from 'react-globe.gl';
import { cellToBoundary } from 'h3-js';
import * as THREE from 'three';

const MAX_POLYGONS = 300;

function getSignedRingArea(ring) {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function toGeoJsonRing(hexId) {
  const ring = cellToBoundary(hexId).map(([lat, lng]) => [lng, lat]);

  // Close the ring explicitly for GeoJSON consumers.
  if (ring.length > 0) {
    ring.push(ring[0]);
  }

  // Enforce clockwise winding for outer rings used by globe polygon triangulation.
  if (getSignedRingArea(ring) > 0) {
    ring.reverse();
  }

  return ring;
}

function scoreColor(score, alpha = 0.9) {
  if (score >= 75) return `rgba(239,68,68,${alpha})`;
  if (score >= 50) return `rgba(249,115,22,${alpha})`;
  if (score >= 25) return `rgba(234,179,8,${alpha})`;
  return `rgba(34,197,94,${alpha})`;
}

export default function MapView({ hexCells, selectedHex, onHexClick }) {
  const globeRef = useRef();
  const containerRef = useRef(null);
  const [globeReady, setGlobeReady] = useState(false);
  const [dimensions, setDimensions] = useState({
    width:
      typeof window !== 'undefined' ? Math.floor(window.innerWidth * 0.65) : 800,
    height: typeof window !== 'undefined' ? window.innerHeight : 600,
  });

  const cappedHexCells = useMemo(() => {
    if (!Array.isArray(hexCells)) return [];
    return hexCells.slice(0, MAX_POLYGONS);
  }, [hexCells]);

  // Memoize expensive h3 boundary calculations so they only run when hex input changes.
  const polygonData = useMemo(
    () =>
      cappedHexCells.map((cell) => ({
        ...cell,
        geoJson: {
          type: 'Polygon',
          coordinates: [toGeoJsonRing(cell.hex_id)],
        },
      })),
    [cappedHexCells]
  );

  useEffect(() => {
    if (!containerRef.current || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry?.contentRect) return;
      setDimensions({
        width: Math.max(1, Math.floor(entry.contentRect.width)),
        height: Math.max(1, Math.floor(entry.contentRect.height)),
      });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const initialFlyTimer = setTimeout(() => {
      globeRef.current?.pointOfView({ lat: 48, lng: 35, altitude: 2.5 }, 1000);
    }, 600);

    return () => {
      clearTimeout(initialFlyTimer);
    };
  }, []);

  useEffect(() => {
    if (!globeReady || !globeRef.current) return undefined;

    const controls = globeRef.current.controls();
    if (!controls) return undefined;

    controls.minDistance = 70;
    controls.maxDistance = 800;
    controls.zoomSpeed = 1.2;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.enablePan = false;
    controls.autoRotate = false;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    return undefined;
  }, [globeReady]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#dbeafe',
        touchAction: 'none',
      }}
    >
      {!globeReady && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            background: 'linear-gradient(180deg, #dbeafe 0%, #bfdbfe 100%)',
            fontFamily: 'monospace',
            color: '#0369a1',
            fontSize: '13px',
            letterSpacing: '0.15em',
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              border: '2px solid #0ea5e9',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: 16,
            }}
          />
          INITIALISING GLOBE...
          <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
        </div>
      )}

      <Globe
        ref={globeRef}
        enablePointerInteraction={true}
        width={dimensions.width}
        height={dimensions.height}
        globeImageUrl="https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        backgroundColor="#dbeafe"
        atmosphereColor="#93c5fd"
        atmosphereAltitude={0.12}
        polygonsData={polygonData}
        polygonGeoJsonGeometry={(d) => d.geoJson}
        polygonAltitude={(d) => {
          const base = d.threat_score / 60000;
          const anomalyBoost = d.anomaly_flag === 1 ? 2 : 1;
          const selectedBoost = d.hex_id === selectedHex?.hex_id ? 2.4 : 1;
          return base * anomalyBoost * selectedBoost;
        }}
        polygonCapColor={(d) =>
          d.hex_id === selectedHex?.hex_id ? scoreColor(d.threat_score, 0.35) : 'rgba(255,255,255,0.04)'
        }
        polygonSideColor={() => 'rgba(255,255,255,0.02)'}
        polygonStrokeColor={(d) =>
          d.hex_id === selectedHex?.hex_id
            ? '#ffffff'
            : d.anomaly_flag === 1
            ? scoreColor(d.threat_score, 0.85)
            : 'rgba(15,23,42,0.08)'
        }
        labelsData={cappedHexCells}
        labelLat={(d) => d.lat}
        labelLng={(d) => d.lng}
        labelText={() => ''}
        labelAltitude={(d) =>
          d.hex_id === selectedHex?.hex_id ? 0.01 : d.anomaly_flag === 1 ? 0.006 : 0.003
        }
        labelIncludeDot={true}
        labelDotRadius={(d) => {
          const base = 0.04 + d.threat_score / 6000;
          const anomalyBoost = d.anomaly_flag === 1 ? 1.2 : 1;
          const selectedBoost = d.hex_id === selectedHex?.hex_id ? 1.35 : 1;
          return base * anomalyBoost * selectedBoost;
        }}
        labelColor={(d) => scoreColor(d.threat_score, 0.95)}
        labelsTransitionDuration={250}
        polygonLabel={(d) => `
          <div style="
            background:#f8fafc;
            border:1px solid #cbd5e1;
            padding:6px 10px;
            border-radius:4px;
            font-family:monospace;
            font-size:12px;
            color:#0f172a;
          ">
            <div style="color:#64748b;font-size:10px">SECTOR</div>
            <div>${d.hex_id.slice(-4).toUpperCase()}</div>
            <div style="color:${
              d.threat_score >= 75
                ? '#ef4444'
                : d.threat_score >= 50
                ? '#f97316'
                : d.threat_score >= 25
                ? '#eab308'
                : '#22c55e'
            };font-size:16px;font-weight:bold">
              ${d.threat_score.toFixed(0)}
            </div>
            <div style="color:#64748b;font-size:10px">THREAT SCORE</div>
            ${d.anomaly_flag ? '<div style="color:#ef4444;margin-top:4px">ANOMALY</div>' : ''}
          </div>
        `}
        labelLabel={(d) => `
          <div style="
            background:#f8fafc;
            border:1px solid #cbd5e1;
            padding:6px 10px;
            border-radius:4px;
            font-family:monospace;
            font-size:12px;
            color:#0f172a;
          ">
            <div style="color:#64748b;font-size:10px">SECTOR</div>
            <div>${d.hex_id.slice(-4).toUpperCase()}</div>
            <div style="color:${
              d.threat_score >= 75
                ? '#ef4444'
                : d.threat_score >= 50
                ? '#f97316'
                : d.threat_score >= 25
                ? '#eab308'
                : '#22c55e'
            };font-size:16px;font-weight:bold">
              ${d.threat_score.toFixed(0)}
            </div>
            <div style="color:#64748b;font-size:10px">THREAT SCORE</div>
            ${d.anomaly_flag ? '<div style="color:#ef4444;margin-top:4px">ANOMALY</div>' : ''}
          </div>
        `}
        onPolygonClick={(d) => {
          globeRef.current?.pointOfView({ lat: d.lat, lng: d.lng, altitude: 1.2 }, 800);
          onHexClick(d);
        }}
        onLabelClick={(d) => {
          globeRef.current?.pointOfView({ lat: d.lat, lng: d.lng, altitude: 0.72 }, 900);
          onHexClick(d);
        }}
        polygonsTransitionDuration={300}
        onGlobeReady={() => setGlobeReady(true)}
      />
    </div>
  );
}
