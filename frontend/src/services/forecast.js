/**
 * Threat Propagation Forecast Service
 * 
 * Mock forecasting logic for spatio-temporal threat propagation.
 * This module generates deterministic, heuristic-based forecasts WITHOUT real ML models.
 * 
 * Heuristics:
 * - Threats propagate to neighboring hexes based on current threat score
 * - Propagation rate decays with distance and time
 * - Anomaly flags boost propagation probability
 * - All logic is deterministic (seeded) for stable demo behavior
 * 
 * TODO: Replace these mock functions with real backend ML predictions once available
 */

/**
 * Deterministic seeded random number generator for stable demo
 * Based on hex_id string to ensure same forecast always for same hex
 */
function seededRandom(seed, multiplier = 1) {
  // Hash the seed string into a number
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Normalize to 0-1
  return ((Math.abs(hash) % 10000) / 10000) * multiplier;
}

/**
 * Calculate distance between two geographic coordinates (lat/lng)
 * Returns kilometers using Haversine formula
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find neighboring hexes within a given radius
 * Returns array of {hex, distance_km}
 */
function findNeighbors(hex, allHexes, maxDistanceKm = 150) {
  return allHexes
    .filter((other) => other.hex_id !== hex.hex_id)
    .map((other) => ({
      hex: other,
      distance_km: calculateDistance(hex.lat, hex.lng, other.lat, other.lng),
    }))
    .filter((n) => n.distance_km <= maxDistanceKm)
    .sort((a, b) => a.distance_km - b.distance_km);
}

/**
 * Calculate propagation score for a day in the future
 * 
 * Heuristics:
 * - Base threat decays over time (exponential decay)
 * - Higher initial scores propagate further
 * - Anomalies boost propagation
 * - Neighboring high-threat hexes amplify local risk
 */
function calculateDayScore(
  currentScore,
  daysAhead,
  neighborInfluence,
  hasAnomaly,
  neighborAnomalies,
) {
  // Exponential decay: threat reduces over time if no external pressure
  const decayFactor = Math.exp(-daysAhead / 45); // 45-day half-life
  
  // Anomalies slow decay (persistent threat)
  const anomalyBoost = hasAnomaly ? 1.15 : 1.0;
  
  // Neighboring hex anomalies add persistent threat (local clustering)
  const neighborAnomalyFactor = 1 + (neighborAnomalies * 5) / 100;
  
  // External pressure from high-threat neighbors
  const neighbors = neighborInfluence || 0;
  
  const decayedScore = currentScore * decayFactor * anomalyBoost;
  const pressureBoost = neighbors * 0.08; // 8% per threatening neighbor
  
  const finalScore = Math.min(100, decayedScore + pressureBoost);
  return Math.round(finalScore * 10) / 10;
}

/**
 * Calculate escalation probability (chance threat increases)
 * 
 * Based on:
 * - Number and severity of neighboring threats
 * - Current score trend
 * - Anomaly presence
 */
function calculateEscalationProbability(
  currentScore,
  futureScore,
  hasAnomaly,
  nearbyHighThreats,
) {
  let baseProbability = 0.3; // 30% baseline escalation risk
  
  if (hasAnomaly) baseProbability += 0.15; // Anomalies add 15%
  if (currentScore > 60) baseProbability += 0.1; // High starting score adds 10%
  if (nearbyHighThreats > 2) baseProbability += 0.15; // Multiple neighbors add 15%
  
  // If future score is higher than current, increase probability
  if (futureScore > currentScore) {
    baseProbability += 0.1;
  }
  
  return Math.min(0.95, baseProbability); // Cap at 95%
}

/**
 * Calculate confidence in the forecast
 * 
 * Based on:
 * - Data age/recency (in this mock, we assume recent)
 * - Number of influencing hexes
 * - Distance from source (closer = more confident)
 */
function calculateConfidence(daysAhead, neighborCount, influenceCount) {
  // Confidence decreases with forecast horizon
  const horizonFactor = Math.max(0.4, 1 - daysAhead / 100);
  
  // More nearby high-threat hexes = more confidence
  const dataDensityFactor = Math.min(1, influenceCount / 5);
  
  // Base confidence
  const confidence = 0.65 * horizonFactor + 0.35 * dataDensityFactor;
  
  return Math.round(confidence * 100) / 100; // Round to 2 decimals
}

/**
 * Generate full forecast for a hex over next 7, 14, 30 days
 * 
 * @param {string} hexId - H3 hex ID
 * @param {array} allHexes - All hex cells from the map
 * @returns {object} Forecast object with day_7, day_14, day_30 predictions
 */
