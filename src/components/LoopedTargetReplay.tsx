import React, { useEffect, useState, useRef } from 'react';
import { ShinkansenSandbox } from './ShinkansenSandbox';
import { CASE_042_INITIAL_MICRO_STATE } from '../data/puzzles/case_042';
import type { ShinkansenMicroState } from '../types/engine';

export interface LoopedTargetReplayProps {
  /** Optional className override */
  className?: string;
}

interface ReplayTargets {
  routeBtn: { x: number; y: number };
  nameInput: { x: number; y: number };
  greenBtn: { x: number; y: number };
  sigStart: { x: number; y: number };
  sigEnd: { x: number; y: number };
  confirmBtn: { x: number; y: number };
}

const DEFAULT_TARGETS: ReplayTargets = {
  routeBtn: { x: 310, y: 58 },
  nameInput: { x: 128, y: 245 },
  greenBtn: { x: 895, y: 270 },
  sigStart: { x: 620, y: 375 },
  sigEnd: { x: 880, y: 375 },
  confirmBtn: { x: 905, y: 740 },
};

const PASSENGER_NAME = 'TANAKA';

/**
 * Multi-page, multi-modal continuous looping target replay.
 * Demonstrates:
 * 1. Selecting the Tokaido-Sanyo Shinkansen route (#btn-route-tokaido)
 * 2. Typing "TANAKA" into the Passenger Name field (#input-passenger-name)
 * 3. Timing a click on the Green Car discount button (#target-green-btn) when the moving flash window lands on it
 * 4. Drawing a handwritten signature inside the Digital Signature Pad (#signature-canvas)
 * 5. Clicking the blue Confirm button (#target-confirm-btn)
 */
