/**
 * Format score as integer without decimals
 */
export function formatScore(score) {
  return Math.round(score).toString();
}

/**
 * Format date string from ISO format to "14 Mar 2026"
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const day = date.getDate();
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Format hex ID from "851e6cb7fffffff" to "SECTOR 6CB7"
 */
export function formatHexId(hexId) {
  if (!hexId || hexId.length < 4) return hexId || '';
  const lastFour = hexId.slice(-4).toUpperCase();
  return `SECTOR ${lastFour}`;
}

/**
 * Format signal key/value pairs into human readable text
 */
export function formatSignal(key, value) {
  const labels = {
    conflict_intensity: 'Conflict Intensity',
    total_fatalities: 'Fatalities',
    firms_signal: 'Thermal Activity',
    gdelt_sentiment: 'OSINT Sentiment',
    population_density: 'Population Density',
    population_vulnerability: 'Population Vulnerability',
    environmental_risk: 'Environmental Risk',
    economic_activity: 'Economic Activity',
  };

  const label = labels[key] || key;
  
  if (key === 'total_fatalities') {
    return `${label}: ${Math.round(value)}`;
  }
  if (key === 'population_density') {
    return `${label}: ${Math.round(value)} / km²`;
  }
  if (key === 'gdelt_sentiment' || key === 'conflict_intensity') {
    return `${label}: ${value.toFixed(2)}`;
  }
  if (key === 'population_vulnerability') {
    return `${label}: ${(value * 100).toFixed(1)}%`;
  }
  
  // firms_signal and others
  return `${label}: ${value.toFixed(1)}`;
}

export function formatRiskDriver(key, value) {
  const labels = {
    conflict_intensity: 'Conflict Intensity',
    firms_signal: 'Thermal Activity',
    gdelt_sentiment: 'OSINT Sentiment',
    population_exposure: 'Population Exposure',
    environmental_risk: 'Environmental Risk',
    economic_activity: 'Economic Activity',
  };

  const label = labels[key] || key;
  return `${label}: ${value.toFixed(1)}%`;
}

/**
 * Format time ago from ISO timestamp
 * e.g. "2 min ago", "1 hr ago"
 */
export function formatTimeAgo(isoTimestamp) {
  const date = new Date(isoTimestamp);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
