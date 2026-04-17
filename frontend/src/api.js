import { MOCK_HEXGRID, MOCK_HEX_DETAIL } from './mockData.js';

const BASE = 'http://localhost:8000';
const FORCE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const FALLBACK_TO_MOCK = import.meta.env.VITE_FALLBACK_TO_MOCK !== 'false';

function buildPrototypeSignals(cell) {
  const existing = cell.signals || {};
  const fatalities = Number(existing.total_fatalities ?? 0);
  const eventCount = Number(cell.event_count ?? 0);
  const basePopulationDensity = Math.min(1200, 120 + eventCount * 55 + fatalities * 0.8);
  const populationVulnerability = Math.min(1, 0.25 + eventCount * 0.03 + fatalities / 1200);

  return {
    conflict_intensity: Number(existing.conflict_intensity ?? 0),
    total_fatalities: fatalities,
    firms_signal: Number(existing.firms_signal ?? 0),
    gdelt_sentiment: Number(existing.gdelt_sentiment ?? 0),
    population_density: Number(existing.population_density ?? basePopulationDensity),
    population_vulnerability: Number(existing.population_vulnerability ?? populationVulnerability),
    environmental_risk: Number(existing.environmental_risk ?? existing.firms_signal ?? 0),
    economic_activity: Number(existing.economic_activity ?? Math.min(100, 25 + eventCount * 4)),
  };
}

function buildPrototypeDrivers(signals) {
  const raw = {
    conflict_intensity: Math.min(100, Math.max(0, signals.conflict_intensity * 35)),
    firms_signal: Math.min(100, Math.max(0, signals.firms_signal * 0.15)),
    gdelt_sentiment: Math.min(100, Math.max(0, ((10 - signals.gdelt_sentiment) / 20) * 10)),
    population_exposure: Math.min(100, Math.max(0, ((signals.population_density / 1200) * 0.6 + signals.population_vulnerability * 0.4) * 15)),
    environmental_risk: Math.min(100, Math.max(0, signals.environmental_risk * 0.15)),
    economic_activity: Math.min(100, Math.max(0, signals.economic_activity * 0.10)),
  };

  const entries = Object.entries(raw).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const total = entries.reduce((acc, [, value]) => acc + value, 0) || 1;
  return Object.fromEntries(entries.map(([key, value]) => [key, Number(((value / total) * 100).toFixed(1))]));
}

function enrichCell(cell) {
  const signals = buildPrototypeSignals(cell);
  return {
    ...cell,
    signals,
    risk_drivers: cell.risk_drivers || buildPrototypeDrivers(signals),
  };
}

function enrichDetail(detail) {
  if (!detail?.cell) return detail;
  const cell = enrichCell(detail.cell);
  return {
    ...detail,
    cell,
  };
}

/**
 * Fetch all hex cells in the grid
 */
export async function fetchHexGrid() {
  try {
    if (FORCE_MOCK) {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 300));
      return { data: MOCK_HEXGRID.map(enrichCell), error: null };
    }

    const response = await fetch(`${BASE}/hexgrid`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return { data, error: null };
  } catch (err) {
    if (FALLBACK_TO_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { data: MOCK_HEXGRID.map(enrichCell), error: `backend unavailable, using mock: ${err.message}` };
    }
    return { data: null, error: err.message };
  }
}

/**
 * Fetch details for a specific hex cell
 */
export async function fetchHexDetail(hexId) {
  try {
    if (FORCE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { data: enrichDetail(MOCK_HEX_DETAIL), error: null };
    }

    const response = await fetch(`${BASE}/hex/${hexId}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return { data, error: null };
  } catch (err) {
    if (FALLBACK_TO_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 120));
      return { data: enrichDetail(MOCK_HEX_DETAIL), error: `backend unavailable, using mock: ${err.message}` };
    }
    return { data: null, error: err.message };
  }
}

/**
 * Post an alert for a hex cell
 */
export async function postAlert(hexId, threshold = 40) {
  try {
    if (FORCE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 150));
      // Find the cell in mock data
      const cell = MOCK_HEXGRID.find(c => c.hex_id === hexId);
      const threatScore = cell?.threat_score || 0;
      return {
        data: {
          hex_id: hexId,
          threat_score: threatScore,
          threshold,
          crossed: threatScore > threshold,
          alert_type: threatScore > 75 ? 'CRITICAL' : threatScore > 50 ? 'HIGH' : null,
          created_at: new Date().toISOString(),
        },
        error: null,
      };
    }

    const response = await fetch(`${BASE}/alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hex_id: hexId, threshold }),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return { data, error: null };
  } catch (err) {
    if (FALLBACK_TO_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 120));
      const cell = MOCK_HEXGRID.find(c => c.hex_id === hexId);
      const threatScore = cell?.threat_score || 0;
      return {
        data: {
          hex_id: hexId,
          threat_score: threatScore,
          threshold,
          crossed: threatScore > threshold,
          alert_type: threatScore > 75 ? 'CRITICAL' : threatScore > 50 ? 'HIGH' : null,
          created_at: new Date().toISOString(),
        },
        error: `backend unavailable, using mock: ${err.message}`,
      };
    }
    return { data: null, error: err.message };
  }
}

