import React from 'react';

export interface CoordinateRulersProps {
  /** Column identifiers (defaults to ['A', 'B', 'C', 'D']) */
  columns?: string[];
  /** Row identifiers (defaults to ['1', '2', '3', '4']) */
  rows?: string[];
  /** Wrapped sandbox stage component */
  children?: React.ReactNode;
  /** Optional class name */
  className?: string;
}

export const CoordinateRulers: React.FC<CoordinateRulersProps> = ({
  columns = ['A', 'B', 'C', 'D'],
  rows = ['1', '2', '3', '4'],
  children,
  className = '',
}) => {
  const columnLabels: Record<string, string> = {
    A: 'COL A (LEFT: 0–256)',
    B: 'COL B (CENTER-LEFT: 256–512)',
    C: 'COL C (CENTER-RIGHT: 512–768)',
    D: 'COL D (RIGHT: 768–1024)',
  };

  return (
    <div
      id="sandbox-container"
      className={`bg-dossier-card border-2 border-dossier-ink shadow-ink p-3 ${className}`}
      aria-label="Microfiche Virtual Stage Framing Rulers"
    >
      {/* Top Horizontal Column Ruler (COL A–D) */}
      <div className="grid grid-cols-4 text-center font-mono-clean text-xs font-bold text-dossier-muted border-b-2 border-dossier-ink pb-1.5 mb-2 select-none">
        {columns.map((col) => (
          <span key={col} className="truncate">
            │ {columnLabels[col] || `COL ${col}`}
          </span>
        ))}
      </div>

      <div className="flex gap-2 items-stretch">
        {/* Left Vertical Row Ruler (ROW 1–4) */}
        <div className="hidden sm:flex flex-col justify-around font-mono-clean text-xs font-bold text-dossier-muted pr-2 border-r-2 border-dossier-ink py-4 select-none shrink-0 w-16 text-center">
          {rows.map((row) => (
            <div key={row} className="flex-1 flex items-center justify-center">
              <span>ROW {row}</span>
            </div>
          ))}
        </div>

        {/* Virtual Sandbox Stage Canvas Wrapper */}
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
};

export default CoordinateRulers;
