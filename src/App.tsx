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
  CASE_042_MV03_ELEMENTS,
  CASE_042_GHOST_REPLAY,
} from './data/puzzles/case_042';
import type { AgentAction } from './types/engine';

import {
  DossierLayout,
  MastheadHeader,
  CoordinateRulers,
  SandboxStage,
  ShinkansenSandbox,
  AgentCursor,
  GhostReplay,
  DispatchPad,
  ExhibitsPanel,
} from './components';

export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type PlayPresetMode = 'daily' | 'fresh';

export const App: React.FC = () => {
  // 1. Centralized Immutable Game State
  const [state, dispatch] = useReducer(
    gameReducer,
    undefined,
    () => createInitialGameState({ caseNumber: '#042', preSeeded: true })
  );

  // 2. Menu Controls: Difficulty, Play Mode, AI Engine, & Dev Tools Drawer
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('hard');
  const [playMode, setPlayMode] = useState<PlayPresetMode>('daily');
  const [engineMode, setEngineMode] = useState<'offline' | 'cloud'>('offline');
  const [showDevTools, setShowDevTools] = useState<boolean>(false);

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
            maxRetries: 0, // Never retry-storm the cloud endpoint; fall back immediately to offline engine
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

  // 5. Instruction Dispatch Pipeline
  const handleDispatchLine = async () => {
    if (state.caseStatus === 'closed' || state.isExecuting) return;

    const instruction = state.currentInput.trim();
    if (!instruction) return;

    // A. Start execution lock
    dispatch({ type: 'START_EXECUTION' });

    try {
      // B. Resolve instruction against micro-state
      const action = await activeEngine.resolveInstruction(
        state.macroViewId,
        state.microState,
        instruction
      );

      // C. Simulated Agent Latency for smooth kinematic glide
      const latency = process.env.NODE_ENV === 'test' ? 0 : 350;
      if (latency > 0) {
        await new Promise((resolve) => setTimeout(resolve, latency));
      }

      // D. Apply action to reducer
      dispatch({
        type: 'APPLY_AGENT_ACTION',
        payload: {
          action,
          instruction,
          exhibits: CASE_042_EXHIBITS,
        },
      });

      // E. Auto-clear stage shake error animation after 400ms
      if (action.isTrap) {
        setTimeout(() => dispatch({ type: 'CLEAR_STAGE_SHAKE' }), 400);
      }
    } catch {
      // Fallback confused action on unhandled connector failure
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

  // 6. Direct Sandbox Element Click (Practice / Exploration Mode)
  const handleElementClick = async (elementId: number | string) => {
    if (state.caseStatus === 'closed' || state.isExecuting) return;

    const numId = typeof elementId === 'string'
      ? parseInt(elementId.replace(/\D/g, ''), 10)
      : elementId;
    const somEl = CASE_042_MV03_ELEMENTS.find((e) => e.id === numId);
    if (!somEl) return;

    const action: AgentAction = {
      action: 'CLICK',
      targetId: somEl.somId,
      gridRef: somEl.gridRef,
      targetCoordinate: {
        x: somEl.boundingBox.x + somEl.boundingBox.width / 2,
        y: somEl.boundingBox.y + somEl.boundingBox.height / 2,
      },
      thought: `Field click on ${somEl.text}`,
      isTrap: somEl.isTrap,
    };

    dispatch({
      type: 'APPLY_AGENT_ACTION',
      payload: {
        action,
        instruction: `Manual click ${somEl.somId}`,
        exhibits: CASE_042_EXHIBITS,
      },
    });

    if (action.isTrap) {
      setTimeout(() => dispatch({ type: 'CLEAR_STAGE_SHAKE' }), 400);
    }
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

  // Dev Quick-Sim actions
  const handleDevSim = (type: 'green' | 'trap' | 'confirm') => {
    if (type === 'green') {
      dispatch({ type: 'SET_INPUT', payload: 'click green clover 13870 button in 2nd row' });
    } else if (type === 'trap') {
      dispatch({ type: 'SET_INPUT', payload: 'click the red button' });
    } else if (type === 'confirm') {
      dispatch({ type: 'SET_INPUT', payload: 'click blue confirm button at D4' });
    }
  };

  return (
    <DossierLayout
      telemetryBar={
        <nav
          aria-label="Kanjion Game Menu Bar"
          className="max-w-6xl mx-auto bg-dossier-ink text-dossier-paper border-2 border-dossier-ink px-3.5 py-2.5 shadow-ink font-mono-clean space-y-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* 1. DIFFICULTY SELECTOR */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-amber-300 font-black uppercase tracking-wider mr-1">
                🎚️ Difficulty:
              </span>
              <button
                type="button"
                onClick={() => setDifficulty('easy')}
                aria-pressed={difficulty === 'easy'}
                className={`px-2.5 py-1 font-bold border transition-colors ${
                  difficulty === 'easy'
                    ? 'bg-emerald-500 text-black border-white font-black'
                    : 'bg-neutral-800 text-stone-300 border-stone-600 hover:bg-neutral-700'
                }`}
              >
                🟢 Easy (English Hints)
              </button>
              <button
                type="button"
                onClick={() => setDifficulty('medium')}
                aria-pressed={difficulty === 'medium'}
                className={`px-2.5 py-1 font-bold border transition-colors ${
                  difficulty === 'medium'
                    ? 'bg-amber-400 text-black border-white font-black'
                    : 'bg-neutral-800 text-stone-300 border-stone-600 hover:bg-neutral-700'
                }`}
              >
                🟡 Medium (Grid Clues)
              </button>
              <button
                type="button"
                onClick={() => setDifficulty('hard')}
                aria-pressed={difficulty === 'hard'}
                className={`px-2.5 py-1 font-bold border transition-colors ${
                  difficulty === 'hard'
                    ? 'bg-red-600 text-white border-white font-black'
                    : 'bg-neutral-800 text-stone-300 border-stone-600 hover:bg-neutral-700'
                }`}
              >
                🔴 Hard (🇯🇵 Raw Japanese)
              </button>
            </div>

            {/* 2. GAME MODE & AI ENGINE SELECTOR */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-amber-300 font-black uppercase tracking-wider mr-1">
                  🎮 Mode:
                </span>
                <button
                  type="button"
                  onClick={() => handleSelectPlayMode('daily')}
                  aria-pressed={playMode === 'daily'}
                  className={`px-2.5 py-1 font-bold border transition-colors ${
                    playMode === 'daily'
                      ? 'bg-dossier-accent text-dossier-ink border-white font-black'
                      : 'bg-neutral-800 text-stone-300 border-stone-600 hover:bg-neutral-700'
                  }`}
                  title="Daily Case #042 (Starts at Step 3 with Steps 1-2 pre-completed)"
                >
                  📅 Daily Case #042
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPlayMode('fresh')}
                  aria-pressed={playMode === 'fresh'}
                  className={`px-2.5 py-1 font-bold border transition-colors ${
                    playMode === 'fresh'
                      ? 'bg-dossier-accent text-dossier-ink border-white font-black'
                      : 'bg-neutral-800 text-stone-300 border-stone-600 hover:bg-neutral-700'
                  }`}
                  title="Start from Line 01 with all 6 telegram lines blank"
                >
                  ✨ Full 6-Line Run
                </button>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-amber-300 font-black uppercase tracking-wider ml-1 mr-1">
                  🤖 AI:
                </span>
                <button
                  type="button"
                  onClick={() => setEngineMode(engineMode === 'offline' ? 'cloud' : 'offline')}
                  className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-amber-300 font-bold border border-amber-300"
                >
                  {engineMode === 'offline' ? '⚡ Instant Sim' : '🧠 Cloud LLM'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowDevTools(!showDevTools)}
                className="px-2 py-1 bg-neutral-900 hover:bg-neutral-800 text-stone-400 border border-stone-700 text-[11px]"
                title="Toggle quick-fill sample prompts"
              >
                {showDevTools ? '▾ Hide Samples' : '▸ Sample Prompts'}
              </button>
            </div>
          </div>

          {/* Contextual Difficulty Helper Banner (Easy / Medium Modes) */}
          {difficulty === 'easy' && (
            <div className="bg-emerald-950/90 border border-emerald-400 text-emerald-100 px-3 py-1.5 text-xs flex flex-wrap items-center justify-between gap-2">
              <span>
                <strong>🟢 EASY MODE TRANSLATION GUIDE:</strong> Goal is to book the{' '}
                <strong>2nd train row (Nozomi 24 • 14:30)</strong> →{' '}
                <strong>Green Car (🍀 ¥13,870 button at Col D, Row 3)</strong>, then click the{' '}
                <strong>Blue Confirm button (Col D, Row 4)</strong>. Avoid the red ¥2,400 ad banner!
              </span>
            </div>
          )}
          {difficulty === 'medium' && (
            <div className="bg-amber-950/90 border border-amber-400 text-amber-100 px-3 py-1.5 text-xs">
              <strong>🟡 MEDIUM MODE CLUE:</strong> Click{' '}
              <strong>▶ Target Ghost Replay</strong> below to see the 2 target click waypoints, then
              describe those buttons by their grid coordinate (e.g. <code>D3</code>, <code>D4</code>),
              color, or icon!
            </div>
          )}

          {/* Optional Sample Prompts Bar */}
          {showDevTools && (
            <div className="pt-1.5 border-t border-stone-700 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-stone-400 font-bold">TRY A SAMPLE COMMAND:</span>
              <button
                type="button"
                onClick={() => handleDevSim('green')}
                className="px-2 py-0.5 bg-emerald-800 hover:bg-emerald-700 text-white font-bold border border-white"
              >
                Fill: &quot;click green clover 13870 button in 2nd row&quot;
              </button>
              <button
                type="button"
                onClick={() => handleDevSim('confirm')}
                className="px-2 py-0.5 bg-blue-800 hover:bg-blue-700 text-white font-bold border border-white"
              >
                Fill: &quot;click blue confirm button at D4&quot;
              </button>
              <button
                type="button"
                onClick={() => handleDevSim('trap')}
                className="px-2 py-0.5 bg-red-800 hover:bg-red-700 text-white font-bold border border-white"
              >
                Fill Trap: &quot;click the red button&quot;
              </button>
            </div>
          )}
        </nav>
      }
      header={
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
          onToggleBackendMode={() => setEngineMode(engineMode === 'offline' ? 'cloud' : 'offline')}
        />
      }
      stage={
        <CoordinateRulers>
          <SandboxStage
            macroViewId={state.macroViewId}
            microState={state.microState}
            agentCursor={state.agentCursor}
            ghostReplayActive={state.ghostReplayActive}
            somOverlayActive={state.somOverlayActive}
            stageShake={state.stageShake}
            onElementClick={handleElementClick}
          >
            {/* Case File #042 Interactive Sandbox Clone */}
            <ShinkansenSandbox
              microState={state.microState}
              somOverlayActive={state.somOverlayActive}
              onElementClick={handleElementClick}
            />

            {/* 1:1 In-Engine Target Ghost Replay Overlay */}
            <GhostReplay
              active={state.ghostReplayActive}
              onToggle={handleToggleGhost}
              trajectory={CASE_042_GHOST_REPLAY}
            />

            {/* Animated Field-Agent Cursor & Pinned Yellow Note */}
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
      }
      dispatchPad={
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
      }
      exhibitsPanel={
        <div ref={exhibitsPanelRef}>
          <ExhibitsPanel
            caseClosed={state.caseStatus === 'closed'}
            scoreReport={state.scoreReport}
            onReopenCase={handleReopenCase}
          />
        </div>
      }
    />
  );
};

export default App;
