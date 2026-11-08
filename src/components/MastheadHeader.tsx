import React from 'react';
import type { MastheadProps } from '../types/ui';

export interface ExtendedMastheadProps extends MastheadProps {
  /** Optional date slug for archival masthead (e.g. 'NOVEMBER 06, 2026') */
  dateSlug?: string;
  /** When true, hides difficulty badge from minimal header */
  minimalCleanHeader?: boolean;
}

export const MastheadHeader: React.FC<ExtendedMastheadProps> = ({
  caseNumber = '#001',
  caseTitle = 'KANJION',
  difficultyBadge,
  caseStatus,
  exhibitCount = 5,
  dateSlug,
  minimalCleanHeader = false,
}) => {
  const isClosed = caseStatus === 'closed';

  return (
    <header className="border-b-4 border-double border-dossier-ink pb-3 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left: Clean Brand Title & One-Sentence Instruction */}
        <div>
          <div className="font-mono-clean text-xs uppercase tracking-widest text-dossier-muted font-bold flex flex-wrap items-center gap-2">
            <span>DAILY PUZZLE • CASE FILE {caseNumber}</span>
            {dateSlug && (
              <>
                <span>•</span>
                <span>{dateSlug}</span>
              </>
            )}
          </div>

          <h1 className="font-gazette font-black text-3xl md:text-4xl tracking-tight text-dossier-ink mt-0.5 flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 border-2 border-red-800 text-red-800 font-mono-clean font-black text-xs tracking-normal leading-none select-none shadow-[1px_1px_0px_#991b1b]">
              漢字音
            </span>
            <span>{caseTitle}</span>
            {!minimalCleanHeader && difficultyBadge && (
              <span className="text-xs font-mono-clean font-bold bg-dossier-ink text-dossier-paper px-2.5 py-1 align-middle inline-block shadow-ink-sm">
                {difficultyBadge}
              </span>
            )}
          </h1>

          <p className="font-mono-clean text-xs sm:text-sm text-dossier-ink mt-1 font-bold">
            Watch the target replay on the right, then type up to 6 English instructions below the
            left page to make your AI agent copy it.
          </p>
        </div>

        {/* Right: Sealed Exhibits Pill */}
        <div className="flex flex-wrap items-center gap-2 font-mono-clean text-xs shrink-0">
          <div className="px-3 py-1.5 bg-dossier-ink text-dossier-paper border-2 border-dossier-ink font-bold flex items-center gap-2 shadow-ink-sm">
            <span>{exhibitCount} EXHIBITS:</span>
            <span
              id="sealed-status-pill"
              className={`px-1.5 py-0.5 font-black uppercase text-xs transition-colors ${
                isClosed
                  ? 'bg-emerald-800 text-white'
                  : 'bg-red-800 text-amber-200'
              }`}
            >
              {isClosed ? '🔓 UNSEALED (CASE CLOSED)' : '██ SEALED UNTIL CASE CLOSED ██'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default MastheadHeader;
