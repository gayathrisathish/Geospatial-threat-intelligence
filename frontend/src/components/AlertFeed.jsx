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

export default function AlertFeed({ alerts, onAlertClick, isLoading, mapHighRiskCount = 0 }) {
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

  const noVisualChange = hasActiveFilters && visibleCount === totalCount;

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

  return (
    <div className="bg-white border-b border-slate-300 flex flex-col overflow-hidden min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Triggered Alerts</h2>
        <span className="inline-flex items-center justify-center min-w-7 h-7 rounded-md bg-red-100 text-red-700 text-xs font-bold px-2">
          {alerts.length}
        </span>
      </div>

      <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 space-y-2">
        <div className="text-xs text-slate-600">
          Map view currently shows <span className="font-semibold text-slate-900">{mapHighRiskCount}</span> high-risk sectors.
        </div>
        <div className="text-xs text-slate-600">
          Showing <span className="font-semibold text-slate-900">{visibleCount}</span> of <span className="font-semibold text-slate-900">{totalCount}</span> alert events
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSeverityFilter('all')}
            className={`px-2 py-1 rounded text-xs font-semibold border ${severityFilter === 'all' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-300'}`}
          >
            All alert severities ({totalCount})
          </button>
          <button
            onClick={() => setSeverityFilter('high')}
            className={`px-2 py-1 rounded text-xs font-semibold border ${severityFilter === 'high' ? 'bg-red-700 text-white border-red-700' : 'bg-white text-slate-700 border-slate-300'}`}
          >
            High risk alerts ({highCount})
          </button>
          <button
            onClick={() => setSeverityFilter('medium')}
            className={`px-2 py-1 rounded text-xs font-semibold border ${severityFilter === 'medium' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-700 border-slate-300'}`}
          >
            Medium risk alerts ({mediumCount})
          </button>
          <button
            onClick={() => setSeverityFilter('low')}
            className={`px-2 py-1 rounded text-xs font-semibold border ${severityFilter === 'low' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-slate-700 border-slate-300'}`}
          >
            Low risk alerts ({lowCount})
          </button>
        </div>

        <details className="group">
          <summary className="cursor-pointer text-xs text-slate-600 font-semibold select-none">Time and workflow filters</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={() => setTimeFilter('all')}
              className={`px-2 py-1 rounded text-xs font-semibold border ${timeFilter === 'all' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-300'}`}
            >
              All time ({totalCount})
            </button>
            <button
              onClick={() => setTimeFilter('24h')}
              className={`px-2 py-1 rounded text-xs font-semibold border ${timeFilter === '24h' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-300'}`}
            >
              Last 24h ({last24hCount})
            </button>
            <button
              onClick={() => setTimeFilter('7d')}
              className={`px-2 py-1 rounded text-xs font-semibold border ${timeFilter === '7d' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-300'}`}
            >
              Last 7d ({last7dCount})
            </button>
            <button
              onClick={() => setOnlyUnreviewed((prev) => !prev)}
              className={`px-2 py-1 rounded text-xs font-semibold border ${onlyUnreviewed ? 'bg-cyan-700 text-white border-cyan-700' : 'bg-white text-slate-700 border-slate-300'}`}
            >
              Unreviewed only ({unreviewedCount})
            </button>
          </div>
        </details>

        {noVisualChange && (
          <div className="text-xs text-slate-500">
            Active filters currently match all alert events, so the list does not change.
          </div>
        )}

        {(hasActiveFilters || filteredAlerts.length !== sortedAlerts.length) && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
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

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {isLoading ? (
          <div className="space-y-2 pt-1">
            {[...Array(3)].map((_, idx) => (
              <div key={idx} className="h-20 rounded-md bg-slate-100 border border-slate-200 animate-pulse"></div>
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex items-center justify-center min-h-20 text-slate-500 text-sm text-center px-4">
            No alerts triggered yet. High-risk threshold crossings will appear here.
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="flex items-center justify-center min-h-20 text-slate-500 text-sm text-center px-4">
            No alerts match the active filters.
          </div>
        ) : (
          <div className="space-y-2">
            {Object.entries(groupedAlerts).map(([group, groupAlerts]) => (
              groupAlerts.length > 0 && (
                <div key={group}>
                  <div className="px-1 py-1 text-[11px] uppercase tracking-wide font-semibold text-slate-500">
                    {group}
                  </div>
                  <div className="space-y-2">
                    {groupAlerts.slice(0, 10).map((alert) => {
                      const col = threatColor(alert.threat_score);
                      const riskText = threatPlainLabel(alert.threat_score);
                      const alertType = alert.alert_type || 'Monitoring';
                      const isReviewed = reviewedHexIds.has(alert.hex_id);

                      return (
                        <div
                          key={`${alert.hex_id}-${alert.created_at}`}
                          onClick={() => onAlertClick(alert.hex_id)}
                          className="p-3 bg-slate-50 hover:bg-slate-100 rounded-md cursor-pointer transition-colors border border-slate-200 border-l-4"
                          style={{ borderLeftColor: col }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold" style={{ color: col }}>
                              {riskText}
                            </span>
                            <span className="text-xs text-slate-500">
                              {formatTimeAgo(alert.created_at)}
                            </span>
                          </div>
                          <div className="text-sm font-semibold text-slate-900 mb-1">
                            {formatHexId(alert.hex_id)}
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
                            <span>Threat score: {formatScore(alert.threat_score)}</span>
                            <span>{alertType}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">
                              {isReviewed ? 'Reviewed' : 'Needs review'}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleReviewed(alert.hex_id);
                              }}
                              className="text-xs font-semibold text-slate-700 hover:text-slate-900"
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
    </div>
  );
}
