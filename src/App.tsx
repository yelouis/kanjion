import React, { useReducer, useMemo, useState, useRef, useEffect } from 'react';
import { gameReducer, createInitialGameState, GameAction } from './engine/game_reducer';
import { GameState } from './types/game';
import { resolveLine, decisionToAgentAction } from './engine/agent';
import { calculateEfficiencyMultiplier } from './engine/scoring';
import {
  CASE_001_GENERATED_MANIFEST,
  CASE_001_PUZZLE,
} from './data/puzzles/case_001';
import { elementsOnPage } from './engine/puzzle_engine';
import { waitForColumn, waitForColumnNot } from './engine/flash_clock';
import { GameConfig, productionConfig } from './config/game_config';

import {
  MastheadHeader,
  SandboxStage,
  Sandbox,
  AgentCursor,
  LoopedTargetReplay,
  NewspaperFrontCover,
  DispatchPad,
  ExhibitsPanel,
} from './components';

export type MobileActivePage = 'agent' | 'replay';

export interface AppProps {
  config?: Partial<GameConfig>;
}

const STORAGE_KEY_CASE_001 = 'kanjion:v1:case:001';

function loadPersistedState(storage: Storage | null | undefined): GameState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY_CASE_001);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== 1 || !parsed.game || typeof parsed.game !== 'object') {
      return null;
    }
    const base = createInitialGameState({ caseNumber: '#001' });
    const officialResult = parsed.officialResult ?? parsed.game.officialResult ?? null;
    const mode = parsed.mode === 'practice' ? 'practice' : 'official';
    const restored: GameState = {
      ...base,
      ...parsed.game,
      puzzleState: parsed.game.puzzleState ?? {
        pageId: parsed.game.macroViewId ?? base.puzzleState.pageId,
        previousPageId: null,
        fields: {
          ...base.puzzleState.fields,
          ...(parsed.game.microState ?? {}),
        },
      },
      mode,
      officialResult,
      isExecuting: false,
      stageShake: false,
    };
    restored.macroViewId = restored.puzzleState.pageId;
    restored.microState = restored.puzzleState.fields;
    if (officialResult) {
      restored.caseStatus = 'closed';
      restored.scoreReport = restored.scoreReport ?? officialResult;
    }
    return restored;
  } catch {
    return null;
  }
}

function savePersistedState(storage: Storage | null | undefined, state: GameState): void {
  if (!storage) return;
  try {
    const { isExecuting: _exec, stageShake: _shake, ...gameWithoutEphemeral } = state;
    const payload = {
      v: 1,
      mode: state.mode,
      game: gameWithoutEphemeral,
      officialResult: state.officialResult,
    };
    storage.setItem(STORAGE_KEY_CASE_001, JSON.stringify(payload));
  } catch {
    // Ignore storage errors
  }
}

