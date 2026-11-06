import React, { useMemo } from 'react';
import type { TargetGhostReplayDefinition, BoundingBox } from '../types/puzzle';
import { CASE_042_GHOST_REPLAY } from '../data/puzzles/case_042';

export interface GhostReplayProps {
  /** True when the 1:1 Target Ghost Replay overlay is active. */
  active: boolean;
  /** Callback to close or toggle the overlay. */
  onToggle: () => void;
  /** Custom trajectory definition (defaults to Case File #042 definition). */
  trajectory?: TargetGhostReplayDefinition;
  /** Optional custom redaction bounding boxes to mask dynamically. */
  redactionZones?: BoundingBox[];
  /** Optional className overrides. */
  className?: string;
}

export const GhostReplay: React.FC<GhostReplayProps> = ({
  active,
  onToggle,
  trajectory = CASE_042_GHOST_REPLAY,
  redactionZones,
  className = '',
}) => {
  if (!active) return null;

  const waypoints = trajectory?.waypoints ?? CASE_042_GHOST_REPLAY.waypoints;
  const svgPath = trajectory?.trajectorySvgPath ?? CASE_042_GHOST_REPLAY.trajectorySvgPath;
  const overlayNote =
    trajectory?.overlayNote ??
    'Note: The 5 Required Exhibits remain REDACTED until you close the case file or finish all 6 telegrams. Watch the target clicks carefully!';

  // Default hard-coded redaction zones for Case File #042 Macro-View 3 (prevent text leakage)
  const defaultRedactionBars: BoundingBox[] = useMemo(
    () => [
      // Top header portal title
      { x: 220, y: 44, width: 380, height: 20 },
      // Decoy promo banner Japanese text
      { x: 180, y: 96, width: 350, height: 22 },
      // Search filter criteria text (Col A)
      { x: 34, y: 236, width: 180, height: 38 },
      // Fare table column headers
      { x: 260, y: 228, width: 500, height: 22 },
      // Train 1 name & timestamps (Hikari 515)
      { x: 260, y: 260, width: 100, height: 30 },
      // Train 1 fare buttons text
      { x: 370, y: 260, width: 110, height: 32 },
      { x: 580, y: 260, width: 110, height: 32 },
      // Train 2 name & timestamps (Nozomi 24)
      { x: 260, y: 450, width: 100, height: 30 },
      // Train 2 fare buttons text (including Target #25 Green Car text!)
      { x: 370, y: 450, width: 110, height: 32 },
      { x: 580, y: 450, width: 110, height: 32 },
      { x: 790, y: 450, width: 190, height: 36 },
      // Bottom action bar labels (Insurance text, Cancel text, Confirm text)
      { x: 290, y: 708, width: 230, height: 20 },
      { x: 640, y: 704, width: 130, height: 32 },
      { x: 810, y: 704, width: 190, height: 32 },
    ],
    []
  );

  const activeRedactions = redactionZones ?? defaultRedactionBars;

  return (
    <div
      id="ghost-trace-overlay"
      data-testid="ghost-replay-overlay"
      className={`absolute inset-0 z-20 flex flex-col justify-between bg-[#111111]/85 backdrop-blur-[1.5px] p-4 text-[#F4EFE6] select-none ${className}`}
      onClick={(e) => {
        // Prevent accidental dismiss unless clicking background directly
        if (e.target === e.currentTarget) {
          onToggle();
        }
      }}
    >
      {/* 1. TOP HEADER TELEMETRY BAR */}
      <div className="flex flex-wrap items-center justify-between border-b-2 border-dossier-accent pb-2 z-30">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-dossier-accent text-dossier-ink font-mono-clean font-black text-xs uppercase shadow-ink-sm">
            🎞️ TARGET GHOST REPLAY (VISUAL PLAYBACK)
          </span>
          <span className="text-xs font-mono-clean text-stone-300 hidden sm:inline">
            1:1 IN-ENGINE VECTOR TRAJECTORY
          </span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="btn-press px-3 py-1 bg-dossier-accent text-dossier-ink border border-black font-mono-clean text-xs font-black uppercase shadow-ink-sm hover:bg-amber-300"
        >
          ✕ RETURN TO DOSSIER
        </button>
      </div>

      {/* 2. 1:1 SVG VECTOR CANVAS (Co-registered over 1024x768 stage) */}
      <svg
        viewBox="0 0 1024 768"
        className="absolute inset-0 w-full h-full pointer-events-none z-20"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Arrowhead Marker */}
          <marker
            id="ghost-arrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#FACC15" stroke="#111111" strokeWidth="1" />
          </marker>

          {/* Cyan Glow Filter */}
          <filter id="cyan-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#06B6D4" floodOpacity="0.8" />
          </filter>
        </defs>

        {/* --- SECURITY REDACTION MASK: OPAQUE BLACK MARKER BARS --- */}
        <g id="redaction-marker-mask" opacity="0.95">
          {activeRedactions.map((box, idx) => (
            <g key={`redaction-${idx}`}>
              {/* Solid carbon black redaction rectangle */}
              <rect
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                fill="#050505"
                stroke="#111111"
                strokeWidth="1"
                rx="2"
              />
              {/* Internal forensic classified hatch pattern lines */}
              <line
                x1={box.x + 4}
                y1={box.y + box.height / 2}
                x2={box.x + box.width - 4}
                y2={box.y + box.height / 2}
                stroke="#262626"
                strokeWidth="2"
                strokeDasharray="4 2"
              />
            </g>
          ))}
        </g>

        {/* --- TRAJECTORY INK LINE --- */}
        {svgPath && (
          <g id="ghost-trajectory-paths">
            {/* Cyan Glow Under-path */}
            <path
              d={svgPath}
              fill="none"
              stroke="#06B6D4"
              strokeWidth="6"
              strokeOpacity="0.4"
              filter="url(#cyan-glow)"
            />
            {/* Primary Dashed Amber Ink Vector Line with SVG Animation */}
            <path
              d={svgPath}
              fill="none"
              stroke="#FACC15"
              strokeWidth="3.5"
              strokeDasharray="8 6"
              strokeLinecap="round"
              markerEnd="url(#ghost-arrow)"
            >
              <animate
                attributeName="stroke-dashoffset"
                values="100;0"
                dur="3s"
                repeatCount="indefinite"
              />
            </path>
          </g>
        )}

        {/* --- NUMBERED WAYPOINTS & PULSE RINGS --- */}
        {waypoints.map((wp, idx) => {
          const radius = wp.radius ?? 20;
          const isFinal = idx === waypoints.length - 1;

          // Label placement: offset based on quadrant
          const labelX = wp.x > 512 ? wp.x - 220 : wp.x + 24;
          const labelY = wp.y < 384 ? wp.y - 12 : wp.y + 8;

          return (
            <g key={`waypoint-${wp.stepNumber ?? idx + 1}`} id={`waypoint-group-${idx + 1}`}>
              {/* Outer Pulsing Expanding Ring */}
              <circle
                cx={wp.x}
                cy={wp.y}
                r={radius * 1.6}
                fill="none"
                stroke="#FACC15"
                strokeWidth="1.5"
                opacity="0.6"
              >
                <animate
                  attributeName="r"
                  values={`${radius};${radius * 2.2}`}
                  dur="1.8s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.8;0"
                  dur="1.8s"
                  repeatCount="indefinite"
                />
              </circle>

              {/* Secondary Target Focus Ring */}
              <circle
                cx={wp.x}
                cy={wp.y}
                r={radius}
                fill="rgba(250, 204, 21, 0.22)"
                stroke="#FACC15"
                strokeWidth="3"
                strokeDasharray="4 2"
              />

              {/* Waypoint Number Pill Center */}
              <circle
                cx={wp.x}
                cy={wp.y}
                r="11"
                fill={isFinal ? '#2563EB' : '#FACC15'}
                stroke="#111111"
                strokeWidth="2"
              />
              <text
                x={wp.x}
                y={wp.y + 4}
                textAnchor="middle"
                fill={isFinal ? '#FFFFFF' : '#111111'}
                fontSize="11"
                fontWeight="900"
                fontFamily="monospace"
              >
                {wp.stepNumber ?? idx + 1}
              </text>

              {/* Tactical Waypoint Label Card */}
              <g transform={`translate(${labelX}, ${labelY})`}>
                <rect
                  x="0"
                  y="0"
                  width="210"
                  height="22"
                  fill="#111111"
                  stroke="#FACC15"
                  strokeWidth="1.5"
                  rx="2"
                />
                <text
                  x="8"
                  y="15"
                  fill="#FACC15"
                  fontSize="10"
                  fontWeight="bold"
                  fontFamily="monospace"
                  letterSpacing="0.5"
                >
                  {wp.label ?? `TARGET CLICK @ ${wp.timestamp} (${wp.gridRef})`}
                </text>
              </g>
            </g>
          );
        })}
      </svg>

      {/* 3. BOTTOM FORENSIC NOTICE */}
      <div className="z-30 mt-auto bg-dossier-ink border-2 border-dossier-accent p-2.5 shadow-ink flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="text-xs font-mono-clean text-dossier-paper leading-relaxed">
          <span className="font-bold text-dossier-accent">🔒 FORENSIC ANTI-LEAK PROTOCOL:</span>{' '}
          {overlayNote}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="btn-press px-4 py-1.5 bg-dossier-accent text-dossier-ink font-mono-clean text-xs font-black uppercase shrink-0 border border-black shadow-ink-sm"
        >
          RETURN TO DISPATCH PAD ⏎
        </button>
      </div>
    </div>
  );
};

export default GhostReplay;