/**
 * Generate a NATO format SITREP for a hex cell
 */
export async function generateSitrep(hexId) {
  try {
    if (FORCE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return {
        data: {
          sitrep: `SITUATION REPORT (SITREP)
HEX SECTOR: ${hexId}
CLASSIFICATION: UNCLASSIFIED

1. CURRENT THREAT STATUS
   - Overall threat assessment: ELEVATED
   - Primary indicators suggest sustained hostile activity
   - Anomaly flag: ACTIVE

2. SIGNAL INTELLIGENCE (SIGINT)
   - Conflict intensity: 89%
   - Thermal activity (FIRMS): 92.1
   - OSINT sentiment analysis: HIGHLY NEGATIVE (-8.4)

3. HUMAN INTELLIGENCE (HUMINT)
   - Reported fatalities: 247
   - Events tracked: 12 incidents in past 30 days
   - Most recent: Strategic development (14 Mar 2026)

4. ASSESSMENT
   This sector presents significant risk indicators across multiple 
   intelligence streams. Recommend heightened monitoring and 
   coordination with regional partners.

5. RECOMMENDATIONS
   - Continue 24/7 surveillance
   - Escalate intelligence collection
   - Brief stakeholders on emerging threats
   - Prepare contingency plans

END SITREP`,
        },
        error: null,
      };
    }

    const response = await fetch(`${BASE}/sitrep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hex_id: hexId }),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return { data, error: null };
  } catch (err) {
     if (FALLBACK_TO_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return {
        data: {
         sitrep: `SITUATION REPORT (SITREP)
  HEX SECTOR: ${hexId}
  CLASSIFICATION: UNCLASSIFIED

  1. CURRENT THREAT STATUS
    - Overall threat assessment: ELEVATED
    - Primary indicators suggest sustained hostile activity
    - Anomaly flag: ACTIVE

  2. SIGNAL INTELLIGENCE (SIGINT)
    - Conflict intensity: 89%
    - Thermal activity (FIRMS): 92.1
    - OSINT sentiment analysis: HIGHLY NEGATIVE (-8.4)

  3. HUMAN INTELLIGENCE (HUMINT)
    - Reported fatalities: 247
    - Events tracked: 12 incidents in past 30 days
    - Most recent: Strategic development (14 Mar 2026)

  4. ASSESSMENT
    This sector presents significant risk indicators across multiple
    intelligence streams. Recommend heightened monitoring and
    coordination with regional partners.

  5. RECOMMENDATIONS
    - Continue 24/7 surveillance
    - Escalate intelligence collection
    - Brief stakeholders on emerging threats
    - Prepare contingency plans

  END SITREP`,
        },
        error: `backend unavailable, using mock: ${err.message}`,
      };
     }
     return { data: null, error: err.message };
  }
}

/**
 * Ask an analytical question about a hex cell
 */
export async function askQuestion(hexId, question) {
  try {
    if (FORCE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const responses = [
        'This sector is flagged due to a confluence of signals: elevated conflict intensity (0.89), high thermal activity (92.1 FIRMS score), and strongly negative OSINT sentiment (-8.4). The 247 reported fatalities across 12 recent events indicate sustained hostile activity.',
        'The primary threat drivers in this sector are armed conflict activity and potential military operations. Thermal signatures suggest infrastructure fires or weapons usage, while OSINT sentiment metrics show international media coverage with increasingly negative framing.',
        'This is a CRITICAL anomaly. The combination of confirmed fatalities, sustained conflict signals, and anomalous thermal patterns suggests either a new conflict zone activation or significant escalation of existing hostilities. Immediate escalation recommended.',
        'Recent activity includes strategic developments and armed clashes concentrated in the 51.07°N, 33.58°E grid. Three major events in the last 72 hours with 78-89 fatalities each. Trend is worsening.',
      ];
      const response = responses[Math.floor(Math.random() * responses.length)];
      return { data: { answer: response }, error: null };
    }

    const response = await fetch(`${BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hex_id: hexId, question }),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return { data, error: null };
  } catch (err) {
    if (FALLBACK_TO_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 800));
      const responses = [
        'This sector is flagged due to a confluence of signals: elevated conflict intensity (0.89), high thermal activity (92.1 FIRMS score), and strongly negative OSINT sentiment (-8.4). The 247 reported fatalities across 12 recent events indicate sustained hostile activity.',
        'The primary threat drivers in this sector are armed conflict activity and potential military operations. Thermal signatures suggest infrastructure fires or weapons usage, while OSINT sentiment metrics show international media coverage with increasingly negative framing.',
        'This is a CRITICAL anomaly. The combination of confirmed fatalities, sustained conflict signals, and anomalous thermal patterns suggests either a new conflict zone activation or significant escalation of existing hostilities. Immediate escalation recommended.',
        'Recent activity includes strategic developments and armed clashes concentrated in the 51.07°N, 33.58°E grid. Three major events in the last 72 hours with 78-89 fatalities each. Trend is worsening.',
      ];
      const response = responses[Math.floor(Math.random() * responses.length)];
      return { data: { answer: response }, error: `backend unavailable, using mock: ${err.message}` };
    }
    return { data: null, error: err.message };
  }
}
