import React, { useState, useEffect } from 'react';
import type { ExhibitsPanelProps } from '../types/ui';
import type { StampStatus } from '../types/game';
import { CASE_001_PUZZLE } from '../data/puzzles/case_001/puzzle';
import { formatNextCaseStatus, SCHEDULE } from '../data/schedule';

export const ExhibitsPanel: React.FC<ExhibitsPanelProps> = ({
  caseClosed,
  scoreReport,
  officialResult,
  mode = 'official',
  caseNumber = '#001',
  answerKey,
  onCopyClipping,
  onStartPractice,
  onReopenCase,
  now,
  schedule = SCHEDULE,
}) => {
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false);
  const [liveNow, setLiveNow] = useState<Date>(() => now ?? new Date());
  const handlePractice = onStartPractice ?? onReopenCase;
  const answerKeyLines = answerKey ?? CASE_001_PUZZLE.answerKey;

  useEffect(() => {
    if (now || !caseClosed) return;
    const id = setInterval(() => {
      setLiveNow(new Date());
    }, 1000);
    return () => clearInterval(id);
  }, [now, caseClosed]);

  const effectiveNow = now ?? liveNow;
  const nextCaseText = formatNextCaseStatus(effectiveNow, schedule);

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
    bestBlunder,
  } = scoreReport;

  const effectiveClipping = (officialResult?.shareableClipping ?? shareableClipping) || '';
  const [shareLine1 = '', shareLine2 = '', shareLine3 = ''] = effectiveClipping.split('\n');
  const hasThirdPreviewLine = Boolean(shareLine3 && !shareLine3.startsWith('http'));

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
          const cardId = ex.id.startsWith('exhibit_') ? `card-${ex.id}` : `card-exhibit_${letterCode.toLowerCase()}`;
          return (
            <div
              key={ex.id}
              id={cardId}
              data-exhibit-id={ex.id}
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
                {ex.status === 'CONTAMINATED' && ex.contaminatedNote && (
                  <div className="text-[11px] text-red-900 font-semibold mt-1">
                    {ex.contaminatedNote}
                  </div>
                )}
                {ex.status !== 'VERIFIED' && ex.compareText && (
                  <div
                    data-testid={`exhibit-${letterCode.toLowerCase()}-compare`}
                    className="text-[11px] text-stone-700 mt-1"
                  >
                    {ex.compareText}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Best blunder quote when any line outcome was 🤡, 🔙 or 💥 */}
      {bestBlunder && (
        <div
          id="best-blunder-banner"
          data-testid="best-blunder-banner"
          className="mb-4 p-3 bg-stone-100 border-2 border-dossier-ink text-xs font-mono-clean text-dossier-ink"
        >
          {bestBlunder}
        </div>
      )}

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
            {answerKeyLines.map((line, idx) => (
              <li key={idx}>
                <code className="px-1.5 py-0.5 bg-white border border-stone-400 font-bold">
                  &quot;{line}&quot;
                </code>
              </li>
            ))}
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
            <div id="share-outcome-row">{shareLine2}</div>
            {hasThirdPreviewLine && <div id="share-exhibit-row">{shareLine3}</div>}
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
          <div
            data-testid="next-case-countdown"
            className="mt-1 text-xs font-bold text-dossier-muted"
          >
            {nextCaseText}
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
