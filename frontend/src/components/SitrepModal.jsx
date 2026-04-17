import { useEffect, useRef, useState } from 'react';
import { formatHexId } from '../utils/formatters.js';

export default function SitrepModal({ isOpen, hexId, sitrepText, isLoading, error, onClose }) {
  const modalRef = useRef(null);
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

  const handleCopy = () => {
    if (sitrepText) {
      navigator.clipboard.writeText(sitrepText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
        className="bg-white border border-slate-300 rounded-lg w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">Intelligence Brief</div>
            <div className="text-lg font-bold text-slate-900">{formatHexId(hexId)}</div>
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
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-4">
              <div className="flex gap-1">
                <span className="dot w-2 h-2 bg-emerald-600 rounded-full"></span>
                <span className="dot w-2 h-2 bg-emerald-600 rounded-full"></span>
                <span className="dot w-2 h-2 bg-emerald-600 rounded-full"></span>
              </div>
              <p className="text-sm text-slate-500">Generating SITREP...</p>
            </div>
          ) : sitrepText ? (
            <div className="font-mono text-sm text-emerald-700 whitespace-pre-wrap text-glow leading-relaxed bg-slate-900/5 border border-slate-200 rounded-md p-3 sm:p-4">
              {sitrepText}
            </div>
          ) : error ? (
            <p className="text-red-600">{error}</p>
          ) : (
            <p className="text-red-600">Error generating SITREP</p>
          )}
        </div>

        {sitrepText && (
          <div className="p-4 sm:p-5 border-t border-slate-200">
            <button
              onClick={handleCopy}
              className="w-full bg-slate-700 hover:bg-slate-800 text-white font-semibold py-2.5 px-4 rounded text-sm uppercase tracking-wide transition-colors"
            >
              {copied ? '✓ Copied to Clipboard' : 'Copy to Clipboard'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
