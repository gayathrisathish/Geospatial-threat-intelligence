import { useState, useEffect } from 'react';
import MapView from './components/MapView.jsx';
import LeafletView from './components/LeafletView.jsx';
import SidePanel from './components/SidePanel.jsx';
import SitrepModal from './components/SitrepModal.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import AlertFeed from './components/AlertFeed.jsx';
import AlertModal from './components/AlertModal.jsx';
import Navbar from './components/Navbar.jsx';
import ThreatTicker from './components/ThreatTicker.jsx';
import { fetchHexGrid, fetchHexDetail, postAlert, generateSitrep } from './api.js';

export default function App() {
  const [viewMode, setViewMode] = useState('globe');
  const [mapInitialCenter, setMapInitialCenter] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [hintFading, setHintFading] = useState(false);
  const [hexCells, setHexCells] = useState([]);
  const [selectedHex, setSelectedHex] = useState(null);
  const [hexDetail, setHexDetail] = useState(null);
  const [showSitrep, setShowSitrep] = useState(false);
  const [sitrepText, setSitrepText] = useState('');
  const [sitrepError, setSitrepError] = useState('');
  const [sitrepLoading, setSitrepLoading] = useState(false);
  const [sitrepDraftSections, setSitrepDraftSections] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);

  // Load hex grid on mount
  useEffect(() => {
    const loadHexGrid = async () => {
      setIsLoading(true);
      const { data, error } = await fetchHexGrid();
      if (data) {
        setHexCells(data);
      }
      setIsLoading(false);
    };
    loadHexGrid();
  }, []);

  useEffect(() => {
    try {
      if (localStorage.getItem('hint_shown')) return;
    } catch {
      return;
    }

    setShowHint(true);
    const timer = setTimeout(() => {
      dismissHint();
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  // Handle hex click
  const handleHexClick = async (cell) => {
    setSelectedHex(cell);
    setHexDetail(null);
    setShowChat(false);

    // Fetch hex detail
    const { data: detail } = await fetchHexDetail(cell.hex_id);
    if (detail) {
      setHexDetail(detail);
    }

    // Post alert
    const { data: alertData } = await postAlert(cell.hex_id, 40);
    if (alertData && alertData.crossed) {
      setAlerts((prev) => [alertData, ...prev]);
    }
  };

  // Handle generate SITREP
  const handleGenerateSitrep = async () => {
    if (!selectedHex) return;
    setShowSitrep(true);
    setSitrepText('');
    setSitrepError('');
    setSitrepLoading(true);

    const minDelay = new Promise((resolve) => setTimeout(resolve, 2000));
    const request = generateSitrep(selectedHex.hex_id);
    const [{ data, error }] = await Promise.all([request, minDelay]);
    setSitrepLoading(false);

    if (data?.sitrep) {
      setSitrepText(data.sitrep);
      return;
    }

    setSitrepError(error || 'Unable to generate SITREP right now.');
  };

  // Handle alert click
  const handleAlertClick = (hexId) => {
    const cell = hexCells.find((c) => c.hex_id === hexId);
    if (cell) {
      handleHexClick(cell);
    }
  };

  const handleAddSitrepSection = (insightText) => {
    if (!insightText?.trim()) return;

    const section = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      hexId: selectedHex?.hex_id || 'unknown',
      text: insightText.trim(),
    };

    setSitrepDraftSections((prev) => {
      const exists = prev.some((item) => item.hexId === section.hexId && item.text === section.text);
      if (exists) return prev;
      return [section, ...prev];
    });
  };

  const handleClearSitrepDraftSections = () => {
    setSitrepDraftSections([]);
  };

  const handleJumpToHotspot = () => {
    if (!hexCells.length) return;

    const topCell = [...hexCells].sort((a, b) => {
      if (b.anomaly_flag !== a.anomaly_flag) {
        return b.anomaly_flag - a.anomaly_flag;
      }
      return b.threat_score - a.threat_score;
    })[0];

    if (topCell) {
      handleHexClick(topCell);
    }
  };

  const dismissHint = () => {
    if (!showHint && !hintFading) return;
    setHintFading(true);

    try {
      localStorage.setItem('hint_shown', 'true');
    } catch {
      // ignore storage errors
    }

    setTimeout(() => {
      setShowHint(false);
      setHintFading(false);
    }, 350);
  };

  const handleSwitchToMap = (center) => {
    if (center?.lat != null && center?.lng != null) {
      setMapInitialCenter({ lat: center.lat, lng: center.lng });
    }
    setViewMode('map');
  };

  const handleViewModeChange = (mode) => {
    if (mode === 'map') {
      if (selectedHex?.lat != null && selectedHex?.lng != null) {
        setMapInitialCenter({ lat: selectedHex.lat, lng: selectedHex.lng });
      } else {
        setMapInitialCenter(null);
      }
    }
    setViewMode(mode);
  };

  const anomalyCount = hexCells.filter((c) => c.anomaly_flag === 1).length;
  const mapHighRiskCount = hexCells.filter((c) => c.threat_score > 60).length;
  const lastUpdated = new Date().toISOString();

  return (
    <div className="w-screen h-screen gs-shell overflow-hidden flex flex-col">
      <Navbar
        lastUpdated={lastUpdated}
        hexCount={hexCells.length}
        anomalyCount={anomalyCount}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
      />

      <div className="gs-panel border-b px-4 md:px-6 py-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <p className="text-sm gs-muted">
            What this map shows: each sector is color-coded by current threat risk, with high-risk sectors requiring immediate attention.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowAlertModal(true)}
              disabled={!alerts.length}
              className="px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold uppercase tracking-wide transition-colors flex items-center gap-1.5"
            >
              <span>🔔</span>
              Alerts ({alerts.length})
            </button>
            <button
              onClick={handleJumpToHotspot}
              disabled={!hexCells.length}
              className="px-3 py-2 rounded-md bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white text-xs font-semibold uppercase tracking-wide transition-colors"
            >
              View Hotspots
            </button>
            <button
              onClick={() => setShowChat(true)}
              className="px-3 py-2 rounded-md bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold uppercase tracking-wide transition-colors"
            >
              Ask Assistant
            </button>
            <button
              onClick={handleGenerateSitrep}
              disabled={!selectedHex}
              className="px-3 py-2 rounded-md bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold uppercase tracking-wide transition-colors"
            >
              Generate SITREP
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[65%_25%_10%]">
        <div
          className="relative min-h-[45vh] xl:min-h-0 border-b xl:border-b-0 xl:border-r border-slate-300"
          onPointerDown={dismissHint}
        >
          {viewMode === 'globe' ? (
            <MapView
              hexCells={hexCells}
              selectedHex={selectedHex}
              onHexClick={handleHexClick}
              onSwitchToMap={handleSwitchToMap}
            />
          ) : (
            <LeafletView
              hexCells={hexCells}
              selectedHex={selectedHex}
              onHexClick={handleHexClick}
              initialCenter={mapInitialCenter}
              initialZoom={9}
            />
          )}

          {showHint && (
            <div
              className={`absolute left-1/2 -translate-x-1/2 bottom-3 z-[1400] px-4 py-2 rounded-full border border-slate-600 bg-slate-900/92 text-white text-xs shadow-lg font-ui tracking-[0.06em] ${
                hintFading ? 'map-hint-exit' : 'map-hint-enter'
              }`}
            >
              🖱 Drag to rotate  •  Scroll to zoom  •  Click a sector to inspect
            </div>
          )}
        </div>

        <div className="min-h-0 bg-slate-50">
          <SidePanel
            selectedHex={selectedHex}
            hexDetail={hexDetail}
            hexCells={hexCells}
            onGenerateSitrep={handleGenerateSitrep}
            onOpenChat={() => setShowChat(true)}
          />
        </div>

        <div className="hidden xl:block min-h-0">
          <AlertFeed
            alerts={alerts}
            onAlertClick={handleAlertClick}
            isLoading={isLoading}
            mapHighRiskCount={mapHighRiskCount}
            onOpenAlerts={() => setShowAlertModal(true)}
          />
        </div>
      </div>

      <ThreatTicker
        hexCells={hexCells}
        onSelectHex={handleHexClick}
        selectedHexId={selectedHex?.hex_id || ''}
      />

      <SitrepModal
        isOpen={showSitrep}
        hexId={selectedHex?.hex_id || ''}
        selectedHex={selectedHex}
        alerts={alerts}
        sitrepText={sitrepText}
        draftSections={sitrepDraftSections}
        isLoading={sitrepLoading}
        error={sitrepError}
        onClearDraftSections={handleClearSitrepDraftSections}
        onClose={() => setShowSitrep(false)}
      />

      <AlertModal
        isOpen={showAlertModal}
        alerts={alerts}
        onAlertClick={handleAlertClick}
        onClose={() => setShowAlertModal(false)}
        isLoading={isLoading}
        mapHighRiskCount={mapHighRiskCount}
      />

      <ChatPanel
        isOpen={showChat}
        selectedHex={selectedHex}
        onAddSitrepSection={handleAddSitrepSection}
        onOpenSitrep={() => setShowSitrep(true)}
        onClose={() => setShowChat(false)}
      />
    </div>
  );
}
