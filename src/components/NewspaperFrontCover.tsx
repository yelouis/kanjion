import React, { useState } from 'react';
import type { DifficultyLevel, PlayPresetMode } from '../App';

export interface NewspaperFrontCoverProps {
  caseNumber: string;
  difficulty: DifficultyLevel;
  playMode: PlayPresetMode;
  onSelectDifficulty: (diff: DifficultyLevel) => void;
  onSelectPlayMode: (mode: PlayPresetMode) => void;
  onOpenNewspaper: () => void;
}

export const NewspaperFrontCover: React.FC<NewspaperFrontCoverProps> = ({
  caseNumber,
  difficulty,
  playMode,
  onSelectDifficulty,
  onSelectPlayMode,
  onOpenNewspaper,
}) => {
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);

  const difficultyLabel =
    difficulty === 'easy'
      ? '🟢 EASY (ENGLISH HINTS)'
      : difficulty === 'medium'
      ? '🟡 MEDIUM (GRID CLUES)'
      : '🔴 HARD (🇯🇵 RAW JAPANESE)';

  return (
    <div
      data-testid="newspaper-front-cover"
      className="min-h-[82vh] flex flex-col items-center justify-between py-8 px-4 select-none"
    >
      {/* Top Dateline Strip */}
      <div className="w-full max-w-2xl border-y-2 border-dossier-ink py-1.5 px-3 flex flex-wrap items-center justify-between text-[11px] font-mono-clean uppercase tracking-widest text-dossier-muted">
        <span>VOL. XLII • TOKYO–OSAKA DISPATCH</span>
        <span className="font-bold text-dossier-ink">THE REDACTED DOSSIER</span>
        <span>PRICE: 6 TELEGRAMS MAX</span>
      </div>

      {/* Center Hero Title & One-Sentence Hook (Krillion Style) */}
      <div className="my-auto py-8 flex flex-col items-center text-center max-w-2xl w-full space-y-5">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-dossier-ink text-dossier-paper font-mono-clean text-xs font-bold tracking-widest uppercase shadow-ink-sm">
          <span className="text-red-400">漢字音</span>
          <span>DAILY AI NAVIGATION PUZZLE • CASE {caseNumber}</span>
        </div>

        {/* Iconic Title */}
        <h1 className="font-gazette font-black text-6xl sm:text-7xl md:text-8xl tracking-tight text-dossier-ink leading-none flex items-center justify-center gap-3">
          <span className="inline-flex items-center justify-center px-2.5 py-1 border-4 border-red-800 text-red-800 font-mono-clean font-black text-xl sm:text-2xl tracking-normal leading-none shadow-[2px_2px_0px_#991b1b]">
            漢字音
          </span>
          <span>KANJION</span>
        </h1>

        <p className="font-mono-clean font-black text-sm sm:text-base uppercase tracking-[0.25em] text-red-800">
          THE DAILY DOSSIER
        </p>

        {/* Krillion-Style One-Sentence Rule Hook */}
        <p
          id="krillion-style-hook"
          className="font-mono-clean text-xs sm:text-sm text-dossier-ink max-w-xl leading-relaxed font-bold"
        >
          6 prompts • 60 characters each • watch the target replay on the right page &amp; guide
          your AI agent on the left page to copy it
        </p>

        {/* Visual Front-Page Newspaper Teaser Card (Clickable to Open) */}
        <div
          onClick={onOpenNewspaper}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenNewspaper();
            }
          }}
          className="w-full max-w-lg bg-dossier-card border-2 border-dossier-ink shadow-ink p-5 cursor-pointer hover:bg-amber-50/60 transition-all group text-left"
        >
          <div className="flex items-center justify-between border-b-2 border-dossier-ink pb-2 mb-3">
            <span className="font-gazette font-black text-base sm:text-lg text-dossier-ink">
              📰 TODAY&apos;S FRONT PAGE: SHINKANSEN SEAT MATRIX
            </span>
            <span className="px-2 py-0.5 bg-dossier-accent text-dossier-ink font-mono-clean font-black text-[11px] uppercase border border-dossier-ink group-hover:translate-x-0.5 transition-transform">
              CLICK TO UNFOLD ▸
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 font-mono-clean text-xs">
            <div className="border border-stone-400 bg-stone-100 p-2.5">
              <div className="font-black text-dossier-ink mb-1">👈 LEFT PAGE (YOUR AGENT)</div>
              <p className="text-[11px] text-dossier-muted leading-snug">
                Live Japanese webpage. Manual clicks are locked — type English instructions to move
                your agent.
              </p>
            </div>
            <div className="border border-stone-400 bg-stone-100 p-2.5">
              <div className="font-black text-dossier-ink mb-1">👉 RIGHT PAGE (TARGET LOOP)</div>
              <p className="text-[11px] text-dossier-muted leading-snug">
                Continuous looped recording of the exact clicks you need to replicate.
              </p>
            </div>
          </div>
        </div>

        {/* Collapsible "▸ HOW TO PLAY" Toggle (Krillion Style) */}
        <div className="w-full max-w-lg text-left font-mono-clean text-xs">
          <button
            type="button"
            onClick={() => setShowHowToPlay(!showHowToPlay)}
            className="text-dossier-muted hover:text-dossier-ink font-bold tracking-wider uppercase flex items-center gap-1.5 mx-auto"
          >
            <span>{showHowToPlay ? '▾' : '▸'}</span>
            <span>HOW TO PLAY</span>
          </button>

          {showHowToPlay && (
            <div className="mt-2 bg-dossier-card border-2 border-dossier-ink p-3 shadow-ink-sm space-y-1.5 text-dossier-ink">
              <div>
                <strong>1. Unfold the Newspaper:</strong> On the right page, watch the looped video
                showing the target clicks.
              </div>
              <div>
                <strong>2. Prompt Only (No Manual Clicking):</strong> Type short English instructions
                (up to 60 chars) in the 6-line pad on the left page to make your AI agent repeat
                those clicks.
              </div>
              <div>
                <strong>3. Close Case File:</strong> Finish in fewer lines for up to a{' '}
                <strong>2.0x efficiency multiplier</strong> and unseal the 5 Exhibits!
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Stack (Krillion-Style Primary Start CTA + Footer Pills) */}
      <div className="w-full max-w-lg flex flex-col items-center gap-3 font-mono-clean">
        {/* Giant Unmissable Primary Start Button */}
        <button
          id="btn-open-newspaper"
          type="button"
          onClick={onOpenNewspaper}
          className="btn-press w-full py-4 px-6 bg-dossier-ink text-dossier-accent border-2 border-dossier-ink shadow-ink-lg font-mono-clean font-black text-base sm:text-lg tracking-[0.2em] uppercase hover:bg-neutral-800 transition-all flex items-center justify-center gap-3"
        >
          <span>▼</span>
          <span>OPEN TODAY&apos;S NEWSPAPER</span>
          <span>▼</span>
        </button>

        {/* Bottom Status & Quick Mode/Difficulty Footer Strip */}
        <div className="w-full flex flex-wrap items-center justify-between gap-2 text-[11px] text-dossier-muted pt-1">
          <span>
            CASE {caseNumber} • {playMode === 'daily' ? 'DAILY PUZZLE' : 'FULL 6-LINE RUN'} •{' '}
            {difficultyLabel}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onSelectPlayMode(playMode === 'daily' ? 'fresh' : 'daily')}
              className="px-2 py-0.5 border border-stone-400 hover:border-dossier-ink text-dossier-ink font-bold uppercase"
            >
              {playMode === 'daily' ? 'DAILY ▾' : '6-LINE RUN ▾'}
            </button>
            <button
              type="button"
              onClick={() =>
                onSelectDifficulty(
                  difficulty === 'hard' ? 'easy' : difficulty === 'easy' ? 'medium' : 'hard'
                )
              }
              className="px-2 py-0.5 border border-stone-400 hover:border-dossier-ink text-dossier-ink font-bold uppercase"
            >
              DIFFICULTY: {difficulty.toUpperCase()} ▾
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewspaperFrontCover;