export const App: React.FC<AppProps> = ({ config }) => {
  const resolvedConfig = useMemo(
    () => ({ ...productionConfig(), ...config }),
    [config]
  );

  // 1. Every game starts on Line 01 with all 6 instruction slots available (or restores persisted state on boot)
  const [state, dispatch] = useReducer(
    (prevState: GameState, action: GameAction) => {
      const next = gameReducer(prevState, action);
      if (
        action.type === 'APPLY_AGENT_ACTION' ||
        action.type === 'CLOSE_CASE' ||
        action.type === 'START_PRACTICE'
      ) {
        savePersistedState(resolvedConfig.storage, next);
      }
      return next;
    },
    undefined,
    () =>
      loadPersistedState(resolvedConfig.storage) ??
      createInitialGameState({
        caseNumber: '#001',
      })
  );

  // 2. Newspaper Fold State, Top-Left Menu Drawer, & Mobile Page Tab
  const [isNewspaperOpen, setIsNewspaperOpen] = useState<boolean>(
    !resolvedConfig.startOnCover
  );
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [mobilePage, setMobilePage] = useState<MobileActivePage>('agent');
  const [isReplayExpanded, setIsReplayExpanded] = useState<boolean>(false);

  // Live pre-commit choreography states so mouse movement, typing, and drawing feel unhurried & player-controlled
  const [previewCursor, setPreviewCursor] = useState<{
    xPercent: number;
    yPercent: number;
    thought: string;
    targetElementId: string | null;
  } | null>(null);
  const [previewTypedText, setPreviewTypedText] = useState<string | null>(null);
  const [previewSignatureProgress, setPreviewSignatureProgress] = useState<number | undefined>(
    undefined
  );
  const [previewSignatureStroke, setPreviewSignatureStroke] = useState<string | undefined>(
    undefined
  );

  // 3. Computed Multiplier for Live Telemetry
  const linesUsed = state.telegrams.filter((t) => t.submitted).length;
  const { multiplier: currentMultiplier } = calculateEfficiencyMultiplier(linesUsed);

  // 4. Smooth Scrolling to Exhibits Panel on Case Closure
  const exhibitsPanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.caseStatus === 'closed') {
      const el = document.getElementById('unsealed-exhibits-panel');
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [state.caseStatus]);

  // Measure center of `[data-el="<key>"]` inside `#sandbox-core` and convert to 1024x768 stage coordinates
  const getTargetCoordinates = (
    targetId?: string,
    targetCoordinate?: { x: number; y: number },
    isNoop: boolean = false
  ): { x: number; y: number; xPercent: number; yPercent: number; targetKey: string } => {
    const pageElements = elementsOnPage(CASE_001_PUZZLE, state.puzzleState.pageId);
    let targetKey = 'page_title';
    if (!isNoop && targetId) {
      const numId = parseInt(targetId.replace(/^#/, ''), 10);
      const matched = pageElements.find((e) => e.mark === numId);
      if (matched) {
        targetKey = matched.key;
      }
    }

    const coreEl = document.getElementById('sandbox-core');
    const domEl = coreEl?.querySelector(`[data-el="${targetKey}"]`) as HTMLElement | null;
    if (coreEl && domEl) {
      const coreRect = coreEl.getBoundingClientRect();
      const elRect = domEl.getBoundingClientRect();
      const stageScale = coreRect.width > 0 ? coreRect.width / 1024 : 1;
      if (stageScale > 0 && elRect.width > 0 && elRect.height > 0) {
        const x = (elRect.left + elRect.width / 2 - coreRect.left) / stageScale;
        const y = (elRect.top + elRect.height / 2 - coreRect.top) / stageScale;
        return {
          x: Math.round(x),
          y: Math.round(y),
          xPercent: Number(((x / 1024) * 100).toFixed(2)),
          yPercent: Number(((y / 768) * 100).toFixed(2)),
          targetKey,
        };
      }
    }

    if (targetCoordinate) {
      return {
        x: targetCoordinate.x,
        y: targetCoordinate.y,
        xPercent: Number(((targetCoordinate.x / 1024) * 100).toFixed(2)),
        yPercent: Number(((targetCoordinate.y / 768) * 100).toFixed(2)),
        targetKey,
      };
    }

    return {
      x: Math.round((state.agentCursor.xPercent / 100) * 1024),
      y: Math.round((state.agentCursor.yPercent / 100) * 768),
      xPercent: state.agentCursor.xPercent,
      yPercent: state.agentCursor.yPercent,
      targetKey,
    };
  };

  // 5. Instruction Dispatch Pipeline (PROMPT-ONLY)
  const handleDispatchLine = async () => {
    if (state.caseStatus === 'closed' || state.isExecuting) return;

    const instruction = state.currentInput.trim();
    if (!instruction) return;

    dispatch({ type: 'START_EXECUTION' });

    try {
      const coreEl = document.getElementById('sandbox-core');
      const visibleText = coreEl?.textContent ?? '';
      const decision = await resolveLine({
        puzzle: CASE_001_PUZZLE,
        manifest: CASE_001_GENERATED_MANIFEST,
        state: state.puzzleState,
        instruction,
        visibleText,
      });
      const action = decisionToAgentAction(
        decision,
        CASE_001_PUZZLE,
        CASE_001_GENERATED_MANIFEST
      );

      // Choreograph the mouse glide + character-by-character typing / signature drawing
      // on the current screen BEFORE committing the page transition so the player feels in direct control!
      const scale = resolvedConfig.animationScale;
      const sleep = (ms: number) =>
        scale === 0
          ? Promise.resolve()
          : new Promise<void>((resolve) =>
              setTimeout(resolve, Math.round(ms * scale))
            );

      const isNoop =
        action.action === 'NOOP' ||
        action.action === 'CONFUSED' ||
        !action.targetId;
      const coords = getTargetCoordinates(action.targetId, action.targetCoordinate, isNoop);

      // Phase 1: Smoothly glide the mouse cursor across the current page to the target element (~1.15s)
      setPreviewCursor({
        xPercent: coords.xPercent,
        yPercent: coords.yPercent,
        thought: action.thought,
        targetElementId: null,
      });
      await sleep(1150);

      // If the resolved element has a timedColumn, wait for (or wait out) the flash column
      const matchedEl = elementsOnPage(CASE_001_PUZZLE, state.macroViewId).find(
        (e) => e.key === coords.targetKey
      );
      const timedCol = matchedEl?.visual?.timedColumn;
      if (scale > 0 && timedCol !== undefined) {
        if (action.action === 'TIMED_CLICK') {
          await waitForColumn(timedCol);
        } else if (action.action === 'CLICK') {
          await waitForColumnNot(timedCol);
        }
      }

      // Lock target highlight ring onto the element
      setPreviewCursor({
        xPercent: coords.xPercent,
        yPercent: coords.yPercent,
        thought: action.thought,
        targetElementId: coords.targetKey,
      });

      // Phase 2: Perform visible typing, signature drawing, NOOP wiggle, or button click hold on the current page
      if (isNoop) {
        const offsets = [-6, 6, 0];
        for (const dx of offsets) {
          const wiggleX = Math.max(0, Math.min(1024, coords.x + dx));
          setPreviewCursor({
            xPercent: Number(((wiggleX / 1024) * 100).toFixed(2)),
            yPercent: coords.yPercent,
            thought: action.thought,
            targetElementId: coords.targetKey,
          });
          await sleep(120);
        }
      } else if (action.action === 'TYPE') {
        const textToType = (action.textValue || 'NAME').toUpperCase();
        for (let i = 1; i <= textToType.length; i++) {
          setPreviewTypedText(textToType.slice(0, i));
          await sleep(220);
        }
        await sleep(650);
      } else if (action.action === 'DRAW') {
        const strokeSpec = action.textValue || 'SHAPE:signature';
        setPreviewSignatureStroke(strokeSpec);
        const steps = 6;
        for (let i = 1; i <= steps; i++) {
          const p = i / steps;
          setPreviewSignatureProgress(p);
          const curveYOffset =
            strokeSpec === 'SHAPE:smile'
              ? Math.sin(p * Math.PI) * 5
              : strokeSpec === 'SHAPE:frown'
              ? -Math.sin(p * Math.PI) * 5
              : Math.sin(p * Math.PI * 2) * 1.5;
          setPreviewCursor({
            xPercent: Number((26 + p * 48).toFixed(1)),
            yPercent: Number((coords.yPercent + curveYOffset).toFixed(1)),
            thought: action.thought,
            targetElementId: null,
          });
          await sleep(180);
        }
        await sleep(500);
      } else {
        await sleep(700);
      }

      setPreviewCursor(null);
      setPreviewTypedText(null);
      setPreviewSignatureProgress(undefined);
      setPreviewSignatureStroke(undefined);

      dispatch({
        type: 'APPLY_AGENT_ACTION',
        payload: {
          action: {
            ...action,
            targetCoordinate: { x: coords.x, y: coords.y },
          },
          instruction,
          puzzle: CASE_001_PUZZLE,
        },
      });

      if (action.isTrap) {
        setTimeout(() => dispatch({ type: 'CLEAR_STAGE_SHAKE' }), 400);
      }
    } catch {
      const noopCoords = getTargetCoordinates(undefined, { x: 512, y: 150 }, true);
      setPreviewCursor(null);
      setPreviewTypedText(null);
      setPreviewSignatureProgress(undefined);
      setPreviewSignatureStroke(undefined);
      dispatch({
        type: 'APPLY_AGENT_ACTION',
        payload: {
          action: {
            action: 'CONFUSED',
            targetCoordinate: { x: noopCoords.x, y: noopCoords.y },
            thought: '📌 FIELD NOTE: System execution error encountered.',
          },
          instruction,
          puzzle: CASE_001_PUZZLE,
        },
      });
    }
  };

  // 6. Prompt-Only Lock: Manual clicks on the webpage are silently ignored
  const handleBlockedManualClick = () => {
    // Intentionally silent: manual clicks on the webpage do not respond or show an error toast
  };

  // 7. Action Handlers
  const handleInputChange = (val: string) => {
    dispatch({ type: 'SET_INPUT', payload: val });
  };

  const handleCloseCase = () => {
    dispatch({ type: 'CLOSE_CASE', payload: { puzzle: CASE_001_PUZZLE } });
  };

  const handleStartPractice = () => {
    dispatch({ type: 'START_PRACTICE' });
    setMenuOpen(false);
  };

  const submittedLines = state.telegrams.filter((t) => t.submitted);
  const lastTargetElementId =
    previewCursor !== null
      ? previewCursor.targetElementId
      : submittedLines.length > 0
      ? submittedLines[submittedLines.length - 1]?.agentAction?.targetId ?? null
      : null;

  const displayedPuzzleState = useMemo(
    () =>
      previewTypedText !== null
        ? {
            ...state.puzzleState,
            fields: { ...state.puzzleState.fields, passengerName: previewTypedText },
          }
        : state.puzzleState,
    [state.puzzleState, previewTypedText]
  );

  const displayedCursorX = previewCursor ? previewCursor.xPercent : state.agentCursor.xPercent;
  const displayedCursorY = previewCursor ? previewCursor.yPercent : state.agentCursor.yPercent;
  const displayedCursorThought = previewCursor ? previewCursor.thought : state.agentCursor.thought;

  return (
    <div className="min-h-screen bg-dossier-bg text-dossier-ink p-2 sm:p-4 md:p-5 antialiased font-mono-clean relative">
      {/* =====================================================================
          1. KRILLION-STYLE TOP-LEFT HAMBURGER MENU BUTTON + SIMPLE DRAWER
         ===================================================================== */}
      <div className="max-w-[1640px] mx-auto mb-3 flex items-center justify-between gap-2 relative z-40">
        <div className="flex items-center gap-2">
          <button
            id="btn-top-left-menu"
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-label="Open Game Menu"
            className="btn-press flex items-center gap-2 px-3 py-1.5 bg-dossier-ink text-dossier-paper border-2 border-dossier-ink shadow-ink font-mono-clean font-black text-xs uppercase hover:bg-neutral-800"
          >
            <span className="text-base leading-none">{menuOpen ? '✕' : '☰'}</span>
            <span>MENU</span>
          </button>
        </div>

        {/* Right Quick Actions: Real Site Link + Fold Back to Front Page */}
        <div className="flex items-center gap-2">
          <a
            id="link-actual-site-top"
            data-testid="real-site-link-header"
            href="https://www.eki-net.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-press px-2.5 py-1 bg-dossier-card border-2 border-dossier-ink shadow-ink-sm text-xs font-bold text-blue-900 hover:bg-amber-50 flex items-center gap-1"
            title="Visit the actual Japanese Shinkansen reservation portal (JR Ekinet)"
          >
            <span>Inspired by eki-net.com ↗</span>
          </a>

          {isNewspaperOpen && (
            <button
              id="btn-fold-front-page"
              type="button"
              onClick={() => setIsNewspaperOpen(false)}
              className="btn-press px-2.5 py-1 bg-dossier-card border-2 border-dossier-ink shadow-ink-sm text-xs font-bold hover:bg-amber-50"
            >
              📰 Front Page
            </button>
          )}
        </div>

        {/* Top-Left Dropdown Menu Panel */}
        {menuOpen && (
          <div
            data-testid="top-left-menu-drawer"
            className="absolute top-full left-0 mt-2 w-72 bg-dossier-paper border-2 border-dossier-ink shadow-ink-lg p-4 space-y-3 z-50 text-xs"
          >
            <div className="flex items-center justify-between border-b-2 border-dossier-ink pb-2">
              <span className="font-black uppercase tracking-wider text-sm">
                漢字音 KANJION
              </span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="px-2 py-0.5 bg-dossier-ink text-dossier-paper font-black"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              {state.officialResult && (
                <button
                  type="button"
                  onClick={() => {
                    setIsNewspaperOpen(true);
                    handleStartPractice();
                  }}
                  className="w-full p-2.5 text-left border-2 border-dossier-ink bg-dossier-accent text-dossier-ink font-black shadow-ink-sm flex items-center justify-between"
                >
                  <span>↺ Practice this case (unscored)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsNewspaperOpen(false);
                  setMenuOpen(false);
                }}
                className="w-full p-2.5 text-left border-2 border-dossier-ink bg-dossier-card text-dossier-ink font-bold hover:bg-stone-100"
              >
                📰 Return to Front Page Cover
              </button>

              <a
                href="https://www.eki-net.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full p-2.5 text-left border-2 border-dossier-ink bg-dossier-card text-blue-900 font-bold hover:bg-stone-100"
              >
                🔗 Inspired by eki-net.com ↗
              </a>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          2. MAIN NEWSPAPER CONTAINER:
             ONLY COVERS THE TWO SCREENS (LEFT = AGENT WEBPAGE, RIGHT = REPLAY)
         ===================================================================== */}
      <main className="max-w-[1640px] mx-auto bg-dossier-paper text-dossier-ink border-2 border-dossier-ink shadow-ink-lg p-3 sm:p-5 transition-all">
        {!isNewspaperOpen ? (
          /* --- INITIAL STATE: FRONT PAGE OF THE NEWSPAPER (Krillion Style) --- */
          <NewspaperFrontCover
            caseNumber={state.caseNumber}
            onOpenNewspaper={() => setIsNewspaperOpen(true)}
            solvedScore={state.officialResult?.finalScore ?? null}
          />
        ) : (
          /* --- UNFOLDED STATE: TWO-PAGE OPEN NEWSPAPER SPREAD (SCREENS ONLY) --- */
          <div className="newspaper-unfold-anim space-y-4">
            {/* Clean Broadsheet Masthead Header */}
            <MastheadHeader
              caseNumber={state.caseNumber}
              caseTitle="KANJION"
              difficultyBadge="🇯🇵 HARD MODE: TOKYO–OSAKA SHINKANSEN"
              caseStatus={state.caseStatus}
              exhibitCount={5}
              mode={state.mode}
              minimalCleanHeader={true}
            />

            {/* ===============================================================
                DEDICATED MOBILE VIEW SWITCHER (< 1024px)
               =============================================================== */}
            <div
              data-testid="mobile-page-switcher"
              className="lg:hidden bg-dossier-card border-2 border-dossier-ink p-1.5 shadow-ink-sm"
            >
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setMobilePage('replay')}
                  className={`py-2 px-2 font-black uppercase border border-dossier-ink transition-colors ${
                    mobilePage === 'replay'
                      ? 'bg-dossier-accent text-dossier-ink shadow-ink-sm'
                      : 'bg-stone-100 text-dossier-muted'
                  }`}
                >
                  🔁 Right Page: Target Video
                </button>
                <button
                  type="button"
                  onClick={() => setMobilePage('agent')}
                  className={`py-2 px-2 font-black uppercase border border-dossier-ink transition-colors ${
                    mobilePage === 'agent'
                      ? 'bg-dossier-ink text-dossier-accent shadow-ink-sm'
                      : 'bg-stone-100 text-dossier-muted'
                  }`}
                >
                  🤖 Left Page: Agent Webpage
                </button>
              </div>
            </div>

            {/* ===============================================================
                OPEN TWO-PAGE NEWSPAPER SPREAD:
                Left Page = Agent Screen ONLY | Right Page = Replay Screen ONLY
               =============================================================== */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-0 relative items-start transition-all duration-300">
              {/* -------------------------------------------------------------
                  LEFT NEWSPAPER PAGE (Default Cols 1-8 to focus on the game):
                  Your Agent's Live Webpage Screen ONLY
                 ------------------------------------------------------------- */}
              <div
                data-testid="newspaper-left-page"
                className={`${
                  isReplayExpanded ? 'lg:col-span-5' : 'lg:col-span-8'
                } lg:pr-5 lg:border-r-4 lg:border-double lg:border-dossier-ink space-y-3 transition-all duration-300 ${
                  mobilePage === 'replay' ? 'hidden lg:block' : 'block'
                }`}
              >
                {/* Left Page Header */}
                <div className="flex flex-wrap items-center justify-between border-b-2 border-dossier-ink pb-1.5 text-xs">
                  <span className="font-black uppercase tracking-wider text-dossier-ink flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 bg-dossier-ink text-dossier-paper">LEFT PAGE</span>
                    <span>YOUR AGENT&apos;S WEBPAGE</span>
                  </span>
                </div>

                {/* Live Sandbox Webpage */}
                <section>
                  <SandboxStage
                    macroViewId={displayedPuzzleState.pageId}
                    microState={displayedPuzzleState}
                    agentCursor={state.agentCursor}
                    stageShake={state.stageShake}
                  >
                    <Sandbox
                      state={displayedPuzzleState}
                      onBlockedManualClick={handleBlockedManualClick}
                      signatureProgress={previewSignatureProgress}
                      signatureStroke={previewSignatureStroke}
                    />

                    <AgentCursor
                      xPercent={displayedCursorX}
                      yPercent={displayedCursorY}
                      targetElementId={lastTargetElementId}
                      thoughtText={displayedCursorThought}
                      variant={state.agentCursor.variant}
                      isTrap={state.agentCursor.variant === 'trap'}
                      isShaking={state.agentCursor.isShaking}
                    />
                  </SandboxStage>
                </section>
              </div>

              {/* -------------------------------------------------------------
                  RIGHT NEWSPAPER PAGE (Default Compact Cols 9-12; Click to Expand):
                  Target Replay Screen ONLY
                 ------------------------------------------------------------- */}
              <div
                data-testid="newspaper-right-page"
                className={`${
                  isReplayExpanded ? 'lg:col-span-7' : 'lg:col-span-4'
                } lg:pl-5 space-y-3 transition-all duration-300 ${
                  mobilePage === 'agent' ? 'hidden lg:block' : 'block'
                }`}
              >
                {/* Right Page Header */}
                <div className="flex flex-wrap items-center justify-between border-b-2 border-dossier-ink pb-1.5 text-xs">
                  <span className="font-black uppercase tracking-wider text-dossier-ink flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 bg-dossier-accent text-dossier-ink border border-dossier-ink">
                      RIGHT PAGE
                    </span>
                    <span>TARGET REPLAY (CLICK TO {isReplayExpanded ? 'SHRINK' : 'EXPAND'})</span>
                  </span>
                </div>

                {/* Continuous Looped Target Video (1:1 Unredacted Copy of the Site) */}
                <section>
                  <LoopedTargetReplay
                    isExpanded={isReplayExpanded}
                    onToggleExpand={() => setIsReplayExpanded((prev) => !prev)}
                    autoplay={resolvedConfig.replayAutoplay}
                  />
                </section>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* =====================================================================
          3. CENTERED BOTTOM COMMAND DOCK (OUTSIDE THE NEWSPAPER PAGES):
             6-Line Instruction Pad (Exact 60-Char Fit) + Unsealed Exhibits
         ===================================================================== */}
      {isNewspaperOpen && (
        <div
          data-testid="bottom-dispatch-dock"
          className="max-w-5xl mx-auto mt-6 space-y-5"
        >
          <DispatchPad
            telegrams={state.telegrams}
            activeLineIndex={state.activeLineIndex}
            currentInput={state.currentInput}
            onInputChange={handleInputChange}
            onSubmitLine={handleDispatchLine}
            onCloseCase={handleCloseCase}
            caseStatus={state.caseStatus}
            currentMultiplier={currentMultiplier}
            isSubmitting={state.isExecuting}
          />

          <section ref={exhibitsPanelRef}>
            <ExhibitsPanel
              caseClosed={state.caseStatus === 'closed'}
              scoreReport={state.scoreReport}
              officialResult={state.officialResult}
              mode={state.mode}
              caseNumber={state.caseNumber}
              answerKey={CASE_001_PUZZLE.answerKey}
              onStartPractice={handleStartPractice}
            />
          </section>
        </div>
      )}
    </div>
  );
};

export default App;
