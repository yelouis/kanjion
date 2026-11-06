import React, { useReducer, useMemo, useState, useRef, useEffect } from 'react';
import { gameReducer, createInitialGameState } from './engine/game_reducer';
import { OfflineSimulationEngine } from './engine/offline_simulator';
import { CloudVisionConnector, MockVisionLLMTransport } from './engine/cloud_connector';
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

export const App: React.FC = () => {
  // 1. Centralized Immutable Game State
  const [state, dispatch] = useReducer(
    gameReducer,
    undefined,
    () => createInitialGameState({ caseNumber: '#042', preSeeded: true })
  );

  // 2. Connector Engines (Offline Default & Cloud Vision Option)
  const [engineMode, setEngineMode] = useState<'offline' | 'cloud'>('offline');

  const offlineEngine = useMemo(
    () => new OfflineSimulationEngine(CASE_042_MACRO_VIEWS),
    []
  );

  const cloudEngine = useMemo(() => {
    const mockTransport = new MockVisionLLMTransport();
    return new CloudVisionConnector({
      puzzleId: 'case_042',
      macroViews: CASE_042_MACRO_VIEWS,
      transport: mockTransport,
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
        <aside className="max-w-6xl mx-auto bg-dossier-ink text-dossier-paper border-2 border-dossier-ink p-3 flex flex-wrap items-center justify-between gap-2 shadow-ink">
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 bg-dossier-accent text-dossier-ink font-black uppercase">
              FORENSIC DISPATCH ENGINE
            </span>
            <span>Tokyo–Osaka Shinkansen (Active Play & Unsealed Exhibits)</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleDevSim('green')}
              className="px-2 py-0.5 bg-emerald-800 hover:bg-emerald-700 text-white font-bold border border-white"
            >
              Sim: 🍀 ¥13,870
            </button>
            <button
              type="button"
              onClick={() => handleDevSim('trap')}
              className="px-2 py-0.5 bg-red-800 hover:bg-red-700 text-white font-bold border border-white"
            >
              Sim Trap: Red Ad
            </button>
            <button
              type="button"
              onClick={() => handleDevSim('confirm')}
              className="px-2 py-0.5 bg-blue-800 hover:bg-blue-700 text-white font-bold border border-white"
            >
              Sim: Blue Confirm
            </button>
            <button
              type="button"
              onClick={() => setEngineMode(engineMode === 'offline' ? 'cloud' : 'offline')}
              className="px-2 py-0.5 bg-neutral-800 text-amber-300 font-bold border border-amber-300"
            >
              Mode: {engineMode === 'offline' ? 'Offline Engine' : 'Cloud LLM'}
            </button>
          </div>
        </aside>
      }
      header={
        <MastheadHeader
          caseNumber={state.caseNumber}
          caseTitle="THE INSTRUCT DOSSIER"
          difficultyBadge="🇯🇵 HARD MODE: TOKYO–OSAKA SHINKANSEN"
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
