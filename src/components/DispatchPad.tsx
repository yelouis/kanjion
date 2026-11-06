import React, { useState } from 'react';
import type { DispatchPadProps } from '../types/ui';

export const DispatchPad: React.FC<DispatchPadProps> = ({
  telegrams,
  activeLineIndex,
  currentInput,
  onInputChange,
  onSubmitLine,
  onCloseCase,
  caseStatus,
  currentMultiplier,
  isSubmitting = false,
}) => {
  const [inputShake, setInputShake] = useState<boolean>(false);

  // Trigger momentary shake animation if user tries to submit empty/whitespace text
  const handleDispatch = () => {
    if (caseStatus === 'closed' || isSubmitting) return;

    if (!currentInput.trim()) {
      setInputShake(true);
      setTimeout(() => setInputShake(false), 400);
      return;
    }

    onSubmitLine();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleDispatch();
    }
  };

  return (
    <section
      id="telegram-ledger"
      className="bg-dossier-card border-2 border-dossier-ink shadow-ink p-4 font-mono-clean"
      aria-label="6-Line Western Union Telegram Dispatch Pad"
    >
      {/* Ledger Header & Telemetry Bar */}
      <div className="flex flex-wrap items-center justify-between border-b-2 border-dossier-ink pb-2 mb-2 text-xs">
        <span className="font-black uppercase tracking-wider text-dossier-ink">
          📜 6-LINE WESTERN UNION DISPATCH PAD (MAX 60 CHARS PER LINE)
        </span>
        <div className="flex items-center gap-3">
          <span className="font-bold text-dossier-ink">
            ACTIVE:{' '}
            <span id="active-line-label">
              {caseStatus === 'closed'
                ? 'CASE CLOSED'
                : `LINE ${String(activeLineIndex + 1).padStart(2, '0')} / 06`}
            </span>
          </span>
          <span className="px-2 py-0.5 bg-dossier-ink text-dossier-accent font-bold">
            CURRENT MULTIPLIER IF CLOSED NOW:{' '}
            <span id="live-mult-label">{currentMultiplier.toFixed(1)}x</span>
          </span>
        </div>
      </div>

      {/* 6 Simultaneous Ledger Rows */}
      <div className="divide-y divide-stone-300 text-xs">
        {Array.from({ length: 6 }).map((_, index) => {
          const lineNumber = index + 1;
          const lineStr = String(lineNumber).padStart(2, '0');
          const lineData = telegrams[index];

          // 1. PAST SUBMITTED LINE
          if (lineData && lineData.submitted) {
            return (
              <div
                key={lineNumber}
                className="py-2 flex flex-col sm:flex-row sm:items-center justify-between text-dossier-muted gap-1 transition-colors hover:bg-stone-50 px-1"
              >
                <span>
                  <strong className="text-dossier-ink">LINE {lineStr}:</strong> "{lineData.text}"
                </span>
                <span className="text-dossier-ink font-bold">
                  → {lineData.actionSummary || 'Agent executed action'} (Exhibit Status: ██ REDACTED ██)
                </span>
              </div>
            );
          }

          // 2. ACTIVE INPUT ROW (When case is active and this is the active index)
          if (index === activeLineIndex && caseStatus === 'active') {
            return (
              <div
                key={lineNumber}
                className={`py-2.5 bg-dossier-accent/35 px-2.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 border-l-4 border-dossier-ink my-1 ${
                  inputShake ? 'shake-anim border-red-600 bg-red-100/50' : ''
                }`}
              >
                <span className="font-black text-dossier-ink shrink-0 select-none">
                  LINE {lineStr} ▸
                </span>
                <div className="relative flex-1">
                  <input
                    id="telegram-input"
                    type="text"
                    maxLength={60}
                    value={currentInput}
                    disabled={isSubmitting}
                    onChange={(e) => onInputChange(e.target.value.slice(0, 60))}
                    onKeyDown={handleKeyDown}
                    placeholder="Write instruction (max 60 chars)..."
                    className="w-full bg-dossier-card border-2 border-dossier-ink px-2.5 py-1.5 pr-16 font-mono-clean font-bold text-sm text-dossier-ink focus:outline-none focus:ring-1 focus:ring-dossier-ink disabled:bg-stone-100 disabled:cursor-not-allowed"
                    autoFocus
                  />
                  {/* Live Character Countdown Ruler */}
                  <span
                    id="char-counter"
                    className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold font-mono-clean ${
                      currentInput.length >= 60 ? 'text-red-700 font-black' : 'text-dossier-muted'
                    }`}
                  >
                    {currentInput.length}/60
                  </span>
                </div>

                {/* Mechanical Telegraph Transmit Button */}
                <button
                  type="button"
                  id="btn-dispatch-line"
                  disabled={isSubmitting}
                  onClick={handleDispatch}
                  className="btn-press px-4 py-1.5 bg-dossier-ink text-dossier-paper font-bold uppercase shadow-ink-sm shrink-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <span>TRANSMITTING...</span>
                      <span className="animate-pulse">⚡</span>
                    </>
                  ) : (
                    `DISPATCH LINE ${lineStr} ⏎`
                  )}
                </button>

                {/* Early Case Closure Button */}
                <button
                  type="button"
                  id="btn-close-case"
                  disabled={isSubmitting}
                  onClick={onCloseCase}
                  className="btn-press px-3.5 py-1.5 bg-dossier-accent text-dossier-ink border-2 border-dossier-ink font-black uppercase shadow-ink-sm shrink-0 disabled:opacity-50"
                  title="Close the case file now and lock in your unused line efficiency multiplier"
                >
                  🔒 CLOSE CASE FILE (UNSEAL EXHIBITS)
                </button>
              </div>
            );
          }

          // 3. CASE CLOSED LOCKOUT ROW (If active line was not submitted and case is closed)
          if (index === activeLineIndex && caseStatus === 'closed') {
            return (
              <div
                key={lineNumber}
                className="py-2 px-3 bg-stone-200 border-l-4 border-stone-500 text-dossier-muted flex items-center justify-between font-bold"
              >
                <span>LINE {lineStr}: [CASE CLOSED — DISPATCH PAD LOCKED]</span>
                <span className="text-stone-600 font-mono-clean uppercase">🔒 LOCKOUT ACTIVE</span>
              </div>
            );
          }

          // 4. FUTURE BONUS WATERMARK ROW
          const isFinalLine = lineNumber === 6;
          return (
            <div
              key={lineNumber}
              className="py-2 flex items-center justify-between text-stone-400 italic px-1 select-none"
            >
              <span>
                LINE {lineStr}: [
                {isFinalLine
                  ? 'FINAL TELEGRAM LINE — AUTO-UNSEALS DOSSIER AFTER LINE 06'
                  : 'UNSENT TELEGRAM LINE'}
                ]
              </span>
              <span className="font-bold text-dossier-stampGreen not-italic">
                KEEP BLANK FOR +20% EFFICIENCY MULTIPLIER
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default DispatchPad;
