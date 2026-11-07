import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { STAGE_WIDTH, STAGE_HEIGHT } from '../utils/coordinate_projector';
import { CASE_042_INITIAL_MICRO_STATE } from '../data/puzzles/case_042';
import { ShinkansenSandbox } from './ShinkansenSandbox';

export interface LoopedTargetReplayProps {
  /** Optional override for play/pause state */
  autoPlay?: boolean;
  /** Optional className */
  className?: string;
}

/**
 * Continuous looping video replay of the target actions on an exact 1:1 unredacted
 * copy of the site. Shows ONLY the mouse movement and a glowing click ripple —
 * no step labels, no text on the cursor, no coordinate rulers, and no redaction bars.
 */
export const LoopedTargetReplay: React.FC<LoopedTargetReplayProps> = ({
  autoPlay = true,
  className = '',
}) => {
  // Replay timeline frames:
  // 0: Initial idle state at center
  // 1: Mouse glides to the green seat button (#target-green-btn)
  // 2: Mouse clicks the green seat button (glowing click ripple + button turns selected)
  // 3: Mouse glides down to the blue confirm button (#target-confirm-btn)
  // 4: Mouse clicks the blue confirm button (glowing click ripple + button turns confirmed)
  // 5: Brief pause on completed state before looping back to 0
  const [frame, setFrame] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(autoPlay);

  const outerRef = useRef<HTMLDivElement>(null);
  const stageCoreRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(1);

  // Dynamically measured button centers inside the 1024x768 coordinate space
  const [greenPos, setGreenPos] = useState<{ x: number; y: number }>({ x: 895, y: 230 });
  const [confirmPos, setConfirmPos] = useState<{ x: number; y: number }>({ x: 905, y: 740 });

  // Measure container width to scale 1024x768 replay stage proportionally
  useLayoutEffect(() => {
    const updateLayout = () => {
      if (outerRef.current) {
        const w = outerRef.current.clientWidth;
        if (w > 0) {
          setScale(Math.min(w / STAGE_WIDTH, 1));
        }
      }

      // Measure actual DOM positions of #target-green-btn and #target-confirm-btn inside stageCoreRef
      if (stageCoreRef.current) {
        const coreRect = stageCoreRef.current.getBoundingClientRect();
        if (coreRect.width > 0 && coreRect.height > 0) {
          const greenEl = stageCoreRef.current.querySelector('#target-green-btn');
          const confirmEl = stageCoreRef.current.querySelector('#target-confirm-btn');

          if (greenEl) {
            const r = greenEl.getBoundingClientRect();
            const cx = ((r.left + r.width / 2 - coreRect.left) / coreRect.width) * STAGE_WIDTH;
            const cy = ((r.top + r.height / 2 - coreRect.top) / coreRect.height) * STAGE_HEIGHT;
            if (cx > 0 && cy > 0) {
              setGreenPos({ x: Math.round(cx), y: Math.round(cy) });
            }
          }

          if (confirmEl) {
            const r = confirmEl.getBoundingClientRect();
            const cx = ((r.left + r.width / 2 - coreRect.left) / coreRect.width) * STAGE_WIDTH;
            const cy = ((r.top + r.height / 2 - coreRect.top) / coreRect.height) * STAGE_HEIGHT;
            if (cx > 0 && cy > 0) {
              setConfirmPos({ x: Math.round(cx), y: Math.round(cy) });
            }
          }
        }
      }
    };

    updateLayout();
    const timer = setTimeout(updateLayout, 60);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && outerRef.current) {
      observer = new ResizeObserver(updateLayout);
      observer.observe(outerRef.current);
    }
    window.addEventListener('resize', updateLayout);
    return () => {
      clearTimeout(timer);
      if (observer) observer.disconnect();
      window.removeEventListener('resize', updateLayout);
    };
  }, []);

  // Continuous playback loop
  useEffect(() => {
    if (!isPlaying || process.env.NODE_ENV === 'test') return;
    const durations = [900, 1100, 950, 1100, 950, 1100];
    const timeout = setTimeout(() => {
      setFrame((prev) => (prev + 1) % 6);
    }, durations[frame] ?? 1000);
    return () => clearTimeout(timeout);
  }, [isPlaying, frame]);

  // Compute cursor position & microState for the current frame
  let cursorX = 480;
  let cursorY = 360;
  let isClicking = false;
  let greenSelected = false;
  let blueConfirmed = false;

  if (frame === 1) {
    cursorX = greenPos.x;
    cursorY = greenPos.y;
  } else if (frame === 2) {
    cursorX = greenPos.x;
    cursorY = greenPos.y;
    isClicking = true;
    greenSelected = true;
  } else if (frame === 3) {
    cursorX = confirmPos.x;
    cursorY = confirmPos.y;
    greenSelected = true;
  } else if (frame === 4) {
    cursorX = confirmPos.x;
    cursorY = confirmPos.y;
    isClicking = true;
    greenSelected = true;
    blueConfirmed = true;
  } else if (frame === 5) {
    cursorX = confirmPos.x;
    cursorY = confirmPos.y;
    greenSelected = true;
    blueConfirmed = true;
  }

  const replayMicroState = {
    ...CASE_042_INITIAL_MICRO_STATE,
    greenCarSelected: greenSelected,
    finalConfirmed: blueConfirmed,
  };

  const scaledHeight = Math.round(STAGE_HEIGHT * scale);

  return (
    <div
      data-testid="looped-target-replay"
      className={`flex flex-col bg-dossier-card border-2 border-dossier-ink shadow-ink ${className}`}
    >
      {/* Minimal Video Player Bar: Only Title + Start/Pause Replay */}
      <div className="bg-dossier-ink text-dossier-paper px-3 py-2 flex items-center justify-between gap-2 border-b-2 border-dossier-ink font-mono-clean text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-700 text-white font-black uppercase tracking-wider text-[11px]">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            TARGET REPLAY
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsPlaying(!isPlaying)}
          className="px-3 py-1 bg-dossier-accent text-dossier-ink hover:bg-amber-300 font-black uppercase text-xs border border-black"
        >
          {isPlaying ? '⏸ Pause Replay' : '▶ Start Replay'}
        </button>
      </div>

      {/* Exact 1:1 Unredacted Copy of the Webpage with Animated Mouse & Click Glow */}
      <div
        ref={outerRef}
        className="relative w-full overflow-hidden bg-neutral-100 select-none no-select"
        style={{ height: `${scaledHeight}px` }}
        onCopy={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          ref={stageCoreRef}
          className="bg-white text-neutral-900 no-select relative overflow-hidden flex flex-col justify-between pointer-events-none"
          style={{
            width: `${STAGE_WIDTH}px`,
            height: `${STAGE_HEIGHT}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          {/* Simulated Browser Chrome Bar */}
          <div className="bg-neutral-200 border-b border-neutral-400 px-3 py-1 flex items-center justify-between text-xs text-neutral-700 font-mono-clean h-[32px] select-none shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-neutral-400">
                <span className="text-xs font-bold px-1 bg-neutral-300 rounded">◀</span>
                <span className="text-xs font-bold px-1 bg-neutral-300 rounded">▶</span>
                <span className="text-xs font-bold px-1 bg-neutral-300 rounded text-neutral-700">↻</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white border border-neutral-300 px-2 py-0.5 rounded text-neutral-800 text-[11px]">
                <span className="text-neutral-500">🔒</span>
                <span className="font-mono-clean truncate max-w-[500px]">
                  target-replay://ekinet-jr-sim.jp/reserve/seat-matrix
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 font-bold text-red-700 text-[11px] uppercase tracking-wider">
              <span>🔁 DEMO RECORDING</span>
            </div>
          </div>

          {/* Exact Copy of ShinkansenSandbox (Unredacted) */}
          <div className="relative w-full h-[736px] overflow-hidden flex-1">
            <ShinkansenSandbox
              microState={replayMicroState}
              somOverlayActive={false}
            />
          </div>

          {/* Animated Mouse Pointer + Click Glow Only (No Text or Instructions on Cursor) */}
          <div
            className="absolute z-30 pointer-events-none transition-all duration-700 ease-in-out"
            style={{
              left: `${(cursorX / STAGE_WIDTH) * 100}%`,
              top: `${(cursorY / STAGE_HEIGHT) * 100}%`,
            }}
          >
            {/* Glowing Click Ring when clicking */}
            {isClicking && (
              <>
                <div className="absolute -left-7 -top-7 w-14 h-14 rounded-full bg-amber-400/50 border-4 border-amber-300 animate-ping" />
                <div className="absolute -left-5 -top-5 w-10 h-10 rounded-full bg-amber-300/60 border-2 border-amber-500 shadow-[0_0_20px_rgba(250,204,21,0.95)]" />
              </>
            )}

            {/* Clean High-Contrast Mouse Arrow SVG */}
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              className={`-ml-1 -mt-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.65)] transition-transform duration-150 ${
                isClicking ? 'scale-90' : 'scale-100'
              }`}
            >
              <path
                d="M4 2 L4 19 L8.5 14.5 L12.5 22 L15.5 20.5 L11.5 13 L18 13 Z"
                fill="#FACC15"
                stroke="#111111"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoopedTargetReplay;
