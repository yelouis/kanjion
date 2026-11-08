import React, { useState } from 'react';
import type { ExhibitsPanelProps } from '../types/ui';
import type { StampStatus } from '../types/game';

export const ExhibitsPanel: React.FC<ExhibitsPanelProps> = ({
  caseClosed,
  scoreReport,
  officialResult,
  mode = 'official',
  caseNumber = '#001',
  onCopyClipping,
  onStartPractice,
  onReopenCase,
}) => {
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false);
  const handlePractice = onStartPractice ?? onReopenCase;

  // Return null or sealed teaser if case is not closed
  if (!caseClosed || !scoreReport) {
    return (
      <section
        id="sealed-exhibits-preview"
        className="mt-6 bg-dossier-card border-2 border-dashed border-stone-400 p-4 text-center font-mono-clean select-none"
      >
        <div className="flex items-center justify-center gap-2 text-xs font-bold text-dossier-muted">
          <span className="px-2 py-0.5 bg-red-800 text-amber-200 font-black uppercase">
            ██ TOP SECRET ██
          </span>
          <span>5 REQUIRED EXHIBITS ARE CURRENTLY SEALED BEHIND REDACTION BARS</span>
        </div>
        <p className="text-xs text-stone-500 mt-1 italic">
          Complete Line 06 or click "Close Case File" to unseal declassified exhibits and rubber ink stamps.
        </p>
      </section>
    );
  }

  const {
    closenessScore,
    multiplier,
    finalScore,
    exhibitEvaluations,
    shareableClipping,
  } = scoreReport;

  const effectiveClipping = (officialResult?.shareableClipping ?? shareableClipping) || '';
  const [shareLine1 = '', shareLine2 = ''] = effectiveClipping.split('\n');

  const handleCopy = () => {
    if (onCopyClipping) {
      onCopyClipping();
    } else if (effectiveClipping && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(effectiveClipping).catch(() => {});
    }
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2500);
  };

  const getStampClasses = (status: StampStatus, rotationDeg: number) => {
    const isVerified = status === 'VERIFIED';
    const colorClass = isVerified
      ? 'border-dossier-stampGreen text-dossier-stampGreen'
      : 'border-dossier-stampRed text-dossier-stampRed';
    const rotationClass = rotationDeg < 0 ? 'stamp-rotate' : 'stamp-rotate-alt';
    return `${colorClass} ${rotationClass}`;
  };

  return (
    <section
      id="unsealed-exhibits-panel"
      data-testid="unsealed-exhibits-panel"
      className="mt-6 bg-dossier-card border-4 border-dossier-ink shadow-ink-lg p-5 font-mono-clean"
      aria-label="Declassified Forensic Audit Report"
    >
      {/* Unsealed Header with Score Banner */}
      <div className="flex flex-wrap items-center justify-between border-b-4 border-double border-dossier-ink pb-3 mb-4 gap-3">
        <div>
          <span className="px-2 py-0.5 bg-dossier-ink text-dossier-accent font-mono-clean font-black text-xs uppercase inline-block">
            🔓 CASE FILE UNSEALED — DECLASSIFIED TARGET EXHIBITS
          </span>
          <h2 className="font-gazette font-black text-2xl mt-1 text-dossier-ink">
            FORENSIC AUDIT REPORT • CASE {caseNumber}
          </h2>
        </div>
        <div className="text-right">
          <div className="text-xs text-dossier-muted font-bold tracking-wider">
            {mode === 'practice' ? 'PRACTICE RESULT — NOT SCORED' : 'FINAL VERIFIED SCORE'}
          </div>
          <div
            id="final-score-banner"
            className="text-2xl font-black text-dossier-stampGreen font-mono-clean"
          >
            {closenessScore}% × {multiplier.toFixed(1)}x = {finalScore} PTS
          </div>
        </div>
      </div>

      {/* The 5 Declassified Target Exhibits Strip */}
      <div className="font-mono-clean text-xs font-bold uppercase tracking-wider text-dossier-muted mb-2">
        📌 THE 5 DECLASSIFIED TARGET EXHIBITS (EVALUATED AGAINST YOUR FINAL SANDBOX STATE):
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-5 font-mono-clean">
        {exhibitEvaluations.map((ex, index) => {
          const letterCode = ex.code || String.fromCharCode(65 + index); // A, B, C, D, E
          return (
            <div
              key={ex.id}
              id={`card-${ex.id}`}
              className="bg-dossier-paper border-2 border-dossier-ink p-2.5 shadow-ink flex flex-col justify-between min-h-[130px] transition-transform hover:-translate-y-0.5"
            >
              <div>
                <div className="text-xs text-dossier-muted border-b border-dossier-ink pb-1 mb-1 flex justify-between font-bold">
                  <span>EXHIBIT {letterCode}</span>
                  <span className="text-dossier-ink">+{ex.weight}%</span>
                </div>
                <div className="font-bold text-xs mb-2 text-dossier-ink line-clamp-2">
                  {ex.title}
                </div>
              </div>

              {/* Dynamic Angled Rubber Ink Stamp Badge */}
              <div className="pt-2">
                <span
                  id={`exhibit-${letterCode.toLowerCase()}-stamp`}
                  className={`inline-block px-1.5 py-0.5 border-2 font-black text-xs select-none ${getStampClasses(
                    ex.status,
                    ex.rotationDeg
                  )}`}
                >
                  {ex.stampText || `[${ex.status} ✓]`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Answer Key when the player did not pass all 5 exhibits */}
      {closenessScore < 100 && (
        <div
          id="answer-key-panel"
          data-testid="answer-key-panel"
          className="mb-5 p-4 bg-amber-50 border-2 border-dossier-ink shadow-ink font-mono-clean text-xs space-y-2.5"
        >
          <div className="flex flex-wrap items-center justify-between border-b-2 border-dossier-ink pb-1.5 gap-2">
            <span className="font-black text-sm text-dossier-ink uppercase">
              🔑 ANSWER KEY — INSTRUCTIONS THAT WOULD HAVE WORKED
            </span>
            <span className="px-2 py-0.5 bg-dossier-ink text-dossier-accent font-bold">
              5-STEP SOLUTION (120 PTS)
            </span>
          </div>
          <ol className="space-y-1.5 text-dossier-ink list-decimal list-inside">
            <li>
              <strong>Page 01 (Route Selection):</strong>{' '}
              <code className="px-1.5 py-0.5 bg-white border border-stone-400 font-bold">
                &quot;Click the top-left green box&quot;
              </code>{' '}
              <span className="text-dossier-muted">
                → Selects Tokaido Shinkansen (東京 ⇒ 新大阪)
              </span>
            </li>
            <li>
              <strong>Page 02 (Passenger Name):</strong>{' '}
              <code className="px-1.5 py-0.5 bg-white border border-stone-400 font-bold">
                &quot;Type TANAKA in the passenger name box&quot;
              </code>{' '}
              <span className="text-dossier-muted">
                → Enters TANAKA into 搭乗者名 &amp; advances to Page 03
              </span>
            </li>
            <li>
              <strong>Page 03 (Seat Matrix):</strong>{' '}
              <code className="px-1.5 py-0.5 bg-white border border-stone-400 font-bold">
                &quot;Click the green 13,870 button in the 2nd row&quot;
              </code>{' '}
              <span className="text-dossier-muted">
                → Selects Nozomi 24 Green Car (🍀 ¥13,870)
              </span>
            </li>
            <li>
              <strong>Page 04 (Signature Pad):</strong>{' '}
              <code className="px-1.5 py-0.5 bg-white border border-stone-400 font-bold">
                &quot;Draw a signature in the dashed box&quot;
              </code>{' '}
              <span className="text-dossier-muted">
                → Signs &quot;T. Tanaka&quot; in the verification pad
              </span>
            </li>
            <li>
              <strong>Page 04 (Final Confirmation):</strong>{' '}
              <code className="px-1.5 py-0.5 bg-white border border-stone-400 font-bold">
                &quot;Click the blue confirm button at bottom right&quot;
              </code>{' '}
              <span className="text-dossier-muted">
                → Clicks 予約内容を確認・確定へ ▶ to issue the e-ticket
              </span>
            </li>
          </ol>
        </div>
      )}

      {/* Shareable Dossier Clipping Box */}
      <div className="p-3.5 bg-dossier-paper border-2 border-dossier-ink flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono-clean text-xs">
        <div>
          <div className="font-black text-sm text-dossier-ink" id="share-summary-txt">
            {shareLine1}
          </div>
          <div className="text-base tracking-widest my-1 select-all" id="share-emoji-row">
            {shareLine2}
          </div>
          <div className="mt-1.5">
            <a
              id="link-actual-site-exhibits"
              data-testid="real-site-link-exhibits"
              href="https://www.eki-net.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-bold text-blue-800 underline hover:text-blue-950"
            >
              <span>🔗 This case is inspired by the real JR East booking site, eki-net.com ↗</span>
            </a>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {handlePractice && (
            <button
              type="button"
              id="btn-reopen-case"
              onClick={handlePractice}
              className="btn-press px-3 py-2 bg-dossier-card border-2 border-dossier-ink font-bold shadow-ink-sm text-xs text-dossier-ink hover:bg-neutral-100"
            >
              ↺ Practice this case (unscored)
            </button>
          )}

          <button
            type="button"
            id="btn-copy-clipping"
            onClick={handleCopy}
            className={`btn-press px-4 py-2 font-black uppercase shadow-ink-sm text-xs transition-colors ${
              copyFeedback
                ? 'bg-emerald-700 text-white'
                : 'bg-dossier-ink text-dossier-accent hover:bg-neutral-800'
            }`}
          >
            {copyFeedback ? '✓ DISPATCH CLIPPING COPIED!' : '📋 Copy Case Clipping'}
          </button>
        </div>
      </div>
    </section>
  );
};

export default ExhibitsPanel;
