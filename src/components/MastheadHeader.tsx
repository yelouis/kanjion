import React from 'react';
import type { MastheadProps } from '../types/ui';

export interface ExtendedMastheadProps extends MastheadProps {
  /** Optional date slug for archival masthead (e.g. 'NOVEMBER 06, 2026') */
  dateSlug?: string;
  /** Optional backend execution mode toggle ('offline' | 'cloud') */
  backendMode?: 'offline' | 'cloud';
  /** Optional callback to toggle execution connector */
  onToggleBackendMode?: () => void;
}

export const MastheadHeader: React.FC<ExtendedMastheadProps> = ({
  caseNumber = '#042',
  caseTitle = 'KANJION',
  difficultyBadge = '🇯🇵 HARD MODE: TOKYO–OSAKA SHINKANSEN',
  ghostReplayActive,
  onToggleGhostReplay,
  somOverlayActive,
  onToggleSomOverlay,
  caseStatus,
  exhibitCount = 5,
  dateSlug,
  backendMode,
  onToggleBackendMode,
}) => {
  const isClosed = caseStatus === 'closed';

  return (
    <header className="border-b-4 border-double border-dossier-ink pb-4 mb-4 space-y-3">
      {/* Top Row: Masthead Branding & Primary Step 1 Replay Call-to-Action */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-mono-clean text-xs uppercase tracking-widest text-dossier-muted font-bold flex flex-wrap items-center gap-2">
            <span>THE REDACTED DOSSIER</span>
            <span>•</span>
            <span>DAILY FORENSIC BRIEFING</span>
            <span>•</span>
            <span>CASE FILE {caseNumber}</span>
            {dateSlug && (
              <>
                <span>•</span>
                <span>{dateSlug}</span>
              </>
            )}
            <span>•</span>
            <span className="text-red-700 font-black">COPY-PASTE DISABLED</span>
          </div>

          <h1 className="font-gazette font-black text-2xl md:text-3xl tracking-tight text-dossier-ink mt-1 flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 border-2 border-red-800 text-red-800 font-mono-clean font-black text-xs tracking-normal leading-none select-none shadow-[1px_1px_0px_#991b1b]">
              漢字音
            </span>
            <span>{caseTitle}</span>
            <span className="text-xs font-mono-clean font-bold bg-dossier-ink text-dossier-paper px-2.5 py-1 align-middle inline-block shadow-ink-sm">
              {difficultyBadge}
            </span>
          </h1>
        </div>

        {/* OBVIOUS START CTA: Step 1 Watch Target Ghost Replay */}
        <div className="flex flex-col items-start sm:items-end gap-1">
          <span className="font-mono-clean text-[11px] font-black uppercase tracking-wider text-red-800 bg-amber-100 border border-red-800 px-2 py-0.5">
            {ghostReplayActive
              ? '🎬 WATCHING TARGET REPLAY — CLICK AGAIN TO CLOSE'
              : '👇 STEP 1: START HERE — WATCH WHAT TO SIMULATE'}
          </span>
          <button
            id="btn-ghost"
            type="button"
            onClick={onToggleGhostReplay}
            aria-pressed={ghostReplayActive}
            className={`btn-press px-4 py-2 border-2 border-dossier-ink shadow-ink font-mono-clean text-sm font-black uppercase transition-colors flex items-center gap-2 ${
              ghostReplayActive
                ? 'bg-emerald-700 text-white ring-2 ring-dossier-ink'
                : 'bg-dossier-accent text-dossier-ink hover:bg-amber-300 ring-2 ring-red-700/40'
            }`}
            title="Watch the 1:1 Target Ghost Replay trajectory that your AI agent needs to replicate"
          >
            <span>{ghostReplayActive ? '⏹' : '▶'}</span>
            <span>🎞️ Target Ghost Replay: {ghostReplayActive ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* One-Sentence Krillion-Style How-To-Play Banner + Secondary Status Bar */}
      <div className="bg-dossier-card border-2 border-dossier-ink p-2.5 shadow-ink-sm flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        <p
          id="how-to-play-banner"
          className="font-mono-clean text-xs md:text-sm text-dossier-ink leading-snug"
        >
          <span className="inline-block bg-dossier-ink text-dossier-accent font-black px-1.5 py-0.5 mr-2 uppercase text-xs">
            HOW TO PLAY
          </span>
          <strong>
            Watch the Target Ghost Replay, then guide the AI agent to repeat those exact clicks in 6
            short English commands or fewer.
          </strong>
        </p>

        {/* Secondary Technical & Status Controls */}
        <div className="flex flex-wrap items-center gap-2 font-mono-clean text-xs shrink-0">
          {/* Sealed Exhibits Status Pill */}
          <div className="px-2.5 py-1 bg-dossier-ink text-dossier-paper border-2 border-dossier-ink font-bold flex items-center gap-1.5">
            <span>{exhibitCount} EXHIBITS:</span>
            <span
              id="sealed-status-pill"
              className={`px-1.5 py-0.5 font-black uppercase text-xs transition-colors ${
                isClosed
                  ? 'bg-emerald-800 text-white'
                  : 'bg-red-800 text-amber-200 animate-pulse'
              }`}
            >
              {isClosed ? '🔓 UNSEALED (CASE CLOSED)' : '██ SEALED UNTIL CASE CLOSED ██'}
            </span>
          </div>

          {/* Backend SoM IDs Toggle */}
          <button
            id="btn-som"
            type="button"
            onClick={onToggleSomOverlay}
            aria-pressed={somOverlayActive}
            className={`btn-press px-2.5 py-1 border-2 border-dossier-ink font-bold transition-colors ${
              somOverlayActive
                ? 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-900'
                : 'bg-stone-100 text-dossier-ink hover:bg-neutral-200'
            }`}
            title="Toggle Backend Set-of-Mark element numbered tags"
          >
            📌 Backend SoM IDs: {somOverlayActive ? 'ON' : 'OFF'}
          </button>

          {/* Optional Offline / Cloud Vision Engine Mode Toggle */}
          {backendMode && onToggleBackendMode && (
            <button
              id="btn-mode-toggle"
              type="button"
              onClick={onToggleBackendMode}
              className="btn-press px-2.5 py-1 bg-stone-100 border-2 border-dossier-ink font-bold text-neutral-800 hover:bg-neutral-200"
              title="Toggle Agent Execution Engine (Offline Heuristic vs Cloud Multimodal LLM)"
            >
              ⚙️ Mode: {backendMode === 'cloud' ? 'Cloud Vision' : 'Offline'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default MastheadHeader;
