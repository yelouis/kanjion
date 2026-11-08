import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Sandbox } from '../data/puzzles/case_001/Sandbox';
import { CASE_001_PUZZLE } from '../data/puzzles/case_001/puzzle';
import { applyDecision, elementsOnPage } from '../engine/puzzle_engine';
import { FLASH_PERIOD_MS } from '../engine/flash_clock';
import type { PuzzleData, PuzzleState } from '../types/puzzle_data';

export interface LoopedTargetReplayProps {
  /** Optional className override */
  className?: string;
  /** Whether the replay panel is currently expanded */
  isExpanded?: boolean;
  /** Callback to toggle expanded/compact replay size */
  onToggleExpand?: () => void;
  /** Whether the replay automatically loops */
  autoplay?: boolean;
  /** Optional puzzle override (defaults to CASE_001_PUZZLE) */
  puzzle?: PuzzleData;
}

interface Point {
  x: number;
  y: number;
}

const DEFAULT_START_POS: Point = { x: 512, y: 140 };

const DEFAULT_KEY_CENTERS: Record<string, Point> = {
  route_tokaido: { x: 265, y: 290 },
  passenger_name: { x: 480, y: 395 },
  seat_nozomi_green: { x: 875, y: 390 },
  signature_pad: { x: 510, y: 405 },
  confirm_booking: { x: 890, y: 695 },
};

const GLIDE_MS = 1150;
const CLICK_HOLD_MS = 600;
const TYPE_CHAR_MS = 220;
const TYPE_SETTLE_MS = 650;
const DRAW_STEPS = 6;
const DRAW_STEP_MS = 180;
const DRAW_SETTLE_MS = 500;
const NAV_DWELL_MS = 800;
const FINAL_DWELL_MS = 2000;
const TICK_MS = 50;

interface ReplaySegment {
  startMs: number;
  endMs: number;
  kind: 'glide' | 'wait_timed' | 'click' | 'type' | 'type_settle' | 'draw' | 'draw_settle' | 'nav_dwell' | 'final_dwell';
  stepIndex: number;
  key: string;
  fromKey: string | null;
  stateBefore: PuzzleState;
  stateAfter: PuzzleState;
  text?: string;
  stroke?: string;
  timedColumn?: 0 | 1 | 2;
}

