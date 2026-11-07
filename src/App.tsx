import React, { useReducer, useMemo, useState, useRef, useEffect } from 'react';
import { gameReducer, createInitialGameState } from './engine/game_reducer';
import { OfflineSimulationEngine } from './engine/offline_simulator';
import {
  CloudVisionConnector,
  HttpVisionLLMTransport,
  MockVisionLLMTransport,
} from './engine/cloud_connector';
import { calculateEfficiencyMultiplier } from './engine/scoring';
import {
  CASE_042_MACRO_VIEWS,
  CASE_042_EXHIBITS,
  CASE_042_GHOST_REPLAY,
} from './data/puzzles/case_042';

import {
  MastheadHeader,
  CoordinateRulers,
  SandboxStage,
  ShinkansenSandbox,
  AgentCursor,
  GhostReplay,
  LoopedTargetReplay,
  NewspaperFrontCover,
  DispatchPad,
  ExhibitsPanel,
} from './components';

export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type PlayPresetMode = 'daily' | 'fresh';
export type MobileActivePage = 'agent' | 'replay';

export interface AppProps {
  /**
   * Optional override for whether the newspaper starts unfolded.
   * Defaults to false in browser (starts on Newspaper Front Cover) and true in unit tests.
   */
  initialNewspaperOpen?: boolean;
}

