import { useRef, useState, useEffect, useMemo } from 'react';
import Globe from 'react-globe.gl';
import { cellToBoundary } from 'h3-js';
import * as THREE from 'three';
import HexLegend from './HexLegend.jsx';

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

  if (ring.length > 0) {
    ring.push(ring[0]);
  }

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

export default function MapView({ hexCells, selectedHex, onHexClick, onSwitchToMap }) {
  const globeRef = useRef();
  const containerRef = useRef(null);
  const hasAnimatedInRef = useRef(false);
  const [globeReady, setGlobeReady] = useState(false);
  const [altitudeIntroProgress, setAltitudeIntroProgress] = useState(0);
  const [dimensions, setDimensions] = useState({
    width:
      typeof window !== 'undefined' ? Math.floor(window.innerWidth * 0.65) : 800,
    height: typeof window !== 'undefined' ? window.innerHeight : 600,
  });

  const cappedHexCells = useMemo(() => {
    if (!Array.isArray(hexCells)) return [];
    return hexCells.slice(0, MAX_POLYGONS);
  }, [hexCells]);

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

  const threatRingData = useMemo(() => {
    const dangerousCells = cappedHexCells
      .filter((cell) => cell.threat_score >= 50)
      .sort((a, b) => b.threat_score - a.threat_score)
      .slice(0, 18);

    const ringOffsets = [0, 380];

    return dangerousCells.flatMap((cell) => {
      const isCritical = cell.threat_score >= 75;
      const baseRadius = isCritical ? 1.35 : 1.0;
      const basePeriod = isCritical ? 1300 : 1550;
      const speed = isCritical ? 0.7 : 0.55;

      return ringOffsets.map((phase) => ({
        id: `${cell.hex_id}-${phase}`,
        lat: cell.lat,
        lng: cell.lng,
        maxRadius: baseRadius,
        propagationSpeed: speed,
        repeatPeriod: basePeriod + phase,
        color: isCritical
          ? ['rgba(239,68,68,0.9)', 'rgba(239,68,68,0.0)']
          : ['rgba(249,115,22,0.85)', 'rgba(249,115,22,0.0)'],
      }));
    });
  }, [cappedHexCells]);

  const arcConnections = useMemo(() => {
    const anomalyCells = cappedHexCells
      .filter((cell) => cell.anomaly_flag === 1)
      .sort((a, b) => b.threat_score - a.threat_score)
      .slice(0, 14);

    const toRadians = (value) => (value * Math.PI) / 180;
    const haversineKm = (a, b) => {
      const earthRadiusKm = 6371;
      const dLat = toRadians(b.lat - a.lat);
      const dLng = toRadians(b.lng - a.lng);
      const sinLat = Math.sin(dLat / 2);
      const sinLng = Math.sin(dLng / 2);
      const factor =
        sinLat * sinLat +
        Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * sinLng * sinLng;
      return earthRadiusKm * 2 * Math.atan2(Math.sqrt(factor), Math.sqrt(1 - factor));
    };

    const links = [];
    for (let i = 0; i < anomalyCells.length; i += 1) {
      for (let j = i + 1; j < anomalyCells.length; j += 1) {
        const source = anomalyCells[i];
        const target = anomalyCells[j];
        const distanceKm = haversineKm(source, target);

        if (distanceKm > 180) continue;

        const severity = Math.max(source.threat_score, target.threat_score);
        links.push({
          id: `${source.hex_id}->${target.hex_id}`,
          startLat: source.lat,
          startLng: source.lng,
          endLat: target.lat,
          endLng: target.lng,
          severity,
          distanceKm,
        });
      }
    }

    return links
      .sort((a, b) => b.severity - a.severity || a.distanceKm - b.distanceKm)
      .slice(0, 14);
  }, [cappedHexCells]);

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
      if (selectedHex?.lat != null && selectedHex?.lng != null) {
        globeRef.current?.pointOfView(
          { lat: selectedHex.lat, lng: selectedHex.lng, altitude: 1.15 },
          1000
        );
        return;
      }

      globeRef.current?.pointOfView({ lat: 48, lng: 35, altitude: 2.5 }, 1000);
    }, 600);

    return () => {
      clearTimeout(initialFlyTimer);
    };
  }, [selectedHex]);

  useEffect(() => {
    if (!globeReady || !globeRef.current) return;
    if (selectedHex?.lat == null || selectedHex?.lng == null) return;

    globeRef.current.pointOfView(
      { lat: selectedHex.lat, lng: selectedHex.lng, altitude: 1.15 },
      1000
    );
  }, [globeReady, selectedHex]);

  useEffect(() => {
    if (hasAnimatedInRef.current || polygonData.length === 0) {
      if (polygonData.length > 0) {
        setAltitudeIntroProgress(1);
      }
      return undefined;
    }

    hasAnimatedInRef.current = true;
    const start = performance.now();
    const durationMs = 1500;
    let frameId = null;

    const animate = (timestamp) => {
      const elapsed = timestamp - start;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setAltitudeIntroProgress(eased);

      if (t < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  }, [polygonData]);

  useEffect(() => {
    if (!globeReady || !globeRef.current) return undefined;

    const controls = globeRef.current.controls();
    const globeMaterial =
      typeof globeRef.current.globeMaterial === 'function'
        ? globeRef.current.globeMaterial()
        : null;
    if (!controls) return undefined;

    if (globeMaterial) {
      globeMaterial.emissive = new THREE.Color('#1d4ed8');
      globeMaterial.emissiveIntensity = 0.22;
      globeMaterial.shininess = 1.4;
    }

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
        atmosphereColor="#1d4ed8"
        atmosphereAltitude={0.25}
        polygonsData={polygonData}
        polygonGeoJsonGeometry={(d) => d.geoJson}
        polygonAltitude={(d) => {
          const base = d.threat_score / 110000;
          const anomalyBoost = d.anomaly_flag === 1 ? 1.4 : 1;
          const selectedBoost = d.hex_id === selectedHex?.hex_id ? 1.7 : 1;
          const cinematicBoost = 1.1;
          return base * anomalyBoost * selectedBoost * cinematicBoost * altitudeIntroProgress;
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
        arcsData={arcConnections}
        arcStartLat={(d) => d.startLat}
        arcStartLng={(d) => d.startLng}
        arcEndLat={(d) => d.endLat}
        arcEndLng={(d) => d.endLng}
        arcColor={(d) =>
          d.severity >= 75 ? ['rgba(251,146,60,0.45)', 'rgba(239,68,68,0.55)'] : ['rgba(251,146,60,0.25)', 'rgba(249,115,22,0.35)']
        }
        arcAltitude={(d) => Math.max(0.008, Math.min(0.028, 0.008 + d.distanceKm / 12000))}
        arcStroke={0.03}
        ringsData={threatRingData}
        ringLat={(d) => d.lat}
        ringLng={(d) => d.lng}
        ringColor={(d) => d.color}
        ringMaxRadius={(d) => d.maxRadius}
        ringPropagationSpeed={(d) => d.propagationSpeed}
        ringRepeatPeriod={(d) => d.repeatPeriod}
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
            <div style="color:#64748b;font-size:10px;margin-top:2px">${Math.abs(d.lat).toFixed(2)}°${d.lat >= 0 ? 'N' : 'S'} ${Math.abs(d.lng).toFixed(2)}°${d.lng >= 0 ? 'E' : 'W'}</div>
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

      <HexLegend />
    </div>
  );
}
