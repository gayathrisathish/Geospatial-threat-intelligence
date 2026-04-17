import { useEffect, useState, useRef } from 'react';
import { askQuestion } from '../api.js';
import { threatPlainLabel } from '../utils/colorScale.js';
import { formatHexId, formatScore } from '../utils/formatters.js';

const SUGGESTED_QUESTIONS = [
  'What changed in this sector today?',
  'Explain why this sector is high risk in plain language.',
  'What are the top 3 emerging hotspots right now?',
  'What actions should operators take in the next 24 hours?',
];

export default function ChatPanel({ isOpen, selectedHex, onAddSitrepSection, onOpenSitrep, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [pinnedInsights, setPinnedInsights] = useState([]);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!isOpen) {
      setMessages([]);
      setInput('');
      setIsLoading(false);
      setCopiedId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !selectedHex) return;
  }, [isOpen, selectedHex?.hex_id]);

  const buildSectorContext = () => {
    if (!selectedHex) return '';

    const riskLabel = threatPlainLabel(selectedHex.threat_score);
    const topDrivers = Object.entries(selectedHex.risk_drivers || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key, value]) => `${key}:${value.toFixed(1)}%`)
      .join(', ');

    return [
      `Sector: ${selectedHex.hex_id}`,
      `Sector label: ${formatHexId(selectedHex.hex_id)}`,
      `Threat score: ${formatScore(selectedHex.threat_score)}`,
      `Risk level: ${riskLabel}`,
      `Anomaly flag: ${selectedHex.anomaly_flag === 1 ? 'yes' : 'no'}`,
      `Top drivers: ${topDrivers || 'not available'}`,
    ].join('\n');
  };

  const contextPreview = selectedHex
    ? `${formatHexId(selectedHex.hex_id)} | ${threatPlainLabel(selectedHex.threat_score)} (${formatScore(selectedHex.threat_score)}/100)`
    : 'No sector selected';

  const handleSendMessage = async (question) => {
    if (!question.trim() || !selectedHex) return;

    // Add user message
    const userMsg = { id: Date.now(), type: 'user', text: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Fetch AI response
    const contextualQuestion = `${question}\n\nUse this sector context while answering:\n${buildSectorContext()}`;
    const { data, error } = await askQuestion(selectedHex.hex_id, contextualQuestion);
    setIsLoading(false);

    if (data?.answer) {
      const aiMsg = { id: Date.now() + 1, type: 'ai', text: data.answer, hexId: selectedHex.hex_id };
      setMessages((prev) => [...prev, aiMsg]);
    } else {
      const errorMsg = { id: Date.now() + 1, type: 'ai', text: `Error: ${error}` };
      setMessages((prev) => [...prev, errorMsg]);
    }
  };

  const handleQuestionChip = (question) => {
    handleSendMessage(question);
  };

  const handleBackToSuggestions = () => {
    setMessages([]);
    setInput('');
  };

  const handleCopyInsight = async (msg) => {
    if (!msg?.text) return;
    await navigator.clipboard.writeText(msg.text);
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(null), 1600);
  };

  const handlePinInsight = (msg) => {
    setPinnedInsights((prev) => {
      const exists = prev.some((item) => item.id === msg.id);
      if (exists) return prev;
      return [msg, ...prev];
    });
  };

  const handleCreateSitrepSection = (msg) => {
    if (!msg?.text) return;
    onAddSitrepSection?.(msg.text);
    onOpenSitrep?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-900/25" onClick={onClose}>
      <div className="absolute right-0 top-0 h-full w-full max-w-[380px] bg-white border-l border-slate-300 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Analyst Q&A</h2>
          <button
            onClick={onClose}
            className="text-2xl text-slate-400 hover:text-slate-700 transition-colors"
            aria-label="Close analyst panel"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
          <div className="p-3 rounded border border-cyan-200 bg-cyan-50">
            <div className="text-[11px] uppercase tracking-wide text-cyan-700 font-semibold mb-1">Sector context loaded</div>
            <div className="text-xs text-cyan-900">{contextPreview}</div>
            <div className="text-[11px] text-cyan-700 mt-1">Context updates automatically when you select a different sector on the map.</div>
          </div>

          {pinnedInsights.length > 0 && (
            <div className="p-3 rounded border border-amber-200 bg-amber-50 space-y-2">
              <div className="text-[11px] uppercase tracking-wide text-amber-700 font-semibold">Pinned insights ({pinnedInsights.length})</div>
              {pinnedInsights.slice(0, 3).map((item) => (
                <div key={`pinned-${item.id}`} className="text-xs text-amber-900 line-clamp-2">
                  {item.text}
                </div>
              ))}
            </div>
          )}

          {messages.length === 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 mb-1">Prompt starters:</p>
              <p className="text-[11px] text-slate-500 mb-3">Questions below are sent with the selected sector context automatically.</p>
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleQuestionChip(q)}
                  className="w-full text-left text-xs p-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded transition-colors text-slate-700"
                >
                  {q}
                </button>
              ))}
            </div>
          ) : (
            <>
              <button
                onClick={handleBackToSuggestions}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline underline-offset-2"
              >
                Back to suggested questions
              </button>
              {messages.map((msg) => (
                <div key={msg.id}>
                  <div className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] px-4 py-2 rounded text-sm ${
                        msg.type === 'user' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-800 font-mono'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>

                  {msg.type === 'ai' && !msg.text.startsWith('Error:') && (
                    <div className="flex justify-start gap-2 mt-1 ml-1">
                      <button
                        onClick={() => handleCopyInsight(msg)}
                        className="text-[11px] px-2 py-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                      >
                        {copiedId === msg.id ? 'Copied' : 'Copy summary'}
                      </button>
                      <button
                        onClick={() => handleCreateSitrepSection(msg)}
                        className="text-[11px] px-2 py-1 rounded border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                      >
                        Create SITREP section
                      </button>
                      <button
                        onClick={() => handlePinInsight(msg)}
                        className="text-[11px] px-2 py-1 rounded border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                      >
                        Pin insight
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-200 text-slate-700 px-4 py-2 rounded text-sm flex items-center gap-1">
                    <span>Analysing</span>
                    <span className="dot w-1.5 h-1.5 bg-slate-500 rounded-full"></span>
                    <span className="dot w-1.5 h-1.5 bg-slate-500 rounded-full"></span>
                    <span className="dot w-1.5 h-1.5 bg-slate-500 rounded-full"></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <div className="p-4 border-t border-slate-200" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isLoading) {
                  handleSendMessage(input);
                }
              }}
              disabled={isLoading}
              placeholder={selectedHex ? 'Ask about this sector...' : 'Select a sector on the map first'}
              className="flex-1 bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 disabled:opacity-50"
            />
            <button
              onClick={() => handleSendMessage(input)}
              disabled={isLoading || !input.trim()}
              className="bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white px-3 py-2 rounded transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
