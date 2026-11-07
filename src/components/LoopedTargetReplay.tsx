import React, { useState, useEffect, useRef } from 'react';
import { STAGE_WIDTH, STAGE_HEIGHT } from '../utils/coordinate_projector';

export interface LoopedTargetReplayProps {
  /** Optional override for play/pause state */
  autoPlay?: boolean;
  /** Optional className */
  className?: string;
}

interface ReplayPhase {
  stepIndex: number;
  label: string;
  sublabel: string;
  cursorX: number; // 0..1024
  cursorY: number; // 0..768
  isClicking: boolean;
  greenSelected: boolean;
  blueConfirmed: boolean;
  gridRef: string;
}

const REPLAY_PHASES: ReplayPhase[] = [
  {
    stepIndex: 0,
    label: 'START OF TARGET RECORDING',
    sublabel: 'Cursor enters seat matrix after Route & 14:30 selection',
    cursorX: 512,
    cursorY: 360,
    isClicking: false,
    greenSelected: false,
    blueConfirmed: false,
    gridRef: 'B2',
  },
  {
    stepIndex: 1,
    label: 'TARGET CLICK 1: GREEN SEAT BUTTON (2ND ROW)',
    sublabel: 'Clicks green 🍀 button in Row 2 of table (COL D, ROW 3)',
    cursorX: 885,
    cursorY: 468,
    isClicking: true,
    greenSelected: true,
    blueConfirmed: false,
    gridRef: 'D3',
  },
  {
    stepIndex: 2,
    label: 'TARGET CLICK 2: BLUE CONFIRM BUTTON',
    sublabel: 'Clicks blue confirm button at bottom-right (COL D, ROW 4)',
    cursorX: 905,
    cursorY: 720,
    isClicking: true,
    greenSelected: true,
    blueConfirmed: true,
    gridRef: 'D4',
  },
  {
    stepIndex: 3,
    label: 'SEQUENCE COMPLETE — REWINDING LOOP...',
    sublabel: 'Both target clicks completed without touching red ad trap',
    cursorX: 905,
    cursorY: 720,
    isClicking: false,
    greenSelected: true,
    blueConfirmed: true,
    gridRef: 'D4',
  },
];

