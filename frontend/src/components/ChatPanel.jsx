import { useEffect, useState, useRef } from 'react';
import { askQuestion } from '../api.js';

const SUGGESTED_QUESTIONS = [
  'Why is this sector flagged?',
  'What is the main threat driver?',
  'How serious is this anomaly?',
  'What happened recently here?',
];

export default function ChatPanel({ isOpen, selectedHex, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
    }
  }, [isOpen]);

  const handleSendMessage = async (question) => {
    if (!question.trim() || !selectedHex) return;

    // Add user message
    const userMsg = { id: Date.now(), type: 'user', text: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Fetch AI response
    const { data, error } = await askQuestion(selectedHex.hex_id, question);
    setIsLoading(false);

    if (data?.answer) {
      const aiMsg = { id: Date.now() + 1, type: 'ai', text: data.answer };
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
          {messages.length === 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 mb-4">Suggested questions:</p>
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
                <div
                  key={msg.id}
                  className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-2 rounded text-sm ${
                      msg.type === 'user'
                        ? 'bg-blue-700 text-white'
                        : 'bg-slate-200 text-slate-800 font-mono'
                    }`}
                  >
                    {msg.text}
                  </div>
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
              placeholder="Ask about this sector..."
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
