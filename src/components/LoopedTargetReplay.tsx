import React, { useEffect, useState, useRef } from 'react';
import { ShinkansenSandbox } from './ShinkansenSandbox';
import { CASE_001_INITIAL_MICRO_STATE } from '../data/puzzles/case_001';
import type { ShinkansenMicroState } from '../types/engine';

export interface LoopedTargetReplayProps {
  /** Optional className override */
  className?: string;
  /** Whether the replay panel is currently expanded */
  isExpanded?: boolean;
  /** Callback to toggle expanded/compact replay size */
  onToggleExpand?: () => void;
  /** Whether the replay automatically loops */
  autoplay?: boolean;
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
  routeBtn: { x: 265, y: 290 },
  nameInput: { x: 480, y: 395 },
  greenBtn: { x: 875, y: 390 },
  sigStart: { x: 210, y: 405 },
  sigEnd: { x: 810, y: 405 },
  confirmBtn: { x: 890, y: 695 },
};

const PASSENGER_NAME = 'TANAKA';

/**
 * Multi-page, multi-modal continuous looping target replay.
 * Traverses 5 distinct pages of the 12-page JR-East Ekinet portal:
 * - Page 01 / 12 (MV-01): Clicks the Tokaido-Sanyo Shinkansen route card (#btn-route-tokaido)
 * - Page 02 / 12 (MV-02): Types "TANAKA" into the Passenger Name field (#input-passenger-name)
 * - Page 03 / 12 (MV-03): Times a click on the Green Car button (#target-green-btn) when the moving flash window lands on Column 3
 * - Page 04 / 12 (MV-04): Draws a handwritten signature inside the Digital Signature Pad (#signature-canvas) and clicks the blue Confirm button (#target-confirm-btn)
 * - Page 05 / 12 (MV-05): Displays the completed Shinkansen e-Ticket Issuance screen
 */