export const LoopedTargetReplay: React.FC<LoopedTargetReplayProps> = ({
  autoPlay = true,
  className = '',
}) => {
  const [phaseIdx, setPhaseIdx] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(autoPlay);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(1);

  // Measure container width to scale 1024x768 replay stage proportionally
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      if (w > 0) {
        setScale(Math.min(w / STAGE_WIDTH, 1));
      }
    };
    updateScale();
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      observer = new ResizeObserver(updateScale);
      observer.observe(containerRef.current);
    }
    window.addEventListener('resize', updateScale);
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, []);

  // Continuous loop timer
  useEffect(() => {
    if (!isPlaying || process.env.NODE_ENV === 'test') return;
    const interval = setInterval(() => {
      setPhaseIdx((prev) => (prev + 1) % REPLAY_PHASES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const currentPhase = REPLAY_PHASES[phaseIdx] || REPLAY_PHASES[1];
  const scaledHeight = Math.round(STAGE_HEIGHT * scale);

  return (
    <div
      data-testid="looped-target-replay"
      className={`flex flex-col bg-dossier-card border-2 border-dossier-ink shadow-ink ${className}`}
    >
      {/* Top Video Player Header Bar */}
      <div className="bg-dossier-ink text-dossier-paper px-3 py-2 flex flex-wrap items-center justify-between gap-2 border-b-2 border-dossier-ink font-mono-clean text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-700 text-white font-black uppercase tracking-wider text-[11px]">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            REC • LOOPING TARGET VIDEO
          </span>
          <span className="font-bold text-amber-300">{currentPhase.label}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-dossier-paper border border-stone-600 font-bold text-[11px]"
          >
            {isPlaying ? '⏸ Pause Loop' : '▶ Resume Loop'}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setPhaseIdx(1);
            }}
            className={`px-2 py-0.5 border font-bold text-[11px] ${
              phaseIdx === 1
                ? 'bg-dossier-accent text-dossier-ink border-white font-black'
                : 'bg-neutral-800 text-stone-300 border-stone-600'
            }`}
          >
            Step 1 (D3)
          </button>
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setPhaseIdx(2);
            }}
            className={`px-2 py-0.5 border font-bold text-[11px] ${
              phaseIdx === 2
                ? 'bg-dossier-accent text-dossier-ink border-white font-black'
                : 'bg-neutral-800 text-stone-300 border-stone-600'
            }`}
          >
            Step 2 (D4)
          </button>
        </div>
      </div>

      {/* Compact Replay Grid Header Ruler (A-D) */}
      <div className="grid grid-cols-4 text-center font-mono-clean text-[11px] font-bold bg-stone-200 border-b border-dossier-ink py-1 select-none">
        <div>| REPLAY COL A |</div>
        <div>| REPLAY COL B |</div>
        <div>| REPLAY COL C |</div>
        <div>| REPLAY COL D |</div>
      </div>

      {/* Twin Replay Viewport */}
      <div className="flex">
        <div className="hidden sm:flex flex-col justify-around w-10 shrink-0 font-mono-clean text-[11px] font-bold bg-stone-200 border-r border-dossier-ink text-center select-none">
          <div>R1</div>
          <div>R2</div>
          <div>R3</div>
          <div>R4</div>
        </div>
        <div
          ref={containerRef}
          className="relative w-full overflow-hidden bg-stone-950 select-none"
          style={{ height: `${scaledHeight}px` }}
        >
          <div
            className="relative origin-top-left bg-[#F8FAFC] text-neutral-900 pointer-events-none"
            style={{
              width: `${STAGE_WIDTH}px`,
              height: `${STAGE_HEIGHT}px`,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            {/* 1. Simulated Browser Chrome */}
            <div className="h-[38px] bg-stone-200 border-b border-stone-400 px-3 flex items-center justify-between text-xs font-mono-clean">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-stone-800 text-amber-300 font-bold text-[10px]">
                  TARGET RECORDING
                </span>
                <span className="text-stone-500">
                  target-loop://shinkansen-case-042/recording.mp4 (CONTINUOUS REPLAY)
                </span>
              </div>
              <span className="text-red-800 font-bold text-[11px]">
                🔒 TEXT REDACTED IN REPLAY
              </span>
            </div>

            {/* 2. Twin Redacted Shinkansen UI Layout (Zero text leakage, 1:1 visual structure) */}
            <div className="h-[46px] bg-emerald-800 text-white px-5 flex items-center justify-between border-b-2 border-emerald-950">
              <div className="flex items-center gap-3">
                <span className="bg-white/20 px-3 py-1 rounded-sm inline-block w-24 h-5" />
                <span className="bg-black/60 px-4 py-1 rounded-sm inline-block w-72 h-5" />
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-emerald-950/60 inline-block w-20 h-6 rounded-sm" />
                <span className="bg-red-700 inline-block w-20 h-6 rounded-sm" />
              </div>
            </div>

            {/* Decoy Red Insurance Banner (Row 1 — Avoided in Target Replay!) */}
            <div className="mx-5 mt-2.5 h-[44px] bg-amber-50 border-2 border-red-500 px-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="bg-red-600 text-white text-[10px] font-black px-1.5 py-0.5">
                  TRAP AD
                </span>
                <span className="bg-neutral-900 inline-block w-80 h-4 rounded-sm" />
              </div>
              <div className="px-3.5 py-1.5 bg-red-600 text-white rounded-sm w-44 h-7 flex items-center justify-center">
                <span className="bg-black/40 inline-block w-32 h-3 rounded-sm" />
              </div>
            </div>

            {/* Main Workspace: Left Filter Column + Right Seat Matrix */}
            <div className="mx-5 mt-3 grid grid-cols-12 gap-4 h-[515px]">
              {/* Left Column (Col A) */}
              <div className="col-span-3 bg-stone-100 border border-stone-300 p-3 flex flex-col justify-between">
                <div className="space-y-2.5">
                  <div className="bg-neutral-800 h-4 w-24 rounded-sm" />
                  <div className="bg-emerald-50 border border-emerald-600 p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono-clean font-black text-emerald-900">
                        ✓ PRE-SET 1 &amp; 2
                      </span>
                    </div>
                    <div className="bg-neutral-900 h-4 w-36 rounded-sm" />
                    <div className="bg-neutral-700 h-3 w-28 rounded-sm" />
                  </div>
                  <div className="w-full py-2 px-2.5 bg-white border border-stone-400 h-8" />
                </div>
                <div className="space-y-1.5">
                  <div className="p-2 bg-stone-200 border border-stone-300 h-7" />
                  <div className="p-2 bg-stone-200 border border-stone-300 h-7" />
                </div>
              </div>

              {/* Right Column: Train Seat Matrix Table (Col B, C, D) */}
              <div className="col-span-9 flex flex-col justify-between">
                <div className="border border-stone-300 bg-white">
                  <div className="grid grid-cols-4 bg-stone-100 border-b border-stone-300 text-center py-2.5 px-2 gap-2">
                    <div className="bg-neutral-800 h-4 w-28 mx-auto rounded-sm" />
                    <div className="bg-neutral-800 h-4 w-20 mx-auto rounded-sm" />
                    <div className="bg-neutral-800 h-4 w-24 mx-auto rounded-sm" />
                    <div className="bg-emerald-900 h-4 w-24 mx-auto rounded-sm" />
                  </div>

                  {/* Train Row 1 */}
                  <div className="grid grid-cols-4 items-center border-b border-stone-200 p-3 gap-2">
                    <div className="space-y-1">
                      <div className="bg-neutral-800 h-4 w-28 rounded-sm" />
                      <div className="bg-neutral-400 h-3 w-20 rounded-sm" />
                    </div>
                    <div className="mx-auto w-32 h-9 border border-stone-400 bg-stone-50 rounded-sm" />
                    <div className="mx-auto w-32 h-9 border border-stone-400 bg-stone-50 rounded-sm" />
                    <div className="mx-auto w-24 h-6 bg-stone-200 rounded-sm" />
                  </div>

                  {/* Train Row 2 (Target Row!) */}
                  <div
                    className={`grid grid-cols-4 items-center p-3 gap-2 transition-colors ${
                      currentPhase.greenSelected ? 'bg-emerald-50/90' : 'bg-amber-50/30'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="bg-blue-900 h-4 w-28 rounded-sm" />
                      <div className="bg-neutral-500 h-3 w-20 rounded-sm" />
                    </div>
                    <div className="mx-auto w-32 h-9 border border-stone-400 bg-white rounded-sm" />
                    <div className="mx-auto w-32 h-9 border border-stone-400 bg-white rounded-sm" />

                    {/* TARGET CLICK 1: GREEN BUTTON AT COL D, ROW 3 */}
                    <div className="text-center">
                      <div
                        className={`mx-auto w-44 h-10 border-2 rounded-sm flex items-center justify-center gap-2 transition-all ${
                          currentPhase.greenSelected
                            ? 'bg-emerald-700 border-amber-300 ring-4 ring-amber-400 scale-105 shadow-lg'
                            : 'bg-emerald-600 border-emerald-900'
                        }`}
                      >
                        <span className="text-white font-mono-clean font-black text-xs">
                          🍀 STEP 1 (D3)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Action Bar (Row 4) */}
            <div className="mx-5 mt-3 h-[66px] bg-stone-100 border-t-2 border-stone-300 px-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border border-stone-400 bg-white" />
                <div className="bg-neutral-800 w-48 h-4 rounded-sm" />
              </div>

              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-stone-300 border border-stone-400 w-36 h-9 rounded-sm" />

                {/* TARGET CLICK 2: BLUE CONFIRM BUTTON AT COL D, ROW 4 */}
                <div
                  className={`px-5 py-2 bg-blue-600 text-white border-2 rounded-sm w-48 h-10 flex items-center justify-center transition-all ${
                    currentPhase.blueConfirmed
                      ? 'bg-blue-800 border-amber-300 ring-4 ring-amber-400 scale-105 shadow-lg'
                      : 'border-blue-900'
                  }`}
                >
                  <span className="font-mono-clean font-black text-xs">
                    STEP 2: CONFIRM (D4) ▶
                  </span>
                </div>
              </div>
            </div>

            {/* 3. SVG Trajectory Path & Animated Ghost Cursor Overlay */}
            <svg
              viewBox="0 0 1024 768"
              className="absolute inset-0 w-full h-full pointer-events-none z-20"
            >
              {/* Dashed Trajectory Line from Step 1 (885, 468) to Step 2 (905, 720) */}
              <path
                d="M 512 360 L 885 468 L 905 720"
                fill="none"
                stroke="#FACC15"
                strokeWidth="3.5"
                strokeDasharray="8 6"
                opacity="0.85"
              />

              {/* Persistent Step 1 Marker (885, 468) */}
              <g transform="translate(885, 468)">
                <circle r="14" fill="#FACC15" stroke="#111111" strokeWidth="2.5" />
                <text
                  y="4"
                  textAnchor="middle"
                  fill="#111111"
                  fontSize="12"
                  fontWeight="900"
                  fontFamily="monospace"
                >
                  1
                </text>
              </g>

              {/* Persistent Step 2 Marker (905, 720) */}
              <g transform="translate(905, 720)">
                <circle r="14" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2.5" />
                <text
                  y="4"
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="12"
                  fontWeight="900"
                  fontFamily="monospace"
                >
                  2
                </text>
              </g>
            </svg>

            {/* Animated Ghost Cursor */}
            <div
              className="absolute z-30 pointer-events-none transition-all duration-700 ease-in-out"
              style={{
                left: `${(currentPhase.cursorX / STAGE_WIDTH) * 100}%`,
                top: `${(currentPhase.cursorY / STAGE_HEIGHT) * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {/* Expanding Click Ripple when clicking */}
              {currentPhase.isClicking && (
                <div className="absolute -inset-6 rounded-full border-4 border-amber-400 bg-amber-300/30 animate-ping" />
              )}

              {/* Ghost Cursor Crosshair */}
              <div className="w-8 h-8 rounded-full bg-amber-400 border-2 border-black shadow-ink flex items-center justify-center font-mono-clean font-black text-xs text-black">
                🎯
              </div>

              {/* Floating Step Callout Tag */}
              <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 w-56 bg-neutral-900 text-amber-300 border-2 border-amber-400 px-2.5 py-1.5 font-mono-clean text-xs shadow-ink">
                <div className="font-black text-white">{currentPhase.label}</div>
                <div className="text-[10px] text-stone-300 mt-0.5">{currentPhase.sublabel}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Timeline Caption Bar */}
      <div className="bg-stone-100 border-t-2 border-dossier-ink px-3 py-2 flex flex-wrap items-center justify-between gap-2 font-mono-clean text-xs text-dossier-ink">
        <span>
          <strong>🎯 YOUR GOAL:</strong> Make your AI agent on the left page perform{' '}
          <strong>Step 1 (Col D, Row 3)</strong> then <strong>Step 2 (Col D, Row 4)</strong> using
          English prompts.
        </span>
        <span className="px-2 py-0.5 bg-dossier-ink text-dossier-accent font-black">
          GRID TARGETS: D3 → D4
        </span>
      </div>
    </div>
  );
};

export default LoopedTargetReplay;
