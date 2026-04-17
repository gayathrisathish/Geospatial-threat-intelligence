import { useMemo, useState } from 'react';
import { threatColor, threatPlainLabel, severityBucket } from '../utils/colorScale.js';
import { formatHexId, formatScore, formatTimeAgo } from '../utils/formatters.js';

function timeGroupLabel(dateStr) {
  const createdAt = new Date(dateStr);
  const now = new Date();
  const hoursAgo = (now - createdAt) / (1000 * 60 * 60);

  if (hoursAgo <= 24) return 'Last 24 hours';
  if (hoursAgo <= 168) return 'This week';
  return 'Earlier';
}

export default function AlertModal({ isOpen, alerts, onAlertClick, onClose, isLoading, mapHighRiskCount = 0 }) {
  const [severityFilter, setSeverityFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [onlyUnreviewed, setOnlyUnreviewed] = useState(false);
  const [reviewedHexIds, setReviewedHexIds] = useState(() => new Set());

  const sortedAlerts = [...alerts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const filteredAlerts = useMemo(() => {
    const now = new Date();

    return sortedAlerts.filter((alert) => {
      const bucket = severityBucket(alert.threat_score);
      const createdAt = new Date(alert.created_at);
      const ageHours = (now - createdAt) / (1000 * 60 * 60);
      const isReviewed = reviewedHexIds.has(alert.hex_id);

      const matchesSeverity = severityFilter === 'all' || bucket === severityFilter;
      const matchesTime =
        timeFilter === 'all' ||
        (timeFilter === '24h' && ageHours <= 24) ||
        (timeFilter === '7d' && ageHours <= 168);
      const matchesReview = !onlyUnreviewed || !isReviewed;

      return matchesSeverity && matchesTime && matchesReview;
    });
  }, [sortedAlerts, severityFilter, timeFilter, onlyUnreviewed, reviewedHexIds]);

  const groupedAlerts = useMemo(() => {
    return filteredAlerts.reduce(
      (acc, alert) => {
        const group = timeGroupLabel(alert.created_at);
        acc[group] = acc[group] || [];
        acc[group].push(alert);
        return acc;
      },
      { 'Last 24 hours': [], 'This week': [], Earlier: [] }
    );
  }, [filteredAlerts]);

  const activeFilters = [
    severityFilter !== 'all' ? `Severity: ${severityFilter}` : null,
    timeFilter === '24h' ? 'Time: last 24h' : null,
    timeFilter === '7d' ? 'Time: last 7d' : null,
    onlyUnreviewed ? 'Only unreviewed' : null,
  ].filter(Boolean);

  const hasActiveFilters = activeFilters.length > 0;
  const visibleCount = filteredAlerts.length;
  const totalCount = sortedAlerts.length;

  const highCount = sortedAlerts.filter((a) => severityBucket(a.threat_score) === 'high').length;
  const mediumCount = sortedAlerts.filter((a) => severityBucket(a.threat_score) === 'medium').length;
  const lowCount = sortedAlerts.filter((a) => severityBucket(a.threat_score) === 'low').length;
  const last24hCount = sortedAlerts.filter((a) => (new Date() - new Date(a.created_at)) / (1000 * 60 * 60) <= 24).length;
  const last7dCount = sortedAlerts.filter((a) => (new Date() - new Date(a.created_at)) / (1000 * 60 * 60) <= 168).length;
  const unreviewedCount = sortedAlerts.filter((a) => !reviewedHexIds.has(a.hex_id)).length;

  const toggleReviewed = (hexId) => {
    setReviewedHexIds((prev) => {
      const next = new Set(prev);
      if (next.has(hexId)) {
        next.delete(hexId);
      } else {
        next.add(hexId);
      }
      return next;
    });
  };

  const resetFilters = () => {
    setSeverityFilter('all');
    setTimeFilter('all');
    setOnlyUnreviewed(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] bg-black/40 flex items-center justify-center p-4">
      <div className="relative z-[2001] isolate bg-white rounded-lg shadow-2xl max-w-2xl w-full h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide">Triggered Alerts</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Info Section */}
        <div className="px-6 py-4 border-b border-slate-200 space-y-3 flex-shrink-0 bg-slate-50">
          <div className="text-sm text-slate-700">
            Map view currently shows <span className="font-semibold text-slate-900">{mapHighRiskCount}</span> high-risk sectors.
          </div>
          <div className="text-sm text-slate-700">
            Showing <span className="font-semibold text-slate-900">{visibleCount}</span> of <span className="font-semibold text-slate-900">{totalCount}</span> alert events
          </div>
        </div>

        {/* Filters Section */}
        <div className="px-6 py-4 border-b border-slate-200 space-y-3 flex-shrink-0 bg-white overflow-y-auto max-h-48">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSeverityFilter('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${severityFilter === 'all' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'}`}
            >
              All severities ({totalCount})
            </button>
            <button
              onClick={() => setSeverityFilter('high')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${severityFilter === 'high' ? 'bg-red-700 text-white border-red-700' : 'bg-white text-slate-700 border-slate-300 hover:border-red-400'}`}
            >
              High risk ({highCount})
            </button>
            <button
              onClick={() => setSeverityFilter('medium')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${severityFilter === 'medium' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-700 border-slate-300 hover:border-amber-400'}`}
            >
              Medium risk ({mediumCount})
            </button>
            <button
              onClick={() => setSeverityFilter('low')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${severityFilter === 'low' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-slate-700 border-slate-300 hover:border-emerald-400'}`}
            >
              Low risk ({lowCount})
            </button>
          </div>

          <details className="group">
            <summary className="cursor-pointer text-xs text-slate-600 font-semibold select-none hover:text-slate-900">
              ⊕ Time and workflow filters
            </summary>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => setTimeFilter('all')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${timeFilter === 'all' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'}`}
              >
                All time ({totalCount})
              </button>
              <button
                onClick={() => setTimeFilter('24h')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${timeFilter === '24h' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'}`}
              >
                Last 24h ({last24hCount})
              </button>
              <button
                onClick={() => setTimeFilter('7d')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${timeFilter === '7d' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'}`}
              >
                Last 7d ({last7dCount})
              </button>
              <button
                onClick={() => setOnlyUnreviewed((prev) => !prev)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${onlyUnreviewed ? 'bg-cyan-700 text-white border-cyan-700' : 'bg-white text-slate-700 border-slate-300 hover:border-cyan-400'}`}
              >
                Unreviewed ({unreviewedCount})
              </button>
            </div>
          </details>

          {(hasActiveFilters || filteredAlerts.length !== sortedAlerts.length) && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2">
              <div className="flex flex-wrap gap-1">
                {activeFilters.map((filter) => (
                  <span key={filter} className="px-2 py-1 rounded bg-slate-200 text-slate-700 text-xs font-medium">
                    {filter}
                  </span>
                ))}
              </div>
              <button
                onClick={resetFilters}
                className="text-xs font-semibold text-slate-700 hover:text-slate-900 self-start sm:self-auto"
              >
                Reset filters
              </button>
            </div>
          )}
        </div>

        {/* Alerts List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 bg-white">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, idx) => (
                <div key={idx} className="h-24 rounded-lg bg-slate-100 border border-slate-200 animate-pulse"></div>
              ))}
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex items-center justify-center min-h-40 text-slate-500 text-center">
              <p>No alerts triggered yet. High-risk threshold crossings will appear here.</p>
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="flex items-center justify-center min-h-40 text-slate-500 text-center">
              <p>No alerts match the active filters.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedAlerts).map(([group, groupAlerts]) => (
                groupAlerts.length > 0 && (
                  <div key={group}>
                    <div className="px-2 py-2 text-xs uppercase tracking-widest font-bold text-slate-600 bg-slate-100 rounded">
                      {group}
                    </div>
                    <div className="space-y-2 mt-2">
                      {groupAlerts.map((alert) => {
                        const col = threatColor(alert.threat_score);
                        const riskText = threatPlainLabel(alert.threat_score);
                        const alertType = alert.alert_type || 'Monitoring';
                        const isReviewed = reviewedHexIds.has(alert.hex_id);

                        return (
                          <div
                            key={`${alert.hex_id}-${alert.created_at}`}
                            onClick={() => {
                              onAlertClick(alert.hex_id);
                              onClose();
                            }}
                            className="p-4 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer transition-all border-l-4"
                            style={{ borderLeftColor: col }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-bold" style={{ color: col }}>
                                {riskText}
                              </span>
                              <span className="text-xs text-slate-500">
                                {formatTimeAgo(alert.created_at)}
                              </span>
                            </div>
                            <div className="text-base font-bold text-slate-900 mb-2">
                              {formatHexId(alert.hex_id)}
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-600 mb-3">
                              <span>Threat score: {formatScore(alert.threat_score)}</span>
                              <span className="px-2 py-1 bg-slate-200 rounded">{alertType}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-semibold ${isReviewed ? 'text-emerald-700' : 'text-amber-700'}`}>
                                {isReviewed ? '✓ Reviewed' : '⚠ Needs review'}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleReviewed(alert.hex_id);
                                }}
                                className="text-xs font-semibold text-slate-700 hover:text-slate-900 hover:underline"
                              >
                                {isReviewed ? 'Mark unreviewed' : 'Mark reviewed'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex-shrink-0 bg-slate-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
