import { useState, useEffect } from 'react';
import MapView from './components/MapView.jsx';
import SidePanel from './components/SidePanel.jsx';
import SitrepModal from './components/SitrepModal.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import AlertFeed from './components/AlertFeed.jsx';
import Navbar from './components/Navbar.jsx';
import { fetchHexGrid, fetchHexDetail, postAlert, generateSitrep } from './api.js';

export default function App() {
  const [hexCells, setHexCells] = useState([]);
  const [selectedHex, setSelectedHex] = useState(null);
  const [hexDetail, setHexDetail] = useState(null);
  const [showSitrep, setShowSitrep] = useState(false);
  const [sitrepText, setSitrepText] = useState('');
  const [sitrepError, setSitrepError] = useState('');
  const [sitrepLoading, setSitrepLoading] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);

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

    const { data, error } = await generateSitrep(selectedHex.hex_id);
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

  const anomalyCount = hexCells.filter((c) => c.anomaly_flag === 1).length;
  const lastUpdated = new Date().toISOString();

  return (
    <div className="w-screen h-screen bg-slate-100 text-slate-900 overflow-hidden flex flex-col">
      <Navbar lastUpdated={lastUpdated} hexCount={hexCells.length} anomalyCount={anomalyCount} />

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[60%_40%]">
        <div className="min-h-[45vh] xl:min-h-0 border-b xl:border-b-0 xl:border-r border-slate-300">
          <MapView hexCells={hexCells} selectedHex={selectedHex} onHexClick={handleHexClick} />
        </div>

        <div className="min-h-0 grid grid-rows-[220px_1fr] bg-slate-50">
          <AlertFeed alerts={alerts} hexCells={hexCells} onAlertClick={handleAlertClick} />

          <div className="min-h-0 overflow-hidden">
            <SidePanel
              selectedHex={selectedHex}
              hexDetail={hexDetail}
              hexCells={hexCells}
              onGenerateSitrep={handleGenerateSitrep}
              onOpenChat={() => setShowChat(true)}
            />
          </div>
        </div>
      </div>

      <SitrepModal
        isOpen={showSitrep}
        hexId={selectedHex?.hex_id || ''}
        sitrepText={sitrepText}
        isLoading={sitrepLoading}
        error={sitrepError}
        onClose={() => setShowSitrep(false)}
      />

      <ChatPanel isOpen={showChat} selectedHex={selectedHex} onClose={() => setShowChat(false)} />
    </div>
  );
}
