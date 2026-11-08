import { describe, it, expect } from 'vitest';
import { createInitialGameState, gameReducer } from '../src/engine/game_reducer';
import { applyDecision, createInitialPuzzleState } from '../src/engine/puzzle_engine';
import { CASE_001_PUZZLE } from '../src/data/puzzles/case_001/puzzle';
import { resolveLine, decisionToAgentAction } from '../src/engine/agent';
import {
  CASE_001_INITIAL_MICRO_STATE,
  CASE_001_EXHIBITS,
  CASE_001_GENERATED_MANIFEST,
} from '../src/data/puzzles/case_001';
import { calculateScoreReport } from '../src/engine/scoring';
import type { AgentAction } from '../src/types/engine';
import type { PuzzleState } from '../src/types/puzzle_data';

function createBrowserStartState(): PuzzleState {
  return createInitialPuzzleState(CASE_001_PUZZLE);
}

async function resolveTestAction(pageId: string, fields: Record<string, unknown>, instruction: string) {
  const decision = await resolveLine({
    puzzle: CASE_001_PUZZLE,
    manifest: CASE_001_GENERATED_MANIFEST,
    state: {
      pageId,
      previousPageId: 'MV-01',
      fields: fields as PuzzleState['fields'],
    },
    instruction,
    visibleText: '',
  });
  return decisionToAgentAction(decision, CASE_001_PUZZLE, CASE_001_GENERATED_MANIFEST);
}