export function buildReplayTimeline(puzzle: PuzzleData): {
  segments: ReplaySegment[];
  totalDurationMs: number;
} {
  const segments: ReplaySegment[] = [];
  let currentMs = 0;
  let state: PuzzleState = {
    pageId: puzzle.initialPageId,
    previousPageId: null,
    fields: { ...puzzle.initialFields },
  };
  let prevKey: string | null = null;

  for (let i = 0; i < puzzle.replay.length; i++) {
    const step = puzzle.replay[i];
    const pageEls = elementsOnPage(puzzle, state.pageId);
    const el = pageEls.find((e) => e.key === step.key);
    const mark = el?.mark ?? -1;
    const { next: nextState } = applyDecision(puzzle, state, {
      pageId: step.pageId,
      mark,
      action: step.action,
      text: step.text,
      stroke: step.stroke,
    });

    // 1. Glide (1,150 ms)
    segments.push({
      startMs: currentMs,
      endMs: currentMs + GLIDE_MS,
      kind: 'glide',
      stepIndex: i,
      key: step.key,
      fromKey: prevKey,
      stateBefore: state,
      stateAfter: state,
    });
    currentMs += GLIDE_MS;

    // 2. Action execution
    if (step.action === 'TIMED_CLICK') {
      const targetCol = (el?.visual?.timedColumn ?? 2) as 0 | 1 | 2;
      const curCol = (Math.floor(currentMs / FLASH_PERIOD_MS) % 3) as 0 | 1 | 2;
      if (curCol !== targetCol) {
        const remInCur = FLASH_PERIOD_MS - (currentMs % FLASH_PERIOD_MS);
        const stepsAhead = (targetCol - curCol + 3) % 3;
        const waitMs = remInCur + (stepsAhead - 1) * FLASH_PERIOD_MS;
        if (waitMs > 0) {
          segments.push({
            startMs: currentMs,
            endMs: currentMs + waitMs,
            kind: 'wait_timed',
            stepIndex: i,
            key: step.key,
            fromKey: step.key,
            stateBefore: state,
            stateAfter: state,
            timedColumn: targetCol,
          });
          currentMs += waitMs;
        }
      }
      segments.push({
        startMs: currentMs,
        endMs: currentMs + CLICK_HOLD_MS,
        kind: 'click',
        stepIndex: i,
        key: step.key,
        fromKey: step.key,
        stateBefore: state,
        stateAfter: nextState,
        timedColumn: targetCol,
      });
      currentMs += CLICK_HOLD_MS;
    } else if (step.action === 'CLICK') {
      segments.push({
        startMs: currentMs,
        endMs: currentMs + CLICK_HOLD_MS,
        kind: 'click',
        stepIndex: i,
        key: step.key,
        fromKey: step.key,
        stateBefore: state,
        stateAfter: nextState,
      });
      currentMs += CLICK_HOLD_MS;
    } else if (step.action === 'TYPE') {
      const text = step.text ?? '';
      const typeDuration = text.length * TYPE_CHAR_MS;
      const textField = el?.effects.TYPE?.find((ef) => ef.op === 'setFromText');
      const fieldName = textField && textField.op === 'setFromText' ? textField.field : 'passengerName';
      const stateWithFullText: PuzzleState = {
        ...state,
        fields: { ...state.fields, [fieldName]: text },
      };
      if (typeDuration > 0) {
        segments.push({
          startMs: currentMs,
          endMs: currentMs + typeDuration,
          kind: 'type',
          stepIndex: i,
          key: step.key,
          fromKey: step.key,
          stateBefore: state,
          stateAfter: stateWithFullText,
          text,
        });
        currentMs += typeDuration;
      }
      segments.push({
        startMs: currentMs,
        endMs: currentMs + TYPE_SETTLE_MS,
        kind: 'type_settle',
        stepIndex: i,
        key: step.key,
        fromKey: step.key,
        stateBefore: stateWithFullText,
        stateAfter: nextState,
        text,
      });
      currentMs += TYPE_SETTLE_MS;
    } else if (step.action === 'DRAW') {
      const drawDuration = DRAW_STEPS * DRAW_STEP_MS;
      segments.push({
        startMs: currentMs,
        endMs: currentMs + drawDuration,
        kind: 'draw',
        stepIndex: i,
        key: step.key,
        fromKey: step.key,
        stateBefore: state,
        stateAfter: nextState,
        stroke: step.stroke,
      });
      currentMs += drawDuration;
      segments.push({
        startMs: currentMs,
        endMs: currentMs + DRAW_SETTLE_MS,
        kind: 'draw_settle',
        stepIndex: i,
        key: step.key,
        fromKey: step.key,
        stateBefore: nextState,
        stateAfter: nextState,
        stroke: step.stroke,
      });
      currentMs += DRAW_SETTLE_MS;
    }

    // 3. Dwell after each navigation (800 ms)
    if (nextState.pageId !== state.pageId) {
      segments.push({
        startMs: currentMs,
        endMs: currentMs + NAV_DWELL_MS,
        kind: 'nav_dwell',
        stepIndex: i,
        key: step.key,
        fromKey: step.key,
        stateBefore: nextState,
        stateAfter: nextState,
      });
      currentMs += NAV_DWELL_MS;
    }

    state = nextState;
    prevKey = step.key;
  }

  // 4. Dwell on the final page (2,000 ms)
  if (puzzle.replay.length > 0) {
    segments.push({
      startMs: currentMs,
      endMs: currentMs + FINAL_DWELL_MS,
      kind: 'final_dwell',
      stepIndex: puzzle.replay.length - 1,
      key: prevKey ?? '',
      fromKey: prevKey,
      stateBefore: state,
      stateAfter: state,
    });
    currentMs += FINAL_DWELL_MS;
  }

  return { segments, totalDurationMs: Math.max(1, currentMs) };
}

/**
 * Generic data-driven looping target replay player.
 * Plays `puzzle.replay` through `applyDecision` using live `[data-el]` centers.
 */
