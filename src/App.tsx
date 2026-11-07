import React, { useReducer, useMemo, useState, useRef, useEffect } from 'react';
import { gameReducer, createInitialGameState } from './engine/game_reducer';
import { OfflineSimulationEngine } from './engine/offline_simulator';
import {
  CloudVisionConnector,
  BrowserGeminiNanoTransport,
  MockVisionLLMTransport,
} from './engine/cloud_connector';
import { calculateEfficiencyMultiplier } from './engine/scoring';
import {
  CASE_042_MACRO_VIEWS,
  CASE_042_EXHIBITS,
  CASE_042_GHOST_REPLAY,
  CASE_042_INITIAL_MICRO_STATE,
} from './data/puzzles/case_042';

import {
  MastheadHeader,
  SandboxStage,
  ShinkansenSandbox,
  AgentCursor,
  GhostReplay,
  LoopedTargetReplay,
  NewspaperFrontCover,
  DispatchPad,
  ExhibitsPanel,
} from './components';

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
  const browserInitialMicroState =
    process.env.NODE_ENV === 'test'
      ? undefined
      : {
          ...CASE_042_INITIAL_MICRO_STATE,
          macroViewId: 'MV-01',
          selectedRoute: 'none' as const,
          departureTime: 'none' as const,
          passengerName: '',
          signatureSigned: false,
        };

  // 1. Every game starts on Line 01 (preSeeded: false) with all 6 instruction slots available!
  const [state, dispatch] = useReducer(
    gameReducer,
    undefined,
    () =>
      createInitialGameState({
        caseNumber: '#042',
        preSeeded: false,
        initialMicroState: browserInitialMicroState,
      })
  );

  // 2. Newspaper Fold State, Top-Left Menu Drawer, & Mobile Page Tab
  // In production/browser gameplay, rely directly on gemini-2.5-flash-lite ('cloud' mode).
  const [isNewspaperOpen, setIsNewspaperOpen] = useState<boolean>(initialNewspaperOpen);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [engineMode, setEngineMode] = useState<'offline' | 'cloud'>(
    process.env.NODE_ENV === 'test' ? 'offline' : 'cloud'
  );
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
        : new BrowserGeminiNanoTransport();
    return new CloudVisionConnector({
      puzzleId: 'case_042',
      macroViews: CASE_042_MACRO_VIEWS,
      transport,
      fallbackEngine: offlineEngine,
    });
  }, [offlineEngine]);

  const activeEngine = engineMode === 'offline' ? offlineEngine : cloudEngine;

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

  const handleResetDailyPuzzle = () => {
    dispatch({
      type: 'RESET_GAME',
      payload: {
        caseNumber: '#042',
        preSeeded: false,
        initialMicroState: browserInitialMicroState,
      },
    });
    setMenuOpen(false);
  };

  const stepHistory = state.microState.stepHistory || [];
  const lastTargetElementId =
    stepHistory.length > 0 ? stepHistory[stepHistory.length - 1]?.targetId ?? null : null;

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

        {/* Right Quick Action: Fold Back to Front Page */}
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
              <button
                type="button"
                onClick={() => {
                  setIsNewspaperOpen(true);
                  handleResetDailyPuzzle();
                }}
                className="w-full p-2.5 text-left border-2 border-dossier-ink bg-dossier-accent text-dossier-ink font-black shadow-ink-sm flex items-center justify-between"
              >
                <span>📅 Daily Puzzle #042 (Restart)</span>
                <span>↺</span>
              </button>

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
          />
        ) : (
          /* --- UNFOLDED STATE: TWO-PAGE OPEN NEWSPAPER SPREAD (SCREENS ONLY) --- */
          <div className="newspaper-unfold-anim space-y-4">
            {/* Clean Broadsheet Masthead Header */}
            <MastheadHeader
              caseNumber={state.caseNumber}
              caseTitle="KANJION"
              difficultyBadge="🇯🇵 HARD MODE: TOKYO–OSAKA SHINKANSEN"
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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-0 relative items-start">
              {/* -------------------------------------------------------------
                  LEFT NEWSPAPER PAGE (Cols 1-6):
                  Your Agent's Live Webpage Screen ONLY
                 ------------------------------------------------------------- */}
              <div
                data-testid="newspaper-left-page"
                className={`lg:col-span-6 lg:pr-5 lg:border-r-4 lg:border-double lg:border-dossier-ink space-y-3 ${
                  mobilePage === 'replay' ? 'hidden lg:block' : 'block'
                }`}
              >
                {/* Left Page Header */}
                <div className="flex flex-wrap items-center justify-between border-b-2 border-dossier-ink pb-1.5 text-xs">
                  <span className="font-black uppercase tracking-wider text-dossier-ink flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 bg-dossier-ink text-dossier-paper">LEFT PAGE</span>
                    <span>YOUR AGENT&apos;S WEBPAGE</span>
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
                      🔒 Manual clicking on the webpage is disabled! Type an English instruction in
                      the centered command pad below to move your agent.
                    </span>
                  </div>
                )}

                {/* Live Sandbox Webpage */}
                <section>
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
                      multiPageMode={process.env.NODE_ENV !== 'test'}
                    />

                    <GhostReplay
                      active={state.ghostReplayActive}
                      onToggle={handleToggleGhost}
                      trajectory={CASE_042_GHOST_REPLAY}
                    />

                    <AgentCursor
                      xPercent={state.agentCursor.xPercent}
                      yPercent={state.agentCursor.yPercent}
                      targetElementId={lastTargetElementId}
                      thoughtText={state.agentCursor.thought}
                      variant={state.agentCursor.variant}
                      isTrap={state.agentCursor.variant === 'trap'}
                      isShaking={state.agentCursor.isShaking}
                    />
                  </SandboxStage>
                </section>
              </div>

              {/* -------------------------------------------------------------
                  RIGHT NEWSPAPER PAGE (Cols 7-12):
                  Target Replay Screen ONLY
                 ------------------------------------------------------------- */}
              <div
                data-testid="newspaper-right-page"
                className={`lg:col-span-6 lg:pl-5 space-y-3 ${
                  mobilePage === 'agent' ? 'hidden lg:block' : 'block'
                }`}
              >
                {/* Right Page Header */}
                <div className="flex flex-wrap items-center justify-between border-b-2 border-dossier-ink pb-1.5 text-xs">
                  <span className="font-black uppercase tracking-wider text-dossier-ink flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 bg-dossier-accent text-dossier-ink border border-dossier-ink">
                      RIGHT PAGE
                    </span>
                    <span>TARGET REPLAY (COPY THIS)</span>
                  </span>
                </div>

                {/* Continuous Looped Target Video (1:1 Unredacted Copy of the Site) */}
                <section>
                  <LoopedTargetReplay />
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
              onReopenCase={handleReopenCase}
            />
          </section>
        </div>
      )}
    </div>
  );
};

export default App;