function stepPuzzle(state: PuzzleState, action: Partial<AgentAction> & { action: AgentAction['action'] }) {
  const markNum = action.targetId ? Number.parseInt(String(action.targetId).replace(/^#/, ''), 10) : NaN;
  const mappedAction =
    action.action === 'TYPE'
      ? 'TYPE'
      : action.action === 'DRAW'
        ? 'DRAW'
        : action.action === 'TIMED_CLICK'
          ? 'TIMED_CLICK'
          : action.action === 'CLICK'
            ? 'CLICK'
            : 'NOOP';
  const res = applyDecision(CASE_001_PUZZLE, state, {
    action: mappedAction,
    mark: Number.isFinite(markNum) ? markNum : null,
    text: action.textValue ?? undefined,
    stroke: action.textValue ?? undefined,
    thought: action.thought ?? '',
  });
  return {
    nextState: res.next,
    summary: res.summary,
    shake: res.shake,
  };
}

describe('Player Critical User Journeys (CUJ Regression Suite)', () => {
  it('CUJ 1: Zero-Action Immediate Close awards 0% (no free points for Exhibit B or D)', () => {
    const startState = createBrowserStartState();
    const report = calculateScoreReport(CASE_001_EXHIBITS, startState.fields, 0, '#001');
    expect(report.closenessScore).toBe(0);
    expect(report.finalScore).toBe(0);
    for (const ex of report.exhibitEvaluations) {
      expect(ex.status).toBe('MISSED');
      expect(ex.awardedPoints).toBe(0);
    }
  });

  it('CUJ 2: Casual Visual English Prompts traverse all 5 pages to 100% x 1.2x = 120 PTS', async () => {
    let game = createInitialGameState({
      caseNumber: '#001',
      initialMicroState: { ...CASE_001_INITIAL_MICRO_STATE },
    });

    const prompts = [
      'click the top left green box',
      'type TANAKA in the passenger name box',
      'wait for sale glow then click green button in second row',
      'draw a line in the signature box',
      'click blue button at bottom right',
    ];

    for (const prompt of prompts) {
      const action = await resolveTestAction(game.macroViewId, game.microState, prompt);
      game = gameReducer(game, {
        type: 'APPLY_AGENT_ACTION',
        payload: { action, instruction: prompt, exhibits: CASE_001_EXHIBITS },
      });
    }

    expect(game.macroViewId).toBe('MV-05');
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

  it('CUJ 3 & 4: Wrong Route Detours (Page 10 Tohoku, Page 11 Hokuriku, Page 12 Points) & Back Recovery', async () => {
    let state = createBrowserStartState();

    // Detour to Tohoku (#2 -> MV-10)
    const a1 = await resolveTestAction(state.pageId, state.fields, 'click second card on top right');
    state = stepPuzzle(state, a1).nextState;
    expect(state.pageId).toBe('MV-10');

    // Back (#14 -> MV-01)
    const a2 = await resolveTestAction(state.pageId, state.fields, 'click back button');
    state = stepPuzzle(state, a2).nextState;
    expect(state.pageId).toBe('MV-01');

    // Detour to Hokuriku (#3 -> MV-11)
    const a3 = await resolveTestAction(state.pageId, state.fields, 'click third card at bottom left');
    state = stepPuzzle(state, a3).nextState;
    expect(state.pageId).toBe('MV-11');

    // Back (#14 -> MV-01)
    const a4 = await resolveTestAction(state.pageId, state.fields, 'click back button');
    state = stepPuzzle(state, a4).nextState;
    expect(state.pageId).toBe('MV-01');

    // Detour to Points (#4 -> MV-12)
    const a5 = await resolveTestAction(state.pageId, state.fields, 'click fourth card at bottom right');
    state = stepPuzzle(state, a5).nextState;
    expect(state.pageId).toBe('MV-12');

    // Back (#14 -> MV-01)
    const a6 = await resolveTestAction(state.pageId, state.fields, 'click back button');
    state = stepPuzzle(state, a6).nextState;
    expect(state.pageId).toBe('MV-01');
  });

  it('CUJ 5: Out-of-Order Premature Command Guard prevents teleporting across pages', () => {
    const startState = createBrowserStartState();
    const res1 = stepPuzzle(startState, {
      action: 'CLICK',
      targetId: '#30',
      thought: 'Attempt confirm on Page 01',
    });
    expect(res1.nextState.pageId).toBe('MV-01');
    expect(res1.nextState.fields.finalConfirmed).toBe(false);
    expect(res1.summary).toMatch(/isn't on this page/i);
  });

  it('CUJ 6: Skipping Digital Signature on Page 04 yields 85% (Exhibit D MISSED)', () => {
    let state = createBrowserStartState();
    state = stepPuzzle(state, { action: 'CLICK', targetId: '#1', thought: 'Route' }).nextState;
    state = stepPuzzle(state, {
      action: 'TYPE',
      targetId: '#17',
      textValue: 'TANAKA',
      thought: 'Type TANAKA',
    }).nextState;
    state = stepPuzzle(state, { action: 'TIMED_CLICK', targetId: '#25', thought: 'Green' }).nextState;
    expect(state.pageId).toBe('MV-04');

    // Confirm without signing #27
    state = stepPuzzle(state, { action: 'CLICK', targetId: '#30', thought: 'Confirm' }).nextState;
    expect(state.pageId).toBe('MV-05');

    const report = calculateScoreReport(CASE_001_EXHIBITS, state.fields, 4, '#001');
    expect(report.closenessScore).toBe(85);
    const exD = report.exhibitEvaluations.find((e) => e.id === 'D');
    expect(exD?.status).toBe('MISSED');
  });

  it('CUJ 7: Typing Wrong Passenger Name (YAMADA) misses Exhibit B until fixed to TANAKA', async () => {
    let state = createBrowserStartState();
    state = stepPuzzle(state, { action: 'CLICK', targetId: '#1', thought: 'Route' }).nextState;
    const typeYamada = await resolveTestAction(state.pageId, state.fields, 'type YAMADA in passenger name');
    state = stepPuzzle(state, typeYamada).nextState;
    expect(state.fields.passengerName).toBe('YAMADA');
    expect(state.pageId).toBe('MV-03');

    // If evaluated with YAMADA, Exhibit B is MISSED
    const reportWrong = calculateScoreReport(CASE_001_EXHIBITS, state.fields, 2, '#001');
    expect(reportWrong.exhibitEvaluations.find((e) => e.id === 'B')?.status).toBe('MISSED');

    // Go back (#14) to Page 02 and fix to TANAKA
    state = stepPuzzle(state, { action: 'CLICK', targetId: '#14', thought: 'Back' }).nextState;
    expect(state.pageId).toBe('MV-02');
    const typeTanaka = await resolveTestAction(state.pageId, state.fields, 'type TANAKA in passenger name');
    state = stepPuzzle(state, typeTanaka).nextState;
    expect(state.fields.passengerName).toBe('TANAKA');
    const reportFixed = calculateScoreReport(CASE_001_EXHIBITS, state.fields, 4, '#001');
    expect(reportFixed.exhibitEvaluations.find((e) => e.id === 'B')?.status).toBe('VERIFIED');
  });

  it('CUJ 12: Page 03 Seat Disambiguation (Ambiguous ¥13,870 tie & Wrong Seat #24 recovery)', async () => {
    let state = createBrowserStartState();
    state = stepPuzzle(state, { action: 'CLICK', targetId: '#1', thought: 'Route' }).nextState;
    state = stepPuzzle(state, {
      action: 'TYPE',
      targetId: '#17',
      textValue: 'TANAKA',
      thought: 'Type TANAKA',
    }).nextState;
    expect(state.pageId).toBe('MV-03');

    // Ambiguous "click 13,870" triggers NOOP and stays on MV-03
    const ambigAction = await resolveTestAction(state.pageId, state.fields, 'click 13,870');
    expect(ambigAction.action).toBe('NOOP');
    state = stepPuzzle(state, ambigAction).nextState;
    expect(state.pageId).toBe('MV-03');

    // Selecting #24 (Nozomi Reserved ¥14,720) stays on MV-03 and does not set greenCarSelected
    state = stepPuzzle(state, { action: 'CLICK', targetId: '#24', thought: 'Reserved' }).nextState;
    expect(state.pageId).toBe('MV-03');
    expect(state.fields.greenCarSelected).toBe(false);
    expect(state.fields.seatClass).toBe('ordinary_reserved');

    // Selecting #25 (Green Car ¥13,870) advances to MV-04 and sets greenCarSelected=true
    const greenAction = await resolveTestAction(state.pageId, state.fields, 'click green 13,870');
    state = stepPuzzle(state, greenAction).nextState;
    expect(state.pageId).toBe('MV-04');
    expect(state.fields.greenCarSelected).toBe(true);
  });

  it('CUJ 13: 6-Line Exhaustion Auto-Closes Case File with 1.0x multiplier', async () => {
    let game = createInitialGameState({
      caseNumber: '#001',
      initialMicroState: { ...CASE_001_INITIAL_MICRO_STATE },
    });

    const sixPrompts = [
      'click second card on top right',
      'click back button',
      'click top left green card',
      'type TANAKA',
      'wait for flash sale and click green 13,870',
      'draw signature in box',
    ];

    for (const prompt of sixPrompts) {
      const action = await resolveTestAction(game.macroViewId, game.microState, prompt);
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

  it('CUJ 15: Custom smile signature ("Draw a signiture in the shape of a smile") + "Click the blue box on the bottom right"', async () => {
    let game = createInitialGameState({
      caseNumber: '#001',
      initialMicroState: { ...CASE_001_INITIAL_MICRO_STATE },
    });

    const userPrompts = [
      'Click on the green box with the 01 in it',
      'Type TANAKA in the passenger name box',
      'Wait for flash sale and click on the green 13870 box',
      'Draw a signiture in the shape of a smile',
      'Click the blue box on the bottom right',
    ];

    for (const prompt of userPrompts) {
      const action = await resolveTestAction(game.macroViewId, game.microState, prompt);
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