export function generateForecastForHex(hexId, allHexes) {
  // Find the source hex
  const sourceHex = allHexes.find((h) => h.hex_id === hexId);
  if (!sourceHex) {
    return null;
  }

  const currentScore = sourceHex.threat_score;
  const hasAnomaly = sourceHex.anomaly_flag === 1;

  // Find neighboring hexes
  const neighbors = findNeighbors(sourceHex, allHexes);
  
  // Calculate neighbor influence on this hex
  // (how much pressure from nearby threats)
  const neighborInfluence = neighbors
    .slice(0, 5) // Consider closest 5 neighbors
    .reduce((sum, n) => {
      const distanceFactor = 1 - Math.min(1, n.distance_km / 150); // Closer = more influence
      return sum + n.hex.threat_score * distanceFactor * 0.15;
    }, 0);

  // Count anomalies nearby
  const neighborAnomalies = neighbors
    .slice(0, 5)
    .filter((n) => n.hex.anomaly_flag === 1).length;

  // High-threat neighbors that could influence escalation
  const nearbyHighThreats = neighbors
    .filter((n) => n.hex.threat_score > 50)
    .slice(0, 3).length;

  // Generate influenced_by array (top contributing neighbors)
  const influencedBy = neighbors
    .slice(0, 3)
    .map((n) => ({
      hex_id: n.hex.hex_id,
      distance_km: Math.round(n.distance_km * 10) / 10,
      contribution: Math.round((n.hex.threat_score * 0.15) * 10) / 10,
      threat_level: n.hex.threat_score,
    }));

  // Calculate scores for each forecast horizon
  const day7Score = calculateDayScore(
    currentScore,
    7,
    neighborInfluence,
    hasAnomaly,
    neighborAnomalies,
  );

  const day14Score = calculateDayScore(
    currentScore,
    14,
    neighborInfluence * 0.8,
    hasAnomaly,
    neighborAnomalies,
  );

  const day30Score = calculateDayScore(
    currentScore,
    30,
    neighborInfluence * 0.5,
    hasAnomaly,
    neighborAnomalies,
  );

  return {
    hex_id: hexId,
    current_score: currentScore,
    forecast: {
      day_7: {
        score: day7Score,
        escalation_probability: calculateEscalationProbability(
          currentScore,
          day7Score,
          hasAnomaly,
          nearbyHighThreats,
        ),
        confidence: calculateConfidence(7, neighbors.length, influencedBy.length),
      },
      day_14: {
        score: day14Score,
        escalation_probability: calculateEscalationProbability(
          currentScore,
          day14Score,
          hasAnomaly,
          nearbyHighThreats,
        ),
        confidence: calculateConfidence(14, neighbors.length, influencedBy.length),
      },
      day_30: {
        score: day30Score,
        escalation_probability: calculateEscalationProbability(
          currentScore,
          day30Score,
          hasAnomaly,
          nearbyHighThreats,
        ),
        confidence: calculateConfidence(30, neighbors.length, influencedBy.length),
      },
    },
    influenced_by: influencedBy,
    neighbor_count: neighbors.length,
  };
}

/**
 * Generate animated propagation frames for visualization
 * 
 * Returns array of frames showing how threat spreads over time
 * Each frame shows threat at a given day with interpolated values
 */
export function generatePropagationFrames(hexId, allHexes, daysTotal = 30) {
  const frames = [];
  const sourceHex = allHexes.find((h) => h.hex_id === hexId);
  if (!sourceHex) return frames;

  const forecast = generateForecastForHex(hexId, allHexes);
  if (!forecast) return frames;

  // Frame 0: Current state
  frames.push({
    day: 0,
    hexId,
    score: forecast.current_score,
    propagation: {}, // No propagation yet
  });

  // Create interpolated frames
  const days = [7, 14, 30];
  const scores = [
    forecast.forecast.day_7.score,
    forecast.forecast.day_14.score,
    forecast.forecast.day_30.score,
  ];

  // Frame for day 7
  frames.push({
    day: 7,
    hexId,
    score: scores[0],
    propagation: generatePropagationSnapshot(sourceHex, allHexes, 7, forecast),
  });

  // Frame for day 14
  frames.push({
    day: 14,
    hexId,
    score: scores[1],
    propagation: generatePropagationSnapshot(sourceHex, allHexes, 14, forecast),
  });

  // Frame for day 30
  frames.push({
    day: 30,
    hexId,
    score: scores[2],
    propagation: generatePropagationSnapshot(sourceHex, allHexes, 30, forecast),
  });

  return frames;
}

/**
 * Generate a snapshot of propagation at a given day
 * Shows which neighboring hexes are affected and by how much
 */
function generatePropagationSnapshot(sourceHex, allHexes, day, forecast) {
  const neighbors = findNeighbors(sourceHex, allHexes);
  const snapshot = {};

  neighbors.slice(0, 8).forEach((n) => {
    // Propagation decays with distance and time
    const distanceFactor = 1 - Math.min(1, n.distance_km / 150);
    const timeFactor = Math.max(0, 1 - day / 60);
    const anomalyBoost = n.hex.anomaly_flag === 1 ? 1.3 : 1.0;

    const propagatedScore = forecast.current_score * distanceFactor * timeFactor * 0.4 * anomalyBoost;

    if (propagatedScore > 2) {
      snapshot[n.hex.hex_id] = {
        propagation_score: Math.round(propagatedScore * 10) / 10,
        total_score: Math.min(100, n.hex.threat_score + propagatedScore),
        confidence: distanceFactor * (1 - day / 100),
      };
    }
  });

  return snapshot;
}

/**
 * Calculate which forecast horizon to show by default
 * based on current threat level and data availability
 */
export function recommendedForecastHorizon(currentScore) {
  if (currentScore > 70) return 7; // Critical threats: short term
  if (currentScore > 40) return 14; // High threats: medium term
  return 30; // Low/moderate: full horizon
}

/**
 * Format forecast data for display
 */
export function formatForecastMetric(value, type = 'score') {
  if (type === 'score') {
    return Math.round(value);
  }
  if (type === 'probability') {
    return `${Math.round(value * 100)}%`;
  }
  if (type === 'confidence') {
    return `${Math.round(value * 100)}%`;
  }
  return value;
}