export const LoopedTargetReplay: React.FC<LoopedTargetReplayProps> = ({
  className = '',
  isExpanded = false,
  onToggleExpand,
  autoplay = true,
}) => {
  const [phase, setPhase] = useState<number>(0); // 0 to 100
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [scale, setScale] = useState<number>(1);
  const [targets, setTargets] = useState<ReplayTargets>(DEFAULT_TARGETS);

  const outerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Measure outer container width for responsive scaling (updates immediately on expand/shrink)
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

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && outerRef.current) {
      observer = new ResizeObserver(() => updateScale());
      observer.observe(outerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateScale);
      observer?.disconnect();
    };
  }, [isExpanded]);

  // Continuous 100-tick loop (115ms per tick = 11.5s unhurried 5-page multi-modal cycle)
  useEffect(() => {
    if (isPaused || !autoplay) return;
    const interval = setInterval(() => {
      setPhase((prev) => (prev + 1) % 100);
    }, 115);
    return () => clearInterval(interval);
  }, [isPaused, autoplay]);

  const startPos = { x: 512, y: 140 };
  const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));

  // Derive multi-page state, cursor coordinates, click ripple, typed characters, moving flash column, and signature stroke
  let cursorX = startPos.x;
  let cursorY = startPos.y;
  let isClicking = false;
  let routeSelected = false;
  let typedChars = 0;
  let passengerSubmitted = false;
  let activeFlashColumn: 0 | 1 | 2 = 0;
  let greenSelected = false;
  let sigProgress = 0;
  let finalConfirmed = false;
  let currentMacroViewId = 'MV-01';

  if (phase < 10) {
    // PAGE 01 (MV-01): Glide to Tokaido-Sanyo Shinkansen Route Card (#btn-route-tokaido)
    currentMacroViewId = 'MV-01';
    const t = phase / 10;
    cursorX = lerp(startPos.x, targets.routeBtn.x, t);
    cursorY = lerp(startPos.y, targets.routeBtn.y, t);
  } else if (phase < 18) {
    // PAGE 01 (MV-01): Click Route Card (#btn-route-tokaido)
    currentMacroViewId = 'MV-01';
    cursorX = targets.routeBtn.x;
    cursorY = targets.routeBtn.y;
    isClicking = true;
    routeSelected = phase >= 13;
  } else if (phase < 25) {
    // PAGE 02 (MV-02): Glide to Passenger Name Input (#input-passenger-name)
    currentMacroViewId = 'MV-02';
    routeSelected = true;
    const t = (phase - 18) / 7;
    cursorX = lerp(targets.routeBtn.x, targets.nameInput.x, t);
    cursorY = lerp(targets.routeBtn.y, targets.nameInput.y, t);
  } else if (phase < 40) {
    // PAGE 02 (MV-02): Click & Type "TANAKA" character by character
    currentMacroViewId = 'MV-02';
    routeSelected = true;
    cursorX = targets.nameInput.x;
    cursorY = targets.nameInput.y;
    isClicking = phase < 29;
    typedChars = Math.min(
      PASSENGER_NAME.length,
      Math.floor(((phase - 25) / 12) * PASSENGER_NAME.length) + 1
    );
  } else if (phase < 50) {
    // PAGE 03 (MV-03): Glide to Green Car Button (#target-green-btn) while flash-sale window cycles
    currentMacroViewId = 'MV-03';
    routeSelected = true;
    typedChars = PASSENGER_NAME.length;
    passengerSubmitted = true;
    const t = (phase - 40) / 10;
    cursorX = lerp(targets.nameInput.x, targets.greenBtn.x, t);
    cursorY = lerp(targets.nameInput.y, targets.greenBtn.y, t);
    activeFlashColumn = phase < 44 ? 0 : phase < 48 ? 1 : 2;
  } else if (phase < 58) {
    // PAGE 03 (MV-03): Timed Click on #target-green-btn right when activeFlashColumn === 2
    currentMacroViewId = 'MV-03';
    routeSelected = true;
    typedChars = PASSENGER_NAME.length;
    passengerSubmitted = true;
    cursorX = targets.greenBtn.x;
    cursorY = targets.greenBtn.y;
    isClicking = true;
    activeFlashColumn = 2;
  } else if (phase < 64) {
    // PAGE 04 (MV-04): Glide to Digital Signature Pad Start (#signature-canvas)
    currentMacroViewId = 'MV-04';
    routeSelected = true;
    typedChars = PASSENGER_NAME.length;
    passengerSubmitted = true;
    greenSelected = true;
    const t = (phase - 58) / 6;
    cursorX = lerp(targets.greenBtn.x, targets.sigStart.x, t);
    cursorY = lerp(targets.greenBtn.y, targets.sigStart.y, t);
  } else if (phase < 78) {
    // PAGE 04 (MV-04): Draw Signature across #signature-canvas
    currentMacroViewId = 'MV-04';
    routeSelected = true;
    typedChars = PASSENGER_NAME.length;
    passengerSubmitted = true;
    greenSelected = true;
    const t = (phase - 64) / 14;
    cursorX = lerp(targets.sigStart.x, targets.sigEnd.x, t);
    cursorY = targets.sigStart.y + Math.sin(t * Math.PI * 4) * 10;
    isClicking = true;
    sigProgress = Math.min(1, t);
  } else if (phase < 84) {
    // PAGE 04 (MV-04): Glide to Final Blue Confirm Button (#target-confirm-btn)
    currentMacroViewId = 'MV-04';
    routeSelected = true;
    typedChars = PASSENGER_NAME.length;
    passengerSubmitted = true;
    greenSelected = true;
    sigProgress = 1;
    const t = (phase - 78) / 6;
    cursorX = lerp(targets.sigEnd.x, targets.confirmBtn.x, t);
    cursorY = lerp(targets.sigEnd.y, targets.confirmBtn.y, t);
  } else if (phase < 91) {
    // PAGE 04 (MV-04): Click Final Blue Confirm Button
    currentMacroViewId = 'MV-04';
    routeSelected = true;
    typedChars = PASSENGER_NAME.length;
    passengerSubmitted = true;
    greenSelected = true;
    sigProgress = 1;
    cursorX = targets.confirmBtn.x;
    cursorY = targets.confirmBtn.y;
    isClicking = true;
  } else {
    // PAGE 05 (MV-05): Official Shinkansen e-Ticket Issued!
    currentMacroViewId = 'MV-05';
    routeSelected = true;
    typedChars = PASSENGER_NAME.length;
    passengerSubmitted = true;
    greenSelected = true;
    sigProgress = 1;
    finalConfirmed = true;
    cursorX = targets.confirmBtn.x;
    cursorY = targets.confirmBtn.y;
  }

  // Dynamically refine DOM element coordinates whenever the active replay page changes
  useEffect(() => {
    if (!stageRef.current) return;
    const stageRect = stageRef.current.getBoundingClientRect();
    if (stageRect.width <= 0 || stageRect.height <= 0) return;

    const centerOf = (selector: string) => {
      const el = stageRef.current?.querySelector(selector) as HTMLElement | null;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width <= 0) return null;
      return {
        x: ((r.left + r.width / 2 - stageRect.left) / stageRect.width) * 1024,
        y: ((r.top + r.height / 2 - stageRect.top) / stageRect.height) * 768,
      };
    };

    const routeCenter = centerOf('#btn-route-tokaido');
    const nameCenter = centerOf('#input-passenger-name');
    const greenCenter = centerOf('#target-green-btn');
    const confirmCenter = centerOf('#target-confirm-btn');

    let sigStart: { x: number; y: number } | null = null;
    let sigEnd: { x: number; y: number } | null = null;
    const sigEl = stageRef.current.querySelector('#signature-canvas') as HTMLElement | null;
    if (sigEl) {
      const sr = sigEl.getBoundingClientRect();
      if (sr.width > 0) {
        const cy = ((sr.top + sr.height / 2 - stageRect.top) / stageRect.height) * 768;
        sigStart = {
          x: ((sr.left + sr.width * 0.16 - stageRect.left) / stageRect.width) * 1024,
          y: cy,
        };
        sigEnd = {
          x: ((sr.left + sr.width * 0.84 - stageRect.left) / stageRect.width) * 1024,
          y: cy,
        };
      }
    }

    setTargets((prev) => ({
      routeBtn: routeCenter ?? prev.routeBtn,
      nameInput: nameCenter ?? prev.nameInput,
      greenBtn: greenCenter ?? prev.greenBtn,
      sigStart: sigStart ?? prev.sigStart,
      sigEnd: sigEnd ?? prev.sigEnd,
      confirmBtn: confirmCenter ?? prev.confirmBtn,
    }));
  }, [currentMacroViewId, scale]);

  const replayMicroState: ShinkansenMicroState = {
    ...CASE_001_INITIAL_MICRO_STATE,
    macroViewId: currentMacroViewId,
    selectedRoute: routeSelected ? 'tokyo_osaka' : 'none',
    passengerName:
      passengerSubmitted
        ? PASSENGER_NAME
        : typedChars > 0
        ? PASSENGER_NAME.slice(0, typedChars)
        : '',
    greenCarSelected: greenSelected,
    trainName: greenSelected ? 'Nozomi 24' : 'none',
    seatClass: greenSelected ? 'green_car' : 'none',
    fare: greenSelected ? 13870 : 0,
    signatureStroke: sigProgress >= 1 ? 'SHAPE:signature' : undefined,
    finalConfirmed,
  };

  const scaledHeight = Math.round(768 * scale);

  return (
    <div
      id="looped-target-replay"
      data-testid="looped-target-replay"
      className={`border-2 border-dossier-ink bg-dossier-card shadow-ink flex flex-col ${className}`}
    >
      {/* Minimal Top Bar: Pause / Start Replay + Click to Expand / Shrink */}
      <div className="bg-dossier-ink text-dossier-paper px-3 py-2 flex items-center justify-between gap-2 border-b-2 border-dossier-ink">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-600 text-white font-mono-clean font-black text-xs uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            TARGET REPLAY
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {onToggleExpand && (
            <button
              type="button"
              id="btn-replay-expand"
              data-testid="btn-replay-expand"
              onClick={onToggleExpand}
              className="px-2.5 py-1 bg-amber-300 hover:bg-amber-200 text-stone-950 border border-stone-900 font-mono-clean font-black text-xs uppercase cursor-pointer"
              title={isExpanded ? 'Shrink demo replay back to compact size' : 'Expand demo replay for a closer look'}
            >
              {isExpanded ? '↙ Shrink' : '🔍 Expand'}
            </button>
          )}
          <button
            type="button"
            id="btn-replay-pause"
            onClick={() => setIsPaused(!isPaused)}
            className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-white border border-stone-500 font-mono-clean font-bold text-xs uppercase cursor-pointer"
          >
            {isPaused ? '▶ Start Replay' : '⏸ Pause Replay'}
          </button>
        </div>
      </div>

      {/* 1:1 Unredacted Multi-Page Site with Mouse, Typing, Timed Click & Signature Drawing (Click to Expand/Shrink) */}
      <div
        ref={outerRef}
        onClick={onToggleExpand}
        role={onToggleExpand ? 'button' : undefined}
        tabIndex={onToggleExpand ? 0 : undefined}
        onKeyDown={
          onToggleExpand
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onToggleExpand();
                }
              }
            : undefined
        }
        title={
          onToggleExpand
            ? isExpanded
              ? 'Click to shrink demo replay'
              : 'Click to expand demo replay'
            : undefined
        }
        className={`w-full overflow-hidden bg-stone-900 relative group ${
          onToggleExpand ? 'cursor-zoom-in' : ''
        }`}
        style={{ height: `${scaledHeight}px` }}
      >
        {onToggleExpand && (
          <div className="absolute bottom-2 right-2 z-40 px-2 py-0.5 bg-stone-900/85 text-amber-300 border border-amber-400/70 font-mono-clean font-bold text-[10px] uppercase tracking-wider pointer-events-none shadow-sm">
            {isExpanded ? '↙ Click Replay to Shrink' : '🔍 Click Replay to Expand'}
          </div>
        )}
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
          {/* Exact 1:1 Unredacted Multi-Page Shinkansen Webpage */}
          <ShinkansenSandbox
            microState={replayMicroState}
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
                d="M4 2 L4 22 L9.5 17 L13.5 25 L17 23.5 L13 15.5 L21 15.5 Z"
                fill="#FACC15"
                stroke="#111111"
                strokeWidth="2.2"
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
