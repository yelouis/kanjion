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
      className="bg-dossier-card border-4 border-dossier-ink shadow-ink-lg p-4 sm:p-5 font-mono-clean"
      aria-label="6-Line Western Union Telegram Dispatch Pad"
    >
      {/* Prominent Direct Instruction Header */}
      <div className="flex flex-wrap items-center justify-between border-b-2 border-dossier-ink pb-3 mb-3 gap-2">
        <div>
          <h2 className="font-black uppercase tracking-wider text-sm sm:text-base text-dossier-ink flex items-center gap-2">
            <span className="px-2 py-0.5 bg-dossier-ink text-dossier-accent text-xs">
              HOW TO PLAY
            </span>
            <span>FILL OUT UP TO 6 INSTRUCTIONS BELOW TO CONTROL THE AGENT</span>
          </h2>
          <p className="text-xs text-dossier-muted mt-0.5">
            Each line sends 1 English command (max 60 chars) to your AI agent above. Unused lines
            give a +20% score bonus.
          </p>
          <span className="sr-only">6-LINE WESTERN UNION DISPATCH PAD</span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="font-bold text-dossier-ink bg-stone-200 px-2.5 py-1 border border-dossier-ink">
            ACTIVE:{' '}
            <span id="active-line-label" className="font-black">
              {caseStatus === 'closed'
                ? 'CASE CLOSED'
                : `LINE ${String(activeLineIndex + 1).padStart(2, '0')} / 06`}
            </span>
          </span>
          <span className="px-2.5 py-1 bg-dossier-ink text-dossier-accent font-bold">
            CURRENT MULTIPLIER IF CLOSED NOW:{' '}
            <span id="live-mult-label">{currentMultiplier.toFixed(1)}x</span>
          </span>
        </div>
      </div>

      {/* 6 Large, Direct Instruction Slots */}
      <div className="space-y-2.5">
        {Array.from({ length: 6 }).map((_, index) => {
          const lineNumber = index + 1;
          const lineStr = String(lineNumber).padStart(2, '0');
          const lineData = telegrams[index];

          // 1. PAST SUBMITTED LINE
          if (lineData && lineData.submitted) {
            return (
              <div
                key={lineNumber}
                className="py-2.5 px-3.5 bg-stone-100 border-2 border-stone-400 flex flex-col sm:flex-row sm:items-center justify-between text-xs sm:text-sm gap-1"
              >
                <span className="text-dossier-ink">
                  <strong className="font-black mr-1.5">LINE {lineStr}:</strong> &quot;{lineData.text}&quot;
                </span>
                <span className="text-emerald-900 font-bold text-xs">
                  → {lineData.actionSummary || 'Agent executed action'} (Exhibit Status: ██ REDACTED ██)
                </span>
              </div>
            );
          }

          // 2. ACTIVE INPUT ROW (Large, high-contrast, impossible to miss)
          if (index === activeLineIndex && caseStatus === 'active') {
            return (
              <div
                key={lineNumber}
                className={`p-3 sm:p-3.5 bg-amber-100/90 border-2 border-dossier-ink shadow-ink flex flex-col gap-2.5 ${
                  inputShake ? 'shake-anim border-red-600 bg-red-100/50' : ''
                }`}
              >
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <span className="font-black text-sm sm:text-base text-dossier-ink bg-dossier-accent px-2.5 py-2 border-2 border-dossier-ink shrink-0 select-none text-center">
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
                      placeholder={`Type instruction #${lineNumber} in English (e.g. "click the green button in row 2")...`}
                      className="w-full bg-white border-2 border-dossier-ink px-3.5 py-2.5 pr-16 font-mono-clean font-bold text-sm sm:text-base text-dossier-ink placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-dossier-ink disabled:bg-stone-100 disabled:cursor-not-allowed"
                      autoFocus
                    />
                    <span
                      id="char-counter"
                      className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold font-mono-clean ${
                        currentInput.length >= 60 ? 'text-red-700 font-black' : 'text-dossier-muted'
                      }`}
                    >
                      {currentInput.length}/60
                    </span>
                  </div>

                  {/* Send Instruction Button */}
                  <button
                    type="button"
                    id="btn-dispatch-line"
                    disabled={isSubmitting}
                    onClick={handleDispatch}
                    className="btn-press px-5 py-2.5 bg-dossier-ink text-dossier-accent border-2 border-dossier-ink font-black text-sm uppercase shadow-ink-sm shrink-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    {isSubmitting ? (
                      <>
                        <span>SENDING...</span>
                        <span className="animate-pulse">⚡</span>
                      </>
                    ) : (
                      `DISPATCH LINE ${lineStr} ⏎`
                    )}
                  </button>
                </div>

                {/* Done / Submit Final Score Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-amber-300/80 text-xs">
                  <span className="text-dossier-ink font-bold">
                    💡 Press <strong>Enter</strong> to send this line, or click{' '}
                    <strong>Close Case File</strong> when your agent has finished copying the replay.
                  </span>
                  <button
                    type="button"
                    id="btn-close-case"
                    disabled={isSubmitting}
                    onClick={onCloseCase}
                    className="btn-press px-3.5 py-1.5 bg-dossier-accent text-dossier-ink border-2 border-dossier-ink font-black uppercase shadow-ink-sm shrink-0 disabled:opacity-50 hover:bg-amber-300"
                    title="Close the case file now and score your result"
                  >
                    🔒 CLOSE CASE FILE (UNSEAL EXHIBITS)
                  </button>
                </div>
              </div>
            );
          }

          // 3. CASE CLOSED LOCKOUT ROW
          if (index === activeLineIndex && caseStatus === 'closed') {
            return (
              <div
                key={lineNumber}
                className="py-2.5 px-3.5 bg-stone-200 border-2 border-stone-500 text-dossier-muted flex items-center justify-between font-bold text-xs sm:text-sm"
              >
                <span>LINE {lineStr}: [CASE CLOSED — DISPATCH PAD LOCKED]</span>
                <span className="text-stone-600 font-mono-clean uppercase">🔒 LOCKOUT ACTIVE</span>
              </div>
            );
          }

          // 4. FUTURE INSTRUCTION SLOT ROW
          const isFinalLine = lineNumber === 6;
          return (
            <div
              key={lineNumber}
              className="py-2.5 px-3.5 bg-stone-50 border border-dashed border-stone-300 flex flex-wrap items-center justify-between text-stone-500 text-xs sm:text-sm select-none gap-1"
            >
              <span className="font-bold">
                LINE {lineStr}:{' '}
                <span className="font-normal italic">
                  [
                  {isFinalLine
                    ? 'FINAL TELEGRAM LINE — AUTO-UNSEALS DOSSIER AFTER LINE 06'
                    : 'EMPTY INSTRUCTION SLOT'}
                  ]
                </span>
              </span>
              <span className="font-bold text-dossier-stampGreen text-xs">
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
