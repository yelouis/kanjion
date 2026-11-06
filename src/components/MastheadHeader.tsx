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
    <header className="border-b-4 border-double border-dossier-ink pb-3 mb-4 flex flex-wrap items-end justify-between gap-4">
      {/* Left Masthead Branding & Forensic Kicker */}
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

        <h1 className="font-gazette font-black text-2xl md:text-3xl tracking-tight text-dossier-ink mt-0.5 flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center justify-center px-1.5 py-0.5 border-2 border-red-800 text-red-800 font-mono-clean font-black text-xs tracking-normal leading-none select-none shadow-[1px_1px_0px_#991b1b]">
            漢字音
          </span>
          <span>{caseTitle}</span>
          <span className="text-xs font-mono-clean font-bold bg-dossier-ink text-dossier-paper px-2.5 py-1 align-middle inline-block shadow-ink-sm">
            {difficultyBadge}
          </span>
        </h1>
      </div>

      {/* Right Control Cluster: Ghost Replay + Backend Mode/SoM + Exhibits Status */}
      <div className="flex flex-wrap items-center gap-2.5 font-mono-clean text-xs">
        {/* Target Ghost Replay Toggle */}
        <button
          id="btn-ghost"
          type="button"
          onClick={onToggleGhostReplay}
          aria-pressed={ghostReplayActive}
          className={`btn-press px-3 py-1.5 border-2 border-dossier-ink shadow-ink font-black uppercase transition-colors ${
            ghostReplayActive
              ? 'bg-dossier-accent text-dossier-ink'
              : 'bg-dossier-card text-dossier-ink hover:bg-neutral-100'
          }`}
          title="Toggle 1:1 Target Ghost Replay trajectory overlay"
        >
          🎞️ Target Ghost Replay: {ghostReplayActive ? 'ON' : 'OFF'}
        </button>

        {/* Backend SoM IDs Toggle */}
        <button
          id="btn-som"
          type="button"
          onClick={onToggleSomOverlay}
          aria-pressed={somOverlayActive}
          className={`btn-press px-3 py-1.5 border-2 border-dossier-ink shadow-ink font-bold transition-colors ${
            somOverlayActive
              ? 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-900'
              : 'bg-dossier-card text-dossier-ink hover:bg-neutral-100'
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
            className="btn-press px-2.5 py-1.5 bg-dossier-card border-2 border-dossier-ink shadow-ink font-bold text-neutral-800"
            title="Toggle Agent Execution Engine (Offline Heuristic vs Cloud Multimodal LLM)"
          >
            ⚙️ Mode: {backendMode === 'cloud' ? 'Cloud Vision' : 'Offline'}
          </button>
        )}

        {/* Sealed Exhibits Status Pill */}
        <div className="px-3 py-1.5 bg-dossier-ink text-dossier-paper border-2 border-dossier-ink font-bold flex items-center gap-2 shadow-ink-sm">
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
      </div>
    </header>
  );
};

export default MastheadHeader;
