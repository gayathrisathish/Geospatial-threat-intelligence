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

export default function AlertFeed({ alerts, onAlertClick, isLoading, mapHighRiskCount = 0, onOpenAlerts }) {
  const sortedAlerts = [...alerts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  const unreviewedCount = sortedAlerts.filter((a) => !a.reviewed).length;
  const highRiskCount = sortedAlerts.filter((a) => severityBucket(a.threat_score) === 'high').length;

  return (
    <div className="bg-white border-b border-slate-300 p-6 flex flex-col items-center justify-center gap-4">
      <div className="text-center">
        <div className="text-sm text-slate-600 mb-4">
          <span className="font-semibold text-slate-900">{sortedAlerts.length}</span> alerts triggered
        </div>
        <button
          onClick={onOpenAlerts}
          className="inline-flex items-center gap-3 px-6 py-3 bg-red-700 hover:bg-red-800 text-white font-bold rounded-lg transition-colors shadow-lg hover:shadow-xl"
        >
          <span className="text-xl">🔔</span>
          <span>View Alerts</span>
          {unreviewedCount > 0 && (
            <span className="ml-2 px-2.5 py-0.5 bg-red-900 rounded-full text-sm font-bold">
              {unreviewedCount} unreviewed
            </span>
          )}
        </button>
        {highRiskCount > 0 && (
          <div className="mt-3 text-xs text-red-600 font-semibold">
            ⚠️ {highRiskCount} high-risk alerts
          </div>
        )}
      </div>
    </div>
  );
}