export const LoopedTargetReplay: React.FC<LoopedTargetReplayProps> = ({
  className = '',
  isExpanded = false,
  onToggleExpand,
  autoplay = true,
  puzzle = CASE_001_PUZZLE,
}) => {
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [scale, setScale] = useState<number>(1);
  const [keyCenters, setKeyCenters] = useState<Record<string, Point>>(DEFAULT_KEY_CENTERS);
  const [sigBounds, setSigBounds] = useState<{ start: Point; end: Point }>({
    start: { x: 210, y: 405 },
    end: { x: 810, y: 405 },
  });

  const outerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const { segments, totalDurationMs } = useMemo(() => buildReplayTimeline(puzzle), [puzzle]);

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

  // Advance replay-local clock when autoplay is enabled and not paused
  useEffect(() => {
    if (isPaused || !autoplay) return;
    const interval = setInterval(() => {
      setElapsedMs((prev) => (prev + TICK_MS) % totalDurationMs);
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [isPaused, autoplay, totalDurationMs]);

  const effectiveMs = autoplay ? elapsedMs % totalDurationMs : 0;
  const activeSeg =
    segments.find((s) => effectiveMs >= s.startMs && effectiveMs < s.endMs) ??
    segments[segments.length - 1];

  const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));

  const getKeyPoint = (key: string | null, asDrawEnd = false): Point => {
    if (!key) return DEFAULT_START_POS;
    if (key === 'signature_pad') {
      return asDrawEnd ? sigBounds.end : sigBounds.start;
    }
    return keyCenters[key] ?? DEFAULT_KEY_CENTERS[key] ?? DEFAULT_START_POS;
  };

  let replayState: PuzzleState = {
    pageId: puzzle.initialPageId,
    previousPageId: null,
    fields: { ...puzzle.initialFields },
  };
  let cursorX = DEFAULT_START_POS.x;
  let cursorY = DEFAULT_START_POS.y;
  let isClicking = false;
  let sigProgress = 0;
  let activeFlashColumn: 0 | 1 | 2 = (Math.floor(effectiveMs / FLASH_PERIOD_MS) % 3) as 0 | 1 | 2;

  if (activeSeg) {
    const segDuration = Math.max(1, activeSeg.endMs - activeSeg.startMs);
    const localT = Math.max(0, Math.min(1, (effectiveMs - activeSeg.startMs) / segDuration));
    const fromPt = getKeyPoint(activeSeg.fromKey, activeSeg.fromKey === 'signature_pad');
    const toPt = getKeyPoint(activeSeg.key, false);

    if (activeSeg.kind === 'glide') {
      replayState = activeSeg.stateBefore;
      cursorX = lerp(fromPt.x, toPt.x, localT);
      cursorY = lerp(fromPt.y, toPt.y, localT);
    } else if (activeSeg.kind === 'wait_timed') {
      replayState = activeSeg.stateBefore;
      cursorX = toPt.x;
      cursorY = toPt.y;
    } else if (activeSeg.kind === 'click') {
      replayState = localT >= 0.5 ? activeSeg.stateAfter : activeSeg.stateBefore;
      cursorX = toPt.x;
      cursorY = toPt.y;
      isClicking = true;
      if (activeSeg.timedColumn !== undefined) {
        activeFlashColumn = activeSeg.timedColumn;
      }
    } else if (activeSeg.kind === 'type') {
      const fullText = activeSeg.text ?? '';
      const charsTyped = Math.min(fullText.length, Math.floor((effectiveMs - activeSeg.startMs) / TYPE_CHAR_MS) + 1);
      const pageEls = elementsOnPage(puzzle, activeSeg.stateBefore.pageId);
      const el = pageEls.find((e) => e.key === activeSeg.key);
      const textEffect = el?.effects.TYPE?.find((ef) => ef.op === 'setFromText');
      const fieldName = textEffect && textEffect.op === 'setFromText' ? textEffect.field : 'passengerName';
      replayState = {
        ...activeSeg.stateBefore,
        fields: {
          ...activeSeg.stateBefore.fields,
          [fieldName]: fullText.slice(0, charsTyped),
        },
      };
      cursorX = toPt.x;
      cursorY = toPt.y;
      isClicking = localT < 0.25;
    } else if (activeSeg.kind === 'type_settle') {
      replayState = activeSeg.stateBefore;
      cursorX = toPt.x;
      cursorY = toPt.y;
    } else if (activeSeg.kind === 'draw') {
      replayState = activeSeg.stateBefore;
      const stepIdx = Math.min(DRAW_STEPS, Math.floor((effectiveMs - activeSeg.startMs) / DRAW_STEP_MS) + 1);
      sigProgress = stepIdx / DRAW_STEPS;
      cursorX = lerp(sigBounds.start.x, sigBounds.end.x, localT);
      cursorY = sigBounds.start.y + Math.sin(localT * Math.PI * 4) * 10;
      isClicking = true;
    } else if (activeSeg.kind === 'draw_settle') {
      replayState = activeSeg.stateAfter;
      sigProgress = 1;
      cursorX = sigBounds.end.x;
      cursorY = sigBounds.end.y;
    } else {
      // nav_dwell or final_dwell
      replayState = activeSeg.stateAfter;
      const holdPt = getKeyPoint(activeSeg.key, activeSeg.key === 'signature_pad');
      cursorX = holdPt.x;
      cursorY = holdPt.y;
    }
  }

  if (Boolean(replayState.fields.signatureStroke)) {
    sigProgress = 1;
  }

  // Dynamically measure live [data-el] centers inside the replay's own stage whenever page or scale changes
  useEffect(() => {
    if (!stageRef.current) return;
    const stageRect = stageRef.current.getBoundingClientRect();
    if (stageRect.width <= 0 || stageRect.height <= 0) return;

    const nodes = stageRef.current.querySelectorAll<HTMLElement>('[data-el]');
    const measured: Record<string, Point> = {};
    nodes.forEach((el) => {
      const key = el.getAttribute('data-el');
      if (!key) return;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      measured[key] = {
        x: ((r.left + r.width / 2 - stageRect.left) / stageRect.width) * 1024,
        y: ((r.top + r.height / 2 - stageRect.top) / stageRect.height) * 768,
      };
      if (key === 'signature_pad') {
        const cy = ((r.top + r.height / 2 - stageRect.top) / stageRect.height) * 768;
        setSigBounds({
          start: {
            x: ((r.left + r.width * 0.16 - stageRect.left) / stageRect.width) * 1024,
            y: cy,
          },
          end: {
            x: ((r.left + r.width * 0.84 - stageRect.left) / stageRect.width) * 1024,
            y: cy,
          },
        });
      }
    });

    if (Object.keys(measured).length > 0) {
      setKeyCenters((prev) => ({ ...prev, ...measured }));
    }
  }, [replayState.pageId, scale]);

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
          <Sandbox
            state={replayState}
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
