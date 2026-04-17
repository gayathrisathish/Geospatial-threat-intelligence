import { MOCK_HEXGRID, MOCK_HEX_DETAIL } from './mockData.js';

const BASE = 'http://localhost:8000';
const FORCE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const FALLBACK_TO_MOCK = import.meta.env.VITE_FALLBACK_TO_MOCK !== 'false';

/**
 * Fetch all hex cells in the grid
 */
export async function fetchHexGrid() {
  try {
    if (FORCE_MOCK) {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 300));
      return { data: MOCK_HEXGRID, error: null };
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
      return { data: MOCK_HEXGRID, error: `backend unavailable, using mock: ${err.message}` };
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
      return { data: MOCK_HEX_DETAIL, error: null };
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
      return { data: MOCK_HEX_DETAIL, error: `backend unavailable, using mock: ${err.message}` };
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
