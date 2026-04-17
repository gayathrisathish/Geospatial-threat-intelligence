/**
 * Get hex color for threat score
 * 0-20: green, 20-40: yellow, 40-60: orange, 60-100: red
 */
export function threatColor(score) {
  if (score > 60) return '#ef4444'; // red
  if (score > 40) return '#f97316'; // orange
  if (score > 20) return '#eab308'; // yellow
  return '#22c55e'; // green
}

/**
 * Simple severity bucket for operator-facing labels
 */
export function severityBucket(score) {
  if (score > 60) return 'high';
  if (score > 30) return 'medium';
  return 'low';
}

/**
 * Plain-language risk label for UI copy
 */
export function threatPlainLabel(score) {
  const bucket = severityBucket(score);
  if (bucket === 'high') return 'High risk';
  if (bucket === 'medium') return 'Medium risk';
  return 'Low risk';
}

/**
 * Convert confidence ratio (0-1) into a plain-language label
 */
export function confidencePlainLabel(confidence) {
  if (confidence >= 0.75) return 'High confidence';
  if (confidence >= 0.45) return 'Medium confidence';
  return 'Low confidence';
}

/**
 * Get threat level label
 */
export function threatLabel(score) {
  if (score > 60) return 'CRITICAL';
  if (score > 40) return 'HIGH';
  if (score > 20) return 'MODERATE';
  return 'LOW';
}

/**
 * Get Tailwind text color class for signal values
 * type: 'sentiment' (negative is bad) or 'default' (high is bad)
 */
export function signalColor(value, type = 'default') {
  if (type === 'sentiment') {
    // Negative sentiment is worse (hostile)
    if (value < -7) return 'text-red-500';
    if (value < -3) return 'text-orange-500';
    return 'text-yellow-500';
  }
  
  // Default: high values are bad
  if (value > 80) return 'text-red-500';
  if (value > 50) return 'text-orange-500';
  if (value > 25) return 'text-yellow-500';
  return 'text-green-500';
}
