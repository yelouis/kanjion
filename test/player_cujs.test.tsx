import { describe, it, expect } from 'vitest';
import { reduceShinkansenMicroState, createInitialGameState, gameReducer } from '../src/engine/game_reducer';
import { OfflineSimulationEngine } from '../src/engine/offline_simulator';
import { BrowserGeminiNanoTransport, CloudVisionConnector } from '../src/engine/cloud_connector';
import { CASE_001_INITIAL_MICRO_STATE, CASE_001_EXHIBITS, CASE_001_MACRO_VIEWS } from '../src/data/puzzles/case_001';
import { calculateScoreReport } from '../src/engine/scoring';
import type { ShinkansenMicroState } from '../src/types/engine';

function createBrowserStartState(): ShinkansenMicroState {
  return {
    ...CASE_001_INITIAL_MICRO_STATE,
    macroViewId: 'MV-01',
    selectedRoute: 'none',
    departureTime: 'none',
    passengerName: '',
  };
}

describe('Player Critical User Journeys (CUJ Regression Suite)', () => {
  const engine = new OfflineSimulationEngine();

  it('CUJ 1: Zero-Action Immediate Close awards 0% (no free points for Exhibit B or D)', () => {
    const startState = createBrowserStartState();
    const report = calculateScoreReport(CASE_001_EXHIBITS, startState, 0, '#001');
    expect(report.closenessScore).toBe(0);
    expect(report.finalScore).toBe(0);
    for (const ex of report.exhibitEvaluations) {
      expect(ex.status).toBe('MISSED');
      expect(ex.awardedPoints).toBe(0);
    }
  });

  it('CUJ 2: Casual Visual English Prompts traverse all 5 pages to 100% x 1.2x = 120 PTS', () => {
    let game = createInitialGameState({
      caseNumber: '#001',
      initialMicroState: createBrowserStartState(),
    });

    const prompts = [
      'click the top left green box',
      'type TANAKA in the text box',
      'click green button in second row',
      'draw a line in the signature box',
      'click blue button at bottom right',
    ];

    for (const prompt of prompts) {
      const action = engine.resolveInstruction(game.macroViewId, game.microState, prompt);
      game = gameReducer(game, {
        type: 'APPLY_AGENT_ACTION',
        payload: { action, instruction: prompt, exhibits: CASE_001_EXHIBITS },
      });
    }

    expect(game.macroViewId).toBe('MV-05');
    expect(game.microState.macroViewId).toBe('MV-05');
    expect(game.microState.selectedRoute).toBe('tokyo_osaka');
    expect(game.microState.passengerName).toBe('TANAKA');
    expect(game.microState.greenCarSelected).toBe(true);
    expect(Boolean(game.microState.signatureStroke)).toBe(true);
    expect(game.microState.finalConfirmed).toBe(true);

    game = gameReducer(game, { type: 'CLOSE_CASE', payload: { exhibits: CASE_001_EXHIBITS } });
    expect(game.scoreReport?.closenessScore).toBe(100);
    expect(game.scoreReport?.multiplier).toBe(1.2);
    expect(game.scoreReport?.finalScore).toBe(120);
  });

  it('CUJ 3 & 4: Wrong Route Detours (Page 10 Tohoku, Page 11 Hokuriku, Page 12 Points) & Back Recovery', () => {
    let state = createBrowserStartState();

    // Detour to Tohoku (#2 -> MV-10)
    const a1 = engine.resolveInstruction(state.macroViewId, state, 'click second card on top right');
    state = reduceShinkansenMicroState(state, a1).nextState;
    expect(state.macroViewId).toBe('MV-10');

    // Back (#14 -> MV-01)
    const a2 = engine.resolveInstruction(state.macroViewId, state, 'click back button');
    state = reduceShinkansenMicroState(state, a2).nextState;
    expect(state.macroViewId).toBe('MV-01');

    // Detour to Hokuriku (#3 -> MV-11)
    const a3 = engine.resolveInstruction(state.macroViewId, state, 'click third card at bottom left');
    state = reduceShinkansenMicroState(state, a3).nextState;
    expect(state.macroViewId).toBe('MV-11');

    // Back (#14 -> MV-01)
    const a4 = engine.resolveInstruction(state.macroViewId, state, 'click back button');
    state = reduceShinkansenMicroState(state, a4).nextState;
    expect(state.macroViewId).toBe('MV-01');

    // Detour to JRE Points (#4 -> MV-12)
    const a5 = engine.resolveInstruction(state.macroViewId, state, 'click fourth card at bottom right');
    state = reduceShinkansenMicroState(state, a5).nextState;
    expect(state.macroViewId).toBe('MV-12');

    // Back (#14 -> MV-01)
    const a6 = engine.resolveInstruction(state.macroViewId, state, 'click back button');
    state = reduceShinkansenMicroState(state, a6).nextState;
    expect(state.macroViewId).toBe('MV-01');
  });

  it('CUJ 5: Out-of-Order Premature Command Guard prevents teleporting across pages', () => {
    const startState = createBrowserStartState();
    const res1 = reduceShinkansenMicroState(startState, {
      action: 'CLICK',
      targetId: '#30',
      thought: 'Attempt confirm on Page 01',
    });
    expect(res1.nextState.macroViewId).toBe('MV-01');
    expect(res1.nextState.finalConfirmed).toBe(false);
    expect(res1.summary).toMatch(/not on Page 01/i);
  });

  it('CUJ 6: Skipping Digital Signature on Page 04 yields 85% (Exhibit D MISSED)', () => {
    let state = createBrowserStartState();
    state = reduceShinkansenMicroState(state, { action: 'CLICK', targetId: '#1', thought: 'Route' }).nextState;
    state = reduceShinkansenMicroState(state, {
      action: 'TYPE',
      targetId: '#17',
      textValue: 'TANAKA',
      thought: 'Type TANAKA',
    }).nextState;
    state = reduceShinkansenMicroState(state, { action: 'TIMED_CLICK', targetId: '#25', thought: 'Green' }).nextState;
    expect(state.macroViewId).toBe('MV-04');

    // Confirm without signing #27
    state = reduceShinkansenMicroState(state, { action: 'CLICK', targetId: '#30', thought: 'Confirm' }).nextState;
    expect(state.macroViewId).toBe('MV-05');

    const report = calculateScoreReport(CASE_001_EXHIBITS, state, 4, '#001');
    expect(report.closenessScore).toBe(85);
    const exD = report.exhibitEvaluations.find((e) => e.id === 'exhibit_d');
    expect(exD?.status).toBe('MISSED');
  });

  it('CUJ 7: Typing Wrong Passenger Name (YAMADA) misses Exhibit B until fixed to TANAKA', () => {
    let state = createBrowserStartState();
    state = reduceShinkansenMicroState(state, { action: 'CLICK', targetId: '#1', thought: 'Route' }).nextState;
    const typeYamada = engine.resolveInstruction(state.macroViewId, state, 'type YAMADA in passenger name');
    state = reduceShinkansenMicroState(state, typeYamada).nextState;
    expect(state.passengerName).toBe('YAMADA');
    expect(state.macroViewId).toBe('MV-03');

    // If evaluated with YAMADA, Exhibit B is MISSED
    const reportWrong = calculateScoreReport(CASE_001_EXHIBITS, state, 2, '#001');
    expect(reportWrong.exhibitEvaluations.find((e) => e.id === 'exhibit_b')?.status).toBe('MISSED');

    // Go back (#14) to Page 02 and fix to TANAKA
    state = reduceShinkansenMicroState(state, { action: 'CLICK', targetId: '#14', thought: 'Back' }).nextState;
    expect(state.macroViewId).toBe('MV-02');
    const typeTanaka = engine.resolveInstruction(state.macroViewId, state, 'type TANAKA in passenger name');
    state = reduceShinkansenMicroState(state, typeTanaka).nextState;
    expect(state.passengerName).toBe('TANAKA');
    const reportFixed = calculateScoreReport(CASE_001_EXHIBITS, state, 4, '#001');
    expect(reportFixed.exhibitEvaluations.find((e) => e.id === 'exhibit_b')?.status).toBe('VERIFIED');
  });

  it('CUJ 12: Page 03 Seat Disambiguation (Ambiguous ¥13,870 tie & Wrong Seat #24 recovery)', () => {
    let state = createBrowserStartState();
    state = reduceShinkansenMicroState(state, { action: 'CLICK', targetId: '#1', thought: 'Route' }).nextState;
    state = reduceShinkansenMicroState(state, {
      action: 'TYPE',
      targetId: '#17',
      textValue: 'TANAKA',
      thought: 'Type TANAKA',
    }).nextState;
    expect(state.macroViewId).toBe('MV-03');

    // Ambiguous "click 13,870" triggers CONFUSED and stays on MV-03
    const ambigAction = engine.resolveInstruction(state.macroViewId, state, 'click 13,870');
    expect(ambigAction.action).toBe('CONFUSED');
    state = reduceShinkansenMicroState(state, ambigAction).nextState;
    expect(state.macroViewId).toBe('MV-03');

    // Selecting #24 (Nozomi Reserved ¥14,720) stays on MV-03 and does not set greenCarSelected
    state = reduceShinkansenMicroState(state, { action: 'CLICK', targetId: '#24', thought: 'Reserved' }).nextState;
    expect(state.macroViewId).toBe('MV-03');
    expect(state.greenCarSelected).toBe(false);
    expect(state.seatClass).toBe('ordinary_reserved');

    // Selecting #25 (Green Car ¥13,870) advances to MV-04 and sets greenCarSelected=true
    const greenAction = engine.resolveInstruction(state.macroViewId, state, 'click green 13,870');
    state = reduceShinkansenMicroState(state, greenAction).nextState;
    expect(state.macroViewId).toBe('MV-04');
    expect(state.greenCarSelected).toBe(true);
  });

  it('CUJ 13: 6-Line Exhaustion Auto-Closes Case File with 1.0x multiplier', () => {
    let game = createInitialGameState({
      caseNumber: '#001',
      initialMicroState: createBrowserStartState(),
    });

    const sixPrompts = [
      'click second card on top right',
      'click back button',
      'click top left green card',
      'type TANAKA',
      'click green 13,870',
      'draw signature in box',
    ];

    for (const prompt of sixPrompts) {
      const action = engine.resolveInstruction(game.macroViewId, game.microState, prompt);
      game = gameReducer(game, {
        type: 'APPLY_AGENT_ACTION',
        payload: { action, instruction: prompt, exhibits: CASE_001_EXHIBITS },
      });
    }

    expect(game.caseStatus).toBe('closed');
    expect(game.scoreReport?.closenessScore).toBe(80);
    expect(game.scoreReport?.multiplier).toBe(1.0);
    expect(game.scoreReport?.finalScore).toBe(80);
  });

  it('CUJ 14: BrowserGeminiNanoTransport executes 100% client-side via window.LanguageModel and local fallback', async () => {
    const connector = new CloudVisionConnector({
      puzzleId: 'case_001',
      macroViews: CASE_001_MACRO_VIEWS,
      transport: new BrowserGeminiNanoTransport(),
    });

    // 1. With mock Chrome Built-in Gemini Nano (window.LanguageModel) installed
    const g = globalThis as unknown as Record<string, unknown>;
    let promptCalled = false;
    g.LanguageModel = {
      availability: async () => 'available',
      create: async () => ({
        prompt: async () => {
          promptCalled = true;
          return JSON.stringify({
            action: 'CLICK',
            target_id: 1,
            text_value: null,
            scroll_direction: null,
            thought: '📌 FIELD NOTE: Gemini Nano selected Tokaido Shinkansen card.',
          });
        },
        destroy: () => {},
      }),
    };

    try {
      const startState = createBrowserStartState();
      const actionNano = await connector.resolveInstruction('MV-01', startState, 'click top left green card');
      expect(promptCalled).toBe(true);
      expect(actionNano.action).toBe('CLICK');
      expect(actionNano.targetId).toBe('#1');
    } finally {
      delete g.LanguageModel;
    }

    // 2. Without window.LanguageModel (e.g. mobile Safari), still resolves 100% client-side with zero network calls
    const startState2 = createBrowserStartState();
    const actionLocal = await connector.resolveInstruction('MV-02', startState2, 'type TANAKA in the text box');
    expect(actionLocal.action).toBe('TYPE');
    expect(actionLocal.targetId).toBe('#17');
    expect(actionLocal.textValue).toBe('TANAKA');
  });

  it('CUJ 15: Custom smile signature ("Draw a signiture in the shape of a smile") + "Click the blue box on the bottom right"', async () => {
    const connector = new CloudVisionConnector({
      puzzleId: 'case_001',
      macroViews: CASE_001_MACRO_VIEWS,
      transport: new BrowserGeminiNanoTransport(),
    });

    let game = createInitialGameState({
      caseNumber: '#001',
      initialMicroState: createBrowserStartState(),
    });

    const userPrompts = [
      'Click on the green box with the 01 in it',
      'Click on the box under the required type and type TANAKA',
      'Click on the green 13870 box',
      'Draw a signiture in the shape of a smile',
      'Click the blue box on the bottom right',
    ];

    for (const prompt of userPrompts) {
      const action = await connector.resolveInstruction(game.macroViewId, game.microState, prompt);
      game = gameReducer(game, {
        type: 'APPLY_AGENT_ACTION',
        payload: { action, instruction: prompt, exhibits: CASE_001_EXHIBITS },
      });
    }

    expect(Boolean(game.microState.signatureStroke)).toBe(true);
    expect(game.microState.signatureStroke).toBe('SHAPE:smile');
    expect(game.microState.finalConfirmed).toBe(true);
    expect(game.macroViewId).toBe('MV-05');

    game = gameReducer(game, { type: 'CLOSE_CASE', payload: { exhibits: CASE_001_EXHIBITS } });
    expect(game.scoreReport?.closenessScore).toBe(100);
    expect(game.scoreReport?.finalScore).toBe(120);
  });
});