export const LoopedTargetReplay: React.FC<LoopedTargetReplayProps> = ({ className = '' }) => {
  const [phase, setPhase] = useState<number>(0); // 0 to 100
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [scale, setScale] = useState<number>(1);
  const [targets, setTargets] = useState<ReplayTargets>(DEFAULT_TARGETS);

  const outerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Measure outer container width for responsive scaling
  useEffect(() => {
    const updateScale = () => {
      if (outerRef.current) {
        const w = outerRef.current.clientWidth;
        if (w > 0) {
          setScale(Math.min(1, w / 1024));
        }
      }
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  // Measure exact DOM element centers inside the 1024x768 sandbox
  useEffect(() => {
    const measureTargets = () => {
      if (!stageRef.current) return;
      const stageRect = stageRef.current.getBoundingClientRect();
      if (stageRect.width <= 0 || stageRect.height <= 0) return;

      const centerOf = (selector: string, fallback: { x: number; y: number }) => {
        const el = stageRef.current?.querySelector(selector) as HTMLElement | null;
        if (!el) return fallback;
        const r = el.getBoundingClientRect();
        if (r.width <= 0) return fallback;
        return {
          x: ((r.left + r.width / 2 - stageRect.left) / stageRect.width) * 1024,
          y: ((r.top + r.height / 2 - stageRect.top) / stageRect.height) * 768,
        };
      };

      const sigEl = stageRef.current.querySelector('#signature-canvas') as HTMLElement | null;
      let sigStart = DEFAULT_TARGETS.sigStart;
      let sigEnd = DEFAULT_TARGETS.sigEnd;
      if (sigEl) {
        const sr = sigEl.getBoundingClientRect();
        if (sr.width > 0) {
          const cy = ((sr.top + sr.height / 2 - stageRect.top) / stageRect.height) * 768;
          sigStart = {
            x: ((sr.left + sr.width * 0.18 - stageRect.left) / stageRect.width) * 1024,
            y: cy,
          };
          sigEnd = {
            x: ((sr.left + sr.width * 0.82 - stageRect.left) / stageRect.width) * 1024,
            y: cy,
          };
        }
      }

      setTargets({
        routeBtn: centerOf('#btn-route-tokaido', DEFAULT_TARGETS.routeBtn),
        nameInput: centerOf('#input-passenger-name', DEFAULT_TARGETS.nameInput),
        greenBtn: centerOf('#target-green-btn', DEFAULT_TARGETS.greenBtn),
        sigStart,
        sigEnd,
        confirmBtn: centerOf('#target-confirm-btn', DEFAULT_TARGETS.confirmBtn),
      });
    };

    const timer = setTimeout(measureTargets, 60);
    window.addEventListener('resize', measureTargets);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', measureTargets);
    };
  }, [scale]);

  // Continuous 100-tick loop (75ms per tick = 7.5s full multi-page/multi-modal cycle)
  useEffect(() => {
    if (isPaused || process.env.NODE_ENV === 'test') return;
    const interval = setInterval(() => {
      setPhase((prev) => (prev + 1) % 100);
    }, 75);
    return () => clearInterval(interval);
  }, [isPaused]);

  const startPos = { x: 480, y: 120 };
  const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));

  // Derive cursor coordinates, click ripple, typed characters, moving flash column, and drawn signature
  let cursorX = startPos.x;
  let cursorY = startPos.y;
  let isClicking = false;
  let typedChars = 0;
  let activeFlashColumn: 0 | 1 | 2 = 0;
  let greenSelected = false;
  let sigProgress = 0;
  let finalConfirmed = false;

  if (phase < 10) {
    // 1. Move to Route Tab (#btn-route-tokaido)
    const t = phase / 10;
    cursorX = lerp(startPos.x, targets.routeBtn.x, t);
    cursorY = lerp(startPos.y, targets.routeBtn.y, t);
    activeFlashColumn = 0;
  } else if (phase < 16) {
    // Click Route Tab
    cursorX = targets.routeBtn.x;
    cursorY = targets.routeBtn.y;
    isClicking = true;
    activeFlashColumn = 0;
  } else if (phase < 24) {
    // 2. Move to Passenger Name Input (#input-passenger-name)
    const t = (phase - 16) / 8;
    cursorX = lerp(targets.routeBtn.x, targets.nameInput.x, t);
    cursorY = lerp(targets.routeBtn.y, targets.nameInput.y, t);
    activeFlashColumn = 1;
  } else if (phase < 38) {
    // Click & Type "TANAKA" character by character
    cursorX = targets.nameInput.x;
    cursorY = targets.nameInput.y;
    isClicking = phase < 28;
    typedChars = Math.min(
      PASSENGER_NAME.length,
      Math.floor(((phase - 25) / 11) * PASSENGER_NAME.length) + 1
    );
    activeFlashColumn = phase < 32 ? 0 : 1;
  } else if (phase < 46) {
    // 3. Move to Timed Flash Green Seat Button (#target-green-btn) while flash window cycles
    const t = (phase - 38) / 8;
    cursorX = lerp(targets.nameInput.x, targets.greenBtn.x, t);
    cursorY = lerp(targets.nameInput.y, targets.greenBtn.y, t);
    typedChars = PASSENGER_NAME.length;
    activeFlashColumn = phase < 43 ? 1 : 2;
  } else if (phase < 55) {
    // Timed Click on #target-green-btn right when activeFlashColumn === 2
    cursorX = targets.greenBtn.x;
    cursorY = targets.greenBtn.y;
    isClicking = true;
    typedChars = PASSENGER_NAME.length;
    activeFlashColumn = 2;
    greenSelected = true;
  } else if (phase < 63) {
    // 4. Move to Signature Canvas Start (#signature-canvas)
    const t = (phase - 55) / 8;
    cursorX = lerp(targets.greenBtn.x, targets.sigStart.x, t);
    cursorY = lerp(targets.greenBtn.y, targets.sigStart.y, t);
    typedChars = PASSENGER_NAME.length;
    activeFlashColumn = 2;
    greenSelected = true;
  } else if (phase < 78) {
    // Draw Signature across #signature-canvas
    const t = (phase - 63) / 15;
    cursorX = lerp(targets.sigStart.x, targets.sigEnd.x, t);
    cursorY = targets.sigStart.y + Math.sin(t * Math.PI * 4) * 8;
    isClicking = true;
    typedChars = PASSENGER_NAME.length;
    activeFlashColumn = 2;
    greenSelected = true;
    sigProgress = Math.min(1, t);
  } else if (phase < 86) {
    // 5. Move to Final Blue Confirm Button (#target-confirm-btn)
    const t = (phase - 78) / 8;
    cursorX = lerp(targets.sigEnd.x, targets.confirmBtn.x, t);
    cursorY = lerp(targets.sigEnd.y, targets.confirmBtn.y, t);
    typedChars = PASSENGER_NAME.length;
    activeFlashColumn = 2;
    greenSelected = true;
    sigProgress = 1;
  } else if (phase < 95) {
    // Click Final Blue Confirm Button
    cursorX = targets.confirmBtn.x;
    cursorY = targets.confirmBtn.y;
    isClicking = true;
    typedChars = PASSENGER_NAME.length;
    activeFlashColumn = 2;
    greenSelected = true;
    sigProgress = 1;
    finalConfirmed = true;
  } else {
    // Hold completed state briefly before looping
    cursorX = targets.confirmBtn.x;
    cursorY = targets.confirmBtn.y;
    typedChars = PASSENGER_NAME.length;
    activeFlashColumn = 2;
    greenSelected = true;
    sigProgress = 1;
    finalConfirmed = true;
  }

  const replayMicroState: ShinkansenMicroState = {
    ...CASE_042_INITIAL_MICRO_STATE,
    selectedRoute: phase >= 10 ? 'tokyo_osaka' : 'none',
    passengerName: typedChars > 0 ? PASSENGER_NAME.slice(0, typedChars) : '',
    greenCarSelected: greenSelected,
    trainName: greenSelected ? 'Nozomi 24' : 'none',
    seatClass: greenSelected ? 'green_car' : 'none',
    fare: greenSelected ? 13870 : 0,
    signatureSigned: sigProgress >= 1,
    finalConfirmed,
  };

  const scaledHeight = Math.round(768 * scale);

  return (
    <div
      id="looped-target-replay"
      data-testid="looped-target-replay"
      className={`border-2 border-dossier-ink bg-dossier-card shadow-ink flex flex-col ${className}`}
    >
      {/* Minimal Top Bar: Only Pause / Start Replay */}
      <div className="bg-dossier-ink text-dossier-paper px-3 py-2 flex items-center justify-between border-b-2 border-dossier-ink">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-600 text-white font-mono-clean font-black text-xs uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            TARGET REPLAY
          </span>
        </div>

        <button
          type="button"
          id="btn-replay-pause"
          onClick={() => setIsPaused(!isPaused)}
          className="px-3 py-1 bg-stone-800 hover:bg-stone-700 text-white border border-stone-500 font-mono-clean font-bold text-xs uppercase cursor-pointer"
        >
          {isPaused ? '▶ Start Replay' : '⏸ Pause Replay'}
        </button>
      </div>

      {/* 1:1 Unredacted Copy of the Site with Multi-Modal Mouse, Typing, Timed Click & Signature Drawing */}
      <div
        ref={outerRef}
        className="w-full overflow-hidden bg-stone-900 relative"
        style={{ height: `${scaledHeight}px` }}
      >
        <div
          ref={stageRef}
          style={{
            width: '1024px',
            height: '768px',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
          className="relative pointer-events-none select-none bg-white overflow-hidden"
        >
          {/* Exact 1:1 Unredacted Shinkansen Webpage */}
          <ShinkansenSandbox
            microState={replayMicroState}
            somOverlayActive={false}
            activeFlashColumn={activeFlashColumn}
            signatureProgress={sigProgress}
          />

          {/* Animated Mouse Cursor + Click Glow Only (No Text Callouts) */}
          <div
            data-testid="replay-cursor"
            style={{
              left: `${(cursorX / 1024) * 100}%`,
              top: `${(cursorY / 768) * 100}%`,
            }}
            className="absolute z-30 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-75 ease-linear"
          >
            {/* Glowing Click / Draw Ripple */}
            {isClicking && (
              <>
                <div className="absolute -inset-6 rounded-full border-4 border-amber-400 bg-amber-300/40 animate-ping" />
                <div className="absolute -inset-4 rounded-full border-2 border-red-600 bg-amber-400/50 shadow-[0_0_24px_rgba(250,204,21,0.95)]" />
              </>
            )}

            {/* High-Contrast Pointer Arrow */}
            <svg
              width="34"
              height="34"
              viewBox="0 0 28 28"
              className={`drop-shadow-[0_3px_6px_rgba(0,0,0,0.65)] transition-transform duration-100 ${
                isClicking ? 'scale-90' : 'scale-100'
              }`}
            >
              <path
                d="M 5 3 L 22 13 L 14 15 L 18 23 L 14 25 L 10 17 L 5 21 Z"
                fill={isClicking ? '#FACC15' : '#111111'}
                stroke="#FFFFFF"
                strokeWidth="2.2"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoopedTargetReplay;
