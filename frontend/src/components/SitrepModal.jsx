import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDate, formatHexId, formatScore } from '../utils/formatters.js';

export default function SitrepModal({
  isOpen,
  hexId,
  selectedHex,
  alerts = [],
  sitrepText,
  draftSections = [],
  isLoading,
  error,
  onClearDraftSections,
  onClose,
}) {
  const modalRef = useRef(null);
  const [step, setStep] = useState(1);
  const [scope, setScope] = useState({
    selectedSector: true,
    alertSnapshot: true,
    chatInsights: true,
    generatedSitrep: true,
  });
  const [sections, setSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [copied, setCopied] = useState(false);

  const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    const handleFocusTrap = (e) => {
      if (!isOpen || e.key !== 'Tab' || !modalRef.current) return;

      const nodes = Array.from(modalRef.current.querySelectorAll(FOCUSABLE));
      if (nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      window.addEventListener('keydown', handleFocusTrap);
      document.body.style.overflow = 'hidden';

      const focusTarget = modalRef.current?.querySelector('button');
      focusTarget?.focus();

      return () => {
        window.removeEventListener('keydown', handleEscape);
        window.removeEventListener('keydown', handleFocusTrap);
        document.body.style.overflow = 'auto';
      };
    }
  }, [isOpen, onClose]);

  const relevantAlerts = useMemo(() => {
    if (!selectedHex) return alerts.slice(0, 5);
    const matching = alerts.filter((alert) => alert.hex_id === selectedHex.hex_id);
    return (matching.length > 0 ? matching : alerts).slice(0, 5);
  }, [alerts, selectedHex]);

  useEffect(() => {
    if (!isOpen) return;

    setStep(1);
    setScope({
      selectedSector: Boolean(selectedHex),
      alertSnapshot: alerts.length > 0,
      chatInsights: draftSections.length > 0,
      generatedSitrep: Boolean(sitrepText),
    });
    setSections([]);
    setSelectedSectionId(null);
    setCopied(false);
  }, [isOpen, selectedHex, alerts.length, draftSections.length, sitrepText]);

  const buildSectionsFromScope = () => {
    const built = [];

    if (scope.selectedSector && selectedHex) {
      built.push({
        id: `scope-sector-${selectedHex.hex_id}`,
        title: `Selected Sector Summary - ${formatHexId(selectedHex.hex_id)}`,
        body: [
          `Sector: ${selectedHex.hex_id}`,
          `Threat score: ${formatScore(selectedHex.threat_score)}/100`,
          `Anomaly: ${selectedHex.anomaly_flag === 1 ? 'Detected' : 'Not detected'}`,
          `Prepared on: ${formatDate(new Date().toISOString())}`,
        ].join('\n'),
      });
    }

    if (scope.alertSnapshot && relevantAlerts.length > 0) {
      built.push({
        id: 'scope-alerts',
        title: 'Triggered Alert Snapshot',
        body: relevantAlerts
          .map((alert, idx) => {
            const timestamp = formatDate(alert.created_at || new Date().toISOString());
            return `${idx + 1}. ${formatHexId(alert.hex_id)} | score ${formatScore(alert.threat_score)} | ${alert.alert_type || 'monitoring'} | ${timestamp}`;
          })
          .join('\n'),
      });
    }

    if (scope.chatInsights && draftSections.length > 0) {
      built.push({
        id: 'scope-chat',
        title: 'Analyst Chat Insights',
        body: draftSections
          .slice(0, 5)
          .map((section, idx) => `${idx + 1}. ${formatHexId(section.hexId)}\n${section.text}`)
          .join('\n\n'),
      });
    }

    if (scope.generatedSitrep && sitrepText) {
      built.push({
        id: 'scope-generated',
        title: 'Model Generated SITREP',
        body: sitrepText,
      });
    }

    return built;
  };

  const moveToReview = () => {
    const built = buildSectionsFromScope();
    setSections(built);
    setSelectedSectionId(built[0]?.id || null);
    setStep(2);
  };

  const applySuggestion = (sectionId, suggestionType) => {
    const templates = {
      impact: '\n\nImpact:\n- Potential disruption to population safety and logistics if conditions persist.',
      recommendation: '\n\nRecommended Action:\n- Increase monitoring cadence and coordinate response planning within 24 hours.',
      source: '\n\nSource Note:\n- Derived from fused signals, triggered alerts, and analyst chat synthesis.',
    };

    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? { ...section, body: `${section.body}${templates[suggestionType] || ''}` }
          : section
      )
    );
  };

  const updateSectionBody = (sectionId, newBody) => {
    setSections((prev) => prev.map((section) => (section.id === sectionId ? { ...section, body: newBody } : section)));
  };

  const compiledReport = useMemo(() => {
    const header = `SITUATION REPORT (SITREP)\nSECTOR: ${hexId || 'N/A'}\nGENERATED: ${new Date().toISOString()}\n`;
    const sectionText = sections
      .map((section, idx) => `\n${idx + 1}. ${section.title}\n${section.body}`)
      .join('\n\n');
    return `${header}${sectionText}`.trim();
  }, [sections, hexId]);

  const selectedSection = sections.find((section) => section.id === selectedSectionId) || sections[0] || null;

  const handleCopy = () => {
    if (compiledReport) {
      navigator.clipboard.writeText(compiledReport);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!compiledReport) return;

    const safeHex = (hexId || 'sector').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `sitrep_${safeHex}_${new Date().toISOString().slice(0, 10)}.txt`;
    const blob = new Blob([compiledReport], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/45 flex items-center justify-center p-3 sm:p-5 z-[2100]"
      onClick={handleOverlayClick}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        className="bg-white border border-slate-300 rounded-lg w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">Intelligence Brief Wizard</div>
            <div className="text-lg font-bold text-slate-900">{formatHexId(hexId)}</div>
            <div className="text-xs text-slate-500 mt-1">Step {step} of 3</div>
          </div>
          <button
            onClick={onClose}
            className="text-2xl text-slate-400 hover:text-slate-700 transition-colors"
            aria-label="Close SITREP modal"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            {[1, 2, 3].map((index) => (
              <div
                key={index}
                className={`h-2 flex-1 rounded ${step >= index ? 'bg-emerald-600' : 'bg-slate-200'}`}
              ></div>
            ))}
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-4">
              <div className="flex gap-1">
                <span className="dot w-2 h-2 bg-emerald-600 rounded-full"></span>
                <span className="dot w-2 h-2 bg-emerald-600 rounded-full"></span>
                <span className="dot w-2 h-2 bg-emerald-600 rounded-full"></span>
              </div>
              <p className="text-sm text-slate-500">Generating SITREP...</p>
            </div>
          ) : step === 1 ? (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-semibold text-slate-800">1) Select scope</div>
                <p className="text-xs text-slate-600 mt-1">Choose what to include in this SITREP draft.</p>
              </div>

              <label className="flex items-center justify-between border border-slate-200 rounded p-3 bg-slate-50">
                <div>
                  <div className="text-sm font-semibold text-slate-800">Selected sector summary</div>
                  <div className="text-xs text-slate-500">Use the currently pinned map sector.</div>
                </div>
                <input
                  type="checkbox"
                  checked={scope.selectedSector}
                  disabled={!selectedHex}
                  onChange={(e) => setScope((prev) => ({ ...prev, selectedSector: e.target.checked }))}
                />
              </label>

              <label className="flex items-center justify-between border border-slate-200 rounded p-3 bg-slate-50">
                <div>
                  <div className="text-sm font-semibold text-slate-800">Triggered alert snapshot</div>
                  <div className="text-xs text-slate-500">Add latest alert events relevant to this brief.</div>
                </div>
                <input
                  type="checkbox"
                  checked={scope.alertSnapshot}
                  disabled={alerts.length === 0}
                  onChange={(e) => setScope((prev) => ({ ...prev, alertSnapshot: e.target.checked }))}
                />
              </label>

              <label className="flex items-center justify-between border border-slate-200 rounded p-3 bg-slate-50">
                <div>
                  <div className="text-sm font-semibold text-slate-800">Chat insights</div>
                  <div className="text-xs text-slate-500">Include analyst chat findings added from chat actions.</div>
                </div>
                <input
                  type="checkbox"
                  checked={scope.chatInsights}
                  disabled={draftSections.length === 0}
                  onChange={(e) => setScope((prev) => ({ ...prev, chatInsights: e.target.checked }))}
                />
              </label>

              <label className="flex items-center justify-between border border-slate-200 rounded p-3 bg-slate-50">
                <div>
                  <div className="text-sm font-semibold text-slate-800">Model-generated SITREP</div>
                  <div className="text-xs text-slate-500">Include backend narrative output if available.</div>
                </div>
                <input
                  type="checkbox"
                  checked={scope.generatedSitrep}
                  disabled={!sitrepText}
                  onChange={(e) => setScope((prev) => ({ ...prev, generatedSitrep: e.target.checked }))}
                />
              </label>

              {!sitrepText && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  Model-generated SITREP is not loaded yet. You can still create a report from sector, alert, and chat context.
                </p>
              )}

              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
          ) : step === 2 ? (
            <div className="space-y-4">
              <div className="text-sm font-semibold text-slate-800">2) Review findings</div>

              {sections.length === 0 ? (
                <p className="text-sm text-slate-500">No sections selected. Go back and choose at least one scope item.</p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-3">
                  <div className="space-y-2">
                    {sections.map((section) => (
                      <button
                        key={section.id}
                        onClick={() => setSelectedSectionId(section.id)}
                        className={`w-full text-left text-xs px-3 py-2 rounded border ${selectedSection?.id === section.id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'}`}
                      >
                        {section.title}
                      </button>
                    ))}
                  </div>

                  {selectedSection && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-800">{selectedSection.title}</div>
                        <div className="flex gap-1 flex-wrap justify-end">
                          <button onClick={() => applySuggestion(selectedSection.id, 'impact')} className="text-[11px] px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100">Add impact</button>
                          <button onClick={() => applySuggestion(selectedSection.id, 'recommendation')} className="text-[11px] px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100">Add recommendation</button>
                          <button onClick={() => applySuggestion(selectedSection.id, 'source')} className="text-[11px] px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100">Add source note</button>
                        </div>
                      </div>

                      <textarea
                        value={selectedSection.body}
                        onChange={(e) => updateSectionBody(selectedSection.id, e.target.value)}
                        className="w-full min-h-[260px] rounded border border-slate-300 p-3 text-sm text-slate-800 focus:outline-none focus:border-slate-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-semibold text-slate-800">3) Export</div>
                <p className="text-xs text-slate-600 mt-1">Final SITREP preview</p>
              </div>

              <div className="font-mono text-sm text-slate-800 whitespace-pre-wrap leading-relaxed bg-slate-900/5 border border-slate-200 rounded-md p-3 sm:p-4 max-h-[420px] overflow-y-auto">
                {compiledReport || 'No content generated yet.'}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-5 border-t border-slate-200 space-y-2">
          {step === 1 && (
            <button
              onClick={moveToReview}
              className="w-full bg-slate-700 hover:bg-slate-800 text-white font-semibold py-2.5 px-4 rounded text-sm uppercase tracking-wide transition-colors"
            >
              Review Findings
            </button>
          )}

          {step === 2 && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setStep(1)}
                className="w-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold py-2.5 px-4 rounded text-sm uppercase tracking-wide transition-colors"
              >
                Back to Scope
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={sections.length === 0}
                className="w-full bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded text-sm uppercase tracking-wide transition-colors"
              >
                Continue to Export
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setStep(2)}
                  className="w-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold py-2.5 px-4 rounded text-sm uppercase tracking-wide transition-colors"
                >
                  Back to Review
                </button>
                <button
                  onClick={handleDownload}
                  disabled={!compiledReport}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded text-sm uppercase tracking-wide transition-colors"
                >
                  Export .txt
                </button>
              </div>

              <button
                onClick={handleCopy}
                disabled={!compiledReport}
                className="w-full bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded text-sm uppercase tracking-wide transition-colors"
              >
                {copied ? 'Copied' : 'Copy SITREP Content'}
              </button>

              {draftSections.length > 0 && (
                <button
                  onClick={onClearDraftSections}
                  className="w-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold py-2.5 px-4 rounded text-sm uppercase tracking-wide transition-colors"
                >
                  Clear Draft Sections
                </button>
              )}
            </div>
          )}

          {step !== 3 && (
            <button
              onClick={onClose}
              className="w-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold py-2.5 px-4 rounded text-sm uppercase tracking-wide transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
