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