export const App: React.FC<AppProps> = ({
  initialNewspaperOpen = process.env.NODE_ENV === 'test',
}) => {
  // 1. Centralized Immutable Game State (Default = Daily Puzzle #042)
  const [state, dispatch] = useReducer(
    gameReducer,
    undefined,
    () => createInitialGameState({ caseNumber: '#042', preSeeded: true })
  );

  // 2. Newspaper Fold State, Top-Left Menu Drawer, Difficulty, Mode, & Mobile Page Tab
  const [isNewspaperOpen, setIsNewspaperOpen] = useState<boolean>(initialNewspaperOpen);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('hard');
  const [playMode, setPlayMode] = useState<PlayPresetMode>('daily');
  const [engineMode, setEngineMode] = useState<'offline' | 'cloud'>('offline');
  const [mobilePage, setMobilePage] = useState<MobileActivePage>('agent');
  const [manualClickWarning, setManualClickWarning] = useState<boolean>(false);

  const offlineEngine = useMemo(
    () => new OfflineSimulationEngine(CASE_042_MACRO_VIEWS),
    []
  );

  const cloudEngine = useMemo(() => {
    const transport =
      process.env.NODE_ENV === 'test'
        ? new MockVisionLLMTransport()
        : new HttpVisionLLMTransport({
            endpointUrl: '/api/decision',
            maxRetries: 0,
            timeoutMs: 6000,
          });
    return new CloudVisionConnector({
      puzzleId: 'case_042',
      macroViews: CASE_042_MACRO_VIEWS,
      transport,
      fallbackEngine: offlineEngine,
    });
  }, [offlineEngine]);

  const activeEngine = engineMode === 'offline' ? offlineEngine : cloudEngine;

  // Difficulty Badge Label
  const difficultyBadge = useMemo(() => {
    if (difficulty === 'easy') return '🟢 EASY MODE: ENGLISH FIELD HINTS ENABLED';
    if (difficulty === 'medium') return '🟡 MEDIUM MODE: VISUAL CLUES & GRID';
    return '🇯🇵 HARD MODE: TOKYO–OSAKA SHINKANSEN';
  }, [difficulty]);

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

  // 5. Instruction Dispatch Pipeline (PROMPT-ONLY)
  const handleDispatchLine = async () => {
    if (state.caseStatus === 'closed' || state.isExecuting) return;

    const instruction = state.currentInput.trim();
    if (!instruction) return;

    dispatch({ type: 'START_EXECUTION' });

    try {
      const action = await activeEngine.resolveInstruction(
        state.macroViewId,
        state.microState,
        instruction
      );

      const latency = process.env.NODE_ENV === 'test' ? 0 : 350;
      if (latency > 0) {
        await new Promise((resolve) => setTimeout(resolve, latency));
      }

      dispatch({
        type: 'APPLY_AGENT_ACTION',
        payload: {
          action,
          instruction,
          exhibits: CASE_042_EXHIBITS,
        },
      });

      if (action.isTrap) {
        setTimeout(() => dispatch({ type: 'CLEAR_STAGE_SHAKE' }), 400);
      }
    } catch {
      dispatch({
        type: 'APPLY_AGENT_ACTION',
        payload: {
          action: {
            action: 'CONFUSED',
            thought: '📌 FIELD NOTE: System execution error encountered.',
          },
          instruction,
          exhibits: CASE_042_EXHIBITS,
        },
      });
    }
  };

  // 6. Prompt-Only Lock: Manual clicks on the webpage are strictly blocked!
  const handleBlockedManualClick = () => {
    setManualClickWarning(true);
    setTimeout(() => setManualClickWarning(false), 2200);
  };

  // 7. Action Handlers
  const handleInputChange = (val: string) => {
    dispatch({ type: 'SET_INPUT', payload: val });
  };

  const handleCloseCase = () => {
    dispatch({ type: 'CLOSE_CASE', payload: { exhibits: CASE_042_EXHIBITS } });
  };

  const handleReopenCase = () => {
    dispatch({ type: 'REOPEN_CASE' });
  };

  const handleToggleGhost = () => {
    dispatch({ type: 'TOGGLE_GHOST_REPLAY' });
  };

  const handleToggleSoM = () => {
    dispatch({ type: 'TOGGLE_SOM_OVERLAY' });
  };

  const handleSelectPlayMode = (mode: PlayPresetMode) => {
    setPlayMode(mode);
    dispatch({
      type: 'RESET_GAME',
      payload: { caseNumber: '#042', preSeeded: mode === 'daily' },
    });
  };

  return (
    <div className="min-h-screen bg-dossier-bg text-dossier-ink p-2 sm:p-4 md:p-5 antialiased font-mono-clean relative">
      {/* =====================================================================
          1. KRILLION-STYLE TOP-LEFT HAMBURGER MENU BUTTON + POPOVER DRAWER
         ===================================================================== */}
      <div className="max-w-[1640px] mx-auto mb-3 flex items-center justify-between gap-2 relative z-40">
        <div className="flex items-center gap-2">
          <button
            id="btn-top-left-menu"
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-label="Open Game Menu (Mode & Difficulty)"
            className="btn-press flex items-center gap-2 px-3 py-1.5 bg-dossier-ink text-dossier-paper border-2 border-dossier-ink shadow-ink font-mono-clean font-black text-xs uppercase hover:bg-neutral-800"
          >
            <span className="text-base leading-none">{menuOpen ? '✕' : '☰'}</span>
            <span>MENU</span>
          </button>

          {/* Compact Current Mode & Difficulty Pill */}
          <span className="hidden sm:inline-flex items-center gap-2 px-2.5 py-1 bg-dossier-card border border-dossier-ink text-[11px] font-bold text-dossier-ink">
            <span>{playMode === 'daily' ? '📅 Daily Puzzle #042' : '✨ Full 6-Line Run'}</span>
            <span>•</span>
            <span>
              {difficulty === 'easy'
                ? '🟢 Easy'
                : difficulty === 'medium'
                ? '🟡 Medium'
                : '🔴 Hard (🇯🇵)'}
            </span>
          </span>
        </div>

        {/* Right Quick Action: Fold / Unfold Newspaper Cover */}
        {isNewspaperOpen && (
          <button
            id="btn-fold-front-page"
            type="button"
            onClick={() => setIsNewspaperOpen(false)}
            className="btn-press px-2.5 py-1 bg-dossier-card border-2 border-dossier-ink shadow-ink-sm text-xs font-bold hover:bg-amber-50"
          >
            📰 Front Page Cover
          </button>
        )}

        {/* Top-Left Dropdown Menu Panel */}
        {menuOpen && (
          <div
            data-testid="top-left-menu-drawer"
            className="absolute top-full left-0 mt-2 w-80 sm:w-96 bg-dossier-paper border-2 border-dossier-ink shadow-ink-lg p-4 space-y-4 z-50 text-xs"
          >
            <div className="flex items-center justify-between border-b-2 border-dossier-ink pb-2">
              <span className="font-black uppercase tracking-wider text-sm">
                漢字音 KANJION • GAME MENU
              </span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="px-2 py-0.5 bg-dossier-ink text-dossier-paper font-black"
              >
                ✕
              </button>
            </div>

            {/* A. Puzzle Mode Selector (Default = Daily Puzzle) */}
            <div className="space-y-1.5">
              <div className="font-black uppercase text-dossier-muted tracking-wider">
                1. SELECT GAME MODE
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    handleSelectPlayMode('daily');
                    setMenuOpen(false);
                  }}
                  className={`p-2 text-left border-2 font-bold flex items-center justify-between ${
                    playMode === 'daily'
                      ? 'bg-dossier-accent text-dossier-ink border-dossier-ink font-black shadow-ink-sm'
                      : 'bg-dossier-card text-dossier-ink border-stone-400 hover:bg-stone-100'
                  }`}
                >
                  <span>📅 Daily Puzzle #042 (Default)</span>
                  {playMode === 'daily' && <span>✓ ACTIVE</span>}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleSelectPlayMode('fresh');
                    setMenuOpen(false);
                  }}
                  className={`p-2 text-left border-2 font-bold flex items-center justify-between ${
                    playMode === 'fresh'
                      ? 'bg-dossier-accent text-dossier-ink border-dossier-ink font-black shadow-ink-sm'
                      : 'bg-dossier-card text-dossier-ink border-stone-400 hover:bg-stone-100'
                  }`}
                >
                  <span>✨ Full 6-Line Run (Start at Line 01)</span>
                  {playMode === 'fresh' && <span>✓ ACTIVE</span>}
                </button>
              </div>
            </div>

            {/* B. Difficulty Selector */}
            <div className="space-y-1.5">
              <div className="font-black uppercase text-dossier-muted tracking-wider">
                2. SELECT DIFFICULTY
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setDifficulty('easy');
                    setMenuOpen(false);
                  }}
                  className={`p-2 text-left border-2 font-bold flex items-center justify-between ${
                    difficulty === 'easy'
                      ? 'bg-emerald-200 text-dossier-ink border-dossier-ink font-black shadow-ink-sm'
                      : 'bg-dossier-card text-dossier-ink border-stone-400 hover:bg-stone-100'
                  }`}
                >
                  <span>🟢 Easy (English Translation Hints)</span>
                  {difficulty === 'easy' && <span>✓</span>}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDifficulty('medium');
                    setMenuOpen(false);
                  }}
                  className={`p-2 text-left border-2 font-bold flex items-center justify-between ${
                    difficulty === 'medium'
                      ? 'bg-amber-200 text-dossier-ink border-dossier-ink font-black shadow-ink-sm'
                      : 'bg-dossier-card text-dossier-ink border-stone-400 hover:bg-stone-100'
                  }`}
                >
                  <span>🟡 Medium (Grid Coordinate Clues)</span>
                  {difficulty === 'medium' && <span>✓</span>}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDifficulty('hard');
                    setMenuOpen(false);
                  }}
                  className={`p-2 text-left border-2 font-bold flex items-center justify-between ${
                    difficulty === 'hard'
                      ? 'bg-red-200 text-dossier-ink border-dossier-ink font-black shadow-ink-sm'
                      : 'bg-dossier-card text-dossier-ink border-stone-400 hover:bg-stone-100'
                  }`}
                >
                  <span>🔴 Hard (🇯🇵 Raw Japanese Portal)</span>
                  {difficulty === 'hard' && <span>✓</span>}
                </button>
              </div>
            </div>

            {/* C. AI Engine Selector */}
            <div className="space-y-1.5 pt-1 border-t border-stone-300">
              <div className="font-black uppercase text-dossier-muted tracking-wider">
                3. AI EXECUTION ENGINE
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setEngineMode('offline')}
                  className={`p-1.5 border font-bold ${
                    engineMode === 'offline'
                      ? 'bg-dossier-ink text-dossier-accent border-dossier-ink font-black'
                      : 'bg-dossier-card border-stone-400'
                  }`}
                >
                  ⚡ Offline Sim
                </button>
                <button
                  type="button"
                  onClick={() => setEngineMode('cloud')}
                  className={`p-1.5 border font-bold ${
                    engineMode === 'cloud'
                      ? 'bg-dossier-ink text-dossier-accent border-dossier-ink font-black'
                      : 'bg-dossier-card border-stone-400'
                  }`}
                >
                  🧠 Cloud LLM
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          2. MAIN NEWSPAPER CONTAINER: FRONT COVER vs UNFOLDED TWO-PAGE SPREAD
         ===================================================================== */}
      <main className="max-w-[1640px] mx-auto bg-dossier-paper text-dossier-ink border-2 border-dossier-ink shadow-ink-lg p-3 sm:p-5 transition-all">
        {!isNewspaperOpen ? (
          /* --- INITIAL STATE: FRONT PAGE OF THE NEWSPAPER (Krillion Style) --- */
          <NewspaperFrontCover
            caseNumber={state.caseNumber}
            difficulty={difficulty}
            playMode={playMode}
            onSelectDifficulty={setDifficulty}
            onSelectPlayMode={handleSelectPlayMode}
            onOpenNewspaper={() => setIsNewspaperOpen(true)}
          />
        ) : (
          /* --- UNFOLDED STATE: TWO-PAGE OPEN NEWSPAPER SPREAD (Desktop) & FLIP-PAD (Mobile) --- */
          <div className="newspaper-unfold-anim space-y-4">
            {/* Broadsheet Masthead Header */}
            <MastheadHeader
              caseNumber={state.caseNumber}
              caseTitle="KANJION"
              difficultyBadge={difficultyBadge}
              ghostReplayActive={state.ghostReplayActive}
              onToggleGhostReplay={handleToggleGhost}
              somOverlayActive={state.somOverlayActive}
              onToggleSomOverlay={handleToggleSoM}
              caseStatus={state.caseStatus}
              exhibitCount={5}
              backendMode={engineMode}
              onToggleBackendMode={() =>
                setEngineMode(engineMode === 'offline' ? 'cloud' : 'offline')
              }
            />

            {/* Contextual Difficulty Helper Banner (Easy / Medium Modes) */}
            {difficulty === 'easy' && (
              <div className="bg-emerald-950 text-emerald-100 border-2 border-dossier-ink px-3.5 py-2 text-xs shadow-ink-sm">
                <strong>🟢 EASY MODE TRANSLATION GUIDE:</strong> Watch the right page: first click
                is the <strong>Green Clover 🍀 button in the 2nd train row (Col D, Row 3)</strong>,
                second click is the <strong>Blue Confirm button (Col D, Row 4)</strong>. Avoid the
                red ¥2,400 trap banner!
              </div>
            )}
            {difficulty === 'medium' && (
              <div className="bg-amber-950 text-amber-100 border-2 border-dossier-ink px-3.5 py-2 text-xs shadow-ink-sm">
                <strong>🟡 MEDIUM MODE CLUE:</strong> Compare the coordinates on the right-page
                video loop (<code>COL D, ROW 3</code> → <code>COL D, ROW 4</code>) and instruct your
                agent on the left page using English descriptions.
              </div>
            )}

            {/* ===============================================================
                DEDICATED MOBILE VIEW SWITCHER (< 1024px)
                Allows thumb-switching between the Left Page (Agent + Prompts)
                and Right Page (Looped Target Video) without cramping!
               =============================================================== */}
            <div
              data-testid="mobile-page-switcher"
              className="lg:hidden bg-dossier-card border-2 border-dossier-ink p-1.5 shadow-ink-sm space-y-1.5"
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
                  🤖 Left Page: Agent &amp; Pad
                </button>
              </div>

              {/* Compact Picture-in-Picture Target Reminder when on Mobile Agent Tab */}
              {mobilePage === 'agent' && (
                <div className="bg-stone-900 text-amber-300 px-2.5 py-1.5 text-[11px] flex items-center justify-between gap-2">
                  <span>
                    <strong>🎯 Target Loop:</strong> Click 1 = Green 🍀 (D3) → Click 2 = Blue ▶ (D4)
                  </span>
                  <button
                    type="button"
                    onClick={() => setMobilePage('replay')}
                    className="px-2 py-0.5 bg-dossier-accent text-dossier-ink font-black uppercase shrink-0"
                  >
                    👁️ Watch Loop
                  </button>
                </div>
              )}
            </div>

            {/* ===============================================================
                OPEN TWO-PAGE NEWSPAPER SPREAD (Desktop Side-by-Side / Mobile Tabbed)
               =============================================================== */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-0 relative items-start">
              {/* -------------------------------------------------------------
                  LEFT NEWSPAPER PAGE (Cols 1-6):
                  Live Webpage (Prompt-Only, Manual Clicks Disabled) + Dispatch Pad
                 ------------------------------------------------------------- */}
              <div
                data-testid="newspaper-left-page"
                className={`lg:col-span-6 lg:pr-5 lg:border-r-4 lg:border-double lg:border-dossier-ink space-y-4 ${
                  mobilePage === 'replay' ? 'hidden lg:block' : 'block'
                }`}
              >
                {/* Left Page Folio Header */}
                <div className="flex flex-wrap items-center justify-between border-b-2 border-dossier-ink pb-1.5 text-xs">
                  <span className="font-black uppercase tracking-wider text-dossier-ink flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 bg-dossier-ink text-dossier-paper">PAGE 01</span>
                    <span>YOUR AGENT&apos;S LIVE WEBPAGE</span>
                  </span>
                  <span className="text-red-800 font-black text-[11px] uppercase">
                    🔒 PROMPT-ONLY (MANUAL CLICKS DISABLED)
                  </span>
                </div>

                {/* Prompt-Only Click Warning Toast */}
                {manualClickWarning && (
                  <div
                    role="status"
                    data-testid="manual-click-warning"
                    className="bg-red-800 text-white border-2 border-dossier-ink px-3 py-1.5 text-xs font-bold shadow-ink-sm flex items-center justify-between"
                  >
                    <span>
                      🔒 Manual clicking on the webpage is disabled! Type an English prompt in the
                      Dispatch Pad below to command your AI agent.
                    </span>
                  </div>
                )}

                {/* Live Sandbox Webpage (Manual Clicks Disabled: onElementClick is omitted!) */}
                <section>
                  <CoordinateRulers>
                    <SandboxStage
                      macroViewId={state.macroViewId}
                      microState={state.microState}
                      agentCursor={state.agentCursor}
                      ghostReplayActive={state.ghostReplayActive}
                      somOverlayActive={state.somOverlayActive}
                      stageShake={state.stageShake}
                    >
                      <ShinkansenSandbox
                        microState={state.microState}
                        somOverlayActive={state.somOverlayActive}
                        onBlockedManualClick={handleBlockedManualClick}
                      />

                      <GhostReplay
                        active={state.ghostReplayActive}
                        onToggle={handleToggleGhost}
                        trajectory={CASE_042_GHOST_REPLAY}
                      />

                      <AgentCursor
                        xPercent={state.agentCursor.xPercent}
                        yPercent={state.agentCursor.yPercent}
                        thoughtText={state.agentCursor.thought}
                        variant={state.agentCursor.variant}
                        isTrap={state.agentCursor.variant === 'trap'}
                        isShaking={state.agentCursor.isShaking}
                      />
                    </SandboxStage>
                  </CoordinateRulers>
                </section>

                {/* 6-Line Telegram Dispatch Pad directly beneath Left Page Webpage */}
                <section>
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
                </section>
              </div>

              {/* -------------------------------------------------------------
                  RIGHT NEWSPAPER PAGE (Cols 7-12):
                  Continuous Looped Target Replay Video + 5 Sealed/Unsealed Exhibits
                 ------------------------------------------------------------- */}
              <div
                data-testid="newspaper-right-page"
                className={`lg:col-span-6 lg:pl-5 space-y-4 ${
                  mobilePage === 'agent' ? 'hidden lg:block' : 'block'
                }`}
              >
                {/* Right Page Folio Header */}
                <div className="flex flex-wrap items-center justify-between border-b-2 border-dossier-ink pb-1.5 text-xs">
                  <span className="font-black uppercase tracking-wider text-dossier-ink flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 bg-dossier-accent text-dossier-ink border border-dossier-ink">
                      PAGE 02
                    </span>
                    <span>TARGET REPLAY LOOP (COPY THIS)</span>
                  </span>
                  <span className="text-dossier-muted font-bold text-[11px] uppercase">
                    CONTINUOUS LOOP • 2 TARGET CLICKS
                  </span>
                </div>

                {/* Continuous Looped Target Video */}
                <section>
                  <LoopedTargetReplay />
                </section>

                {/* Mobile Quick Jump Back to Prompt Pad */}
                <div className="lg:hidden">
                  <button
                    type="button"
                    onClick={() => setMobilePage('agent')}
                    className="btn-press w-full py-2.5 bg-dossier-ink text-dossier-accent border-2 border-dossier-ink font-black uppercase text-xs shadow-ink"
                  >
                    👈 Flip to Left Page: Type Your English Prompt ⏎
                  </button>
                </div>

                {/* 5 Required Exhibits Panel (Sealed until Case Closed, then Unsealed on Right Page) */}
                <section ref={exhibitsPanelRef}>
                  <ExhibitsPanel
                    caseClosed={state.caseStatus === 'closed'}
                    scoreReport={state.scoreReport}
                    onReopenCase={handleReopenCase}
                  />
                </section>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
