/**
 * test/game_reducer.test.ts
 *
 * Automated verification suite for the Game State Reducer:
 * - Pure immutable state updates
 * - Micro-state transitions starting from MV-01
 * - Redacted telegram ledger protocol (SEALED during active play)
 * - Cursor kinematics, variants, and thought note <= 80 chars
 * - Stage error shake on decoy traps
 * - Case closure lifecycles (manual CLOSE_CASE & Line 06 auto-exhaustion)
 * - Practice mode REOPEN_CASE and overlay toggles
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  gameReducer,
  createInitialGameState,
} from '../src/engine/game_reducer';
import { applyDecision } from '../src/engine/puzzle_engine';
import { CASE_001_PUZZLE } from '../src/data/puzzles/case_001/puzzle';
import { GameState } from '../src/types/game';
import { AgentAction } from '../src/types/engine';
import { CASE_001_EXHIBITS } from '../src/data/puzzles/case_001';

describe('Game State Reducer & Micro-State Transitions', () => {
  let initialState: GameState;

  beforeEach(() => {
    initialState = createInitialGameState();
  });

  function advanceToMv03(state: GameState): GameState {
    let s = gameReducer(state, {
      type: 'APPLY_AGENT_ACTION',
      payload: {
        action: { action: 'CLICK', targetId: '#1', thought: 'select tokaido route' },
        instruction: 'click the top-left green box',
      },
    });
    s = gameReducer(s, {
      type: 'APPLY_AGENT_ACTION',
      payload: {
        action: { action: 'TYPE', targetId: '#17', textValue: 'TANAKA', thought: 'type tanaka' },
        instruction: 'type TANAKA in the passenger name box',
      },
    });
    return s;
  }

  describe('createInitialGameState', () => {
    it('creates fresh unseeded initial state starting on MV-01 at Line 01', () => {
      const freshState = createInitialGameState();
      expect(freshState.caseStatus).toBe('active');
      expect(freshState.macroViewId).toBe('MV-01');
      expect(freshState.activeLineIndex).toBe(0);
      expect(freshState.currentInput).toBe('');
      expect(freshState.scoreReport).toBeNull();
      for (const t of freshState.telegrams) {
        expect(t.submitted).toBe(false);
        expect(t.exhibitRedactedStatus).toBe('SEALED');
      }
    });

    it('directly mutates puzzle state using applyDecision from MV-03', () => {
      const mv03State = advanceToMv03(initialState);
      const res = applyDecision(CASE_001_PUZZLE, mv03State.puzzleState, {
        action: 'CLICK',
        mark: 25,
        thought: 'direct test',
      });
      expect(res.next.fields.greenCarSelected).toBe(true);
      expect(res.summary).toBe('Agent clicked [🍀 ◯ ¥13,870 (特割)]');
      expect(res.shake).toBe(false);
      expect(res.next.pageId).toBe('MV-04');
    });
  });

  describe('SET_INPUT Action & 60-Char Limit', () => {
    it('updates currentInput up to 60 characters', () => {
      const next = gameReducer(initialState, {
        type: 'SET_INPUT',
        payload: 'click green car',
      });
      expect(next.currentInput).toBe('click green car');
    });

    it('strictly truncates input exceeding 60 characters', () => {
      const longInput = 'A'.repeat(75);
      const next = gameReducer(initialState, {
        type: 'SET_INPUT',
        payload: longInput,
      });
      expect(next.currentInput.length).toBe(60);
      expect(next.currentInput).toBe('A'.repeat(60));
    });

    it('ignores SET_INPUT when case is closed or execution in flight', () => {
      const closedState: GameState = { ...initialState, caseStatus: 'closed' };
      const next = gameReducer(closedState, {
        type: 'SET_INPUT',
        payload: 'new instruction',
      });
      expect(next.currentInput).toBe(closedState.currentInput);

      const executingState: GameState = { ...initialState, isExecuting: true };
      const next2 = gameReducer(executingState, {
        type: 'SET_INPUT',
        payload: 'new instruction',
      });
      expect(next2.currentInput).toBe(executingState.currentInput);
    });
  });

  describe('START_EXECUTION Action', () => {
    it('sets isExecuting to true during active play', () => {
      const next = gameReducer(initialState, { type: 'START_EXECUTION' });
      expect(next.isExecuting).toBe(true);
    });

    it('ignores START_EXECUTION when case is closed', () => {
      const closedState: GameState = { ...initialState, caseStatus: 'closed' };
      const next = gameReducer(closedState, { type: 'START_EXECUTION' });
      expect(next.isExecuting).toBe(false);
    });
  });

  describe('APPLY_AGENT_ACTION: Target #25 (Green Car Discount Fare)', () => {
    it('mutates micro-state satisfying Exhibit C, updates cursor, and keeps ledger SEALED', () => {
      const mv03State = advanceToMv03(initialState);
      const greenCarAction: AgentAction = {
        action: 'CLICK',
        targetId: '#25',
        gridRef: 'D3',
        targetCoordinate: { x: 885, y: 468 },
        thought: '📌 FIELD NOTE: Clicked [🍀 ◯ ¥13,870] at D3',
        isTrap: false,
      };

      const next = gameReducer(mv03State, {
        type: 'APPLY_AGENT_ACTION',
        payload: {
          action: greenCarAction,
          instruction: 'click green clover 13870 button in 2nd row',
        },
      });

      // 1. Micro-state verification
      expect(next.microState.greenCarSelected).toBe(true);
      expect(next.microState.trainName).toBe('Nozomi 24');
      expect(next.microState.seatClass).toBe('green_car');
      expect(next.microState.fare).toBe(13870);

      // 2. Cursor verification
      expect(next.agentCursor.xPercent).toBeCloseTo((885 / 1024) * 100, 1);
      expect(next.agentCursor.yPercent).toBeCloseTo((468 / 768) * 100, 1);
      expect(next.agentCursor.thought).toBe('📌 FIELD NOTE: Clicked [🍀 ◯ ¥13,870] at D3');
      expect(next.agentCursor.thought.length).toBeLessThanOrEqual(80);
      expect(next.agentCursor.variant).toBe('executing');
      expect(next.stageShake).toBe(false);

      // 3. Telegram ledger verification (Line 3 submitted, Line 4 active)
      expect(next.activeLineIndex).toBe(3);
      expect(next.telegrams[2].submitted).toBe(true);
      expect(next.telegrams[2].text).toBe('click green clover 13870 button in 2nd row');
      expect(next.telegrams[2].actionSummary).toBe('Agent clicked [🍀 ◯ ¥13,870 (特割)]');
      expect(next.telegrams[2].exhibitRedactedStatus).toBe('SEALED');

      // 4. Input & lifecycle
      expect(next.currentInput).toBe('');
      expect(next.isExecuting).toBe(false);
      expect(next.caseStatus).toBe('active');
    });
  });

  describe('APPLY_AGENT_ACTION: Decoy Traps (#12 Promo Banner & #11 Logout)', () => {
    it('handles #12 red promo banner click: sets insuranceAttached and triggers stage shake', () => {
      const bannerAction: AgentAction = {
        action: 'CLICK',
        targetId: '#12',
        gridRef: 'D1',
        targetCoordinate: { x: 887, y: 109 },
        thought: '📌 FIELD NOTE: Clicked [今すぐ申し込む] at D1',
        isTrap: true,
      };

      const next = gameReducer(initialState, {
        type: 'APPLY_AGENT_ACTION',
        payload: { action: bannerAction, instruction: 'click red button' },
      });

      expect(next.microState.insuranceAttached).toBe(true);
      expect(next.stageShake).toBe(true);
      expect(next.agentCursor.variant).toBe('trap');
      expect(next.agentCursor.isShaking).toBe(true);
    });

    it('toggles #28 insurance checkbox cleanly on MV-04', () => {
      const mv03State = advanceToMv03(initialState);
      const mv04State = gameReducer(mv03State, {
        type: 'APPLY_AGENT_ACTION',
        payload: {
          action: { action: 'CLICK', targetId: '#25', thought: 'green car' },
          instruction: 'click green car',
        },
      });

      const chkAction: AgentAction = {
        action: 'CLICK',
        targetId: '#28',
        gridRef: 'B4',
        targetCoordinate: { x: 400, y: 718 },
        thought: '📌 FIELD NOTE: Checked [旅行キャンセル保険を追加] at B4',
        isTrap: true,
      };

      const next = gameReducer(mv04State, {
        type: 'APPLY_AGENT_ACTION',
        payload: { action: chkAction, instruction: 'check insurance' },
      });

      expect(next.microState.insuranceAttached).toBe(true);
      expect(next.telegrams[3].actionSummary).toBe('Agent checked [旅行キャンセル保険を追加]');

      // Toggle off
      const next2 = gameReducer(next, {
        type: 'APPLY_AGENT_ACTION',
        payload: { action: chkAction, instruction: 'check insurance' },
      });
      expect(next2.microState.insuranceAttached).toBe(false);
      expect(next2.telegrams[4].actionSummary).toBe('Agent unchecked [旅行キャンセル保険を追加]');
    });
  });

  describe('APPLY_AGENT_ACTION: Target #30 (Confirm Booking CTA)', () => {
    it('sets finalConfirmed = true and transitions macro-view to MV-05', () => {
      const mv03State = advanceToMv03(initialState);
      const mv04State = gameReducer(mv03State, {
        type: 'APPLY_AGENT_ACTION',
        payload: {
          action: { action: 'CLICK', targetId: '#25', thought: 'green car' },
          instruction: 'click green car',
        },
      });

      const confirmAction: AgentAction = {
        action: 'CLICK',
        targetId: '#30',
        gridRef: 'D4',
        targetCoordinate: { x: 905, y: 720 },
        thought: '📌 FIELD NOTE: Clicked [予約内容を確認・確定へ ▶] at D4',
      };

      const next = gameReducer(mv04State, {
        type: 'APPLY_AGENT_ACTION',
        payload: { action: confirmAction, instruction: 'confirm booking' },
      });

      expect(next.microState.finalConfirmed).toBe(true);
      expect(next.macroViewId).toBe('MV-05');
      expect(next.agentCursor.variant).toBe('confirmed');
    });
  });

  describe('APPLY_AGENT_ACTION: Confusion & Fallback Actions', () => {
    it('updates cursor to confused variant without mutating micro-state', () => {
      const confusedAction: AgentAction = {
        action: 'CONFUSED',
        thought: '📌 FIELD NOTE: Instruction unclear. Target could not be identified.',
      };

      const next = gameReducer(initialState, {
        type: 'APPLY_AGENT_ACTION',
        payload: { action: confusedAction, instruction: 'invalid move' },
      });

      expect(next.agentCursor.variant).toBe('confused');
      expect(next.microState).toEqual(initialState.microState);
      expect(next.telegrams[0].submitted).toBe(true);
      expect(next.telegrams[0].actionSummary).toContain('Instruction unclear');
    });
  });

  describe('Case Closure Lifecycles (Line 06 Auto-Closure vs Manual CLOSE_CASE)', () => {
    it('auto-closes case upon Line 06 completion with 0 unused lines (1.0x multiplier)', () => {
      let state = { ...initialState };
      for (let i = 0; i < 5; i++) {
        state = gameReducer(state, {
          type: 'APPLY_AGENT_ACTION',
          payload: {
            action: { action: 'CONFUSED', thought: 'test' },
            instruction: `turn ${i + 1}`,
          },
        });
      }
      expect(state.activeLineIndex).toBe(5); // Now on Line 06
      expect(state.caseStatus).toBe('active');
      expect(state.scoreReport).toBeNull();

      // Submit Line 06 (the final line)
      const finalState = gameReducer(state, {
        type: 'APPLY_AGENT_ACTION',
        payload: {
          action: { action: 'CLICK', targetId: '#1', thought: 'route' },
          instruction: 'click route 1',
        },
      });

      // Auto-exhaustion triggers
      expect(finalState.caseStatus).toBe('closed');
      expect(finalState.activeLineIndex).toBe(5);
      expect(finalState.scoreReport).not.toBeNull();
      expect(finalState.scoreReport?.linesUsed).toBe(6);
      expect(finalState.scoreReport?.unusedLines).toBe(0);
      expect(finalState.scoreReport?.multiplier).toBe(1.0);
    });

    it('evaluates early manual closure via CLOSE_CASE awarding efficiency bonus', () => {
      let s = advanceToMv03(initialState);
      s = gameReducer(s, {
        type: 'APPLY_AGENT_ACTION',
        payload: {
          action: { action: 'CLICK', targetId: '#25', thought: 'green car' },
          instruction: 'click green car',
        },
      });
      s = gameReducer(s, {
        type: 'APPLY_AGENT_ACTION',
        payload: {
          action: { action: 'DRAW', targetId: '#27', textValue: 'SHAPE:signature', thought: 'sign' },
          instruction: 'draw signature',
        },
      });
      s = gameReducer(s, {
        type: 'APPLY_AGENT_ACTION',
        payload: {
          action: { action: 'CLICK', targetId: '#30', thought: 'confirm' },
          instruction: 'blue confirm',
        },
      });

      // Player manually closes case after 5 lines dispatched
      const closedState = gameReducer(s, {
        type: 'CLOSE_CASE',
        payload: { exhibits: CASE_001_EXHIBITS },
      });

      expect(closedState.caseStatus).toBe('closed');
      expect(closedState.scoreReport).not.toBeNull();
      expect(closedState.scoreReport?.closenessScore).toBe(100);
      expect(closedState.scoreReport?.linesUsed).toBe(5);
      expect(closedState.scoreReport?.unusedLines).toBe(1);
      expect(closedState.scoreReport?.multiplier).toBe(1.2);
      expect(closedState.scoreReport?.finalScore).toBe(120);
    });
  });

  describe('Practice Mode & Toggles', () => {
    it('starts fresh unscored practice run while preserving officialResult', () => {
      const closed = gameReducer(initialState, { type: 'CLOSE_CASE' });
      expect(closed.caseStatus).toBe('closed');
      expect(closed.officialResult).not.toBeNull();

      const practice = gameReducer(closed, { type: 'START_PRACTICE' });
      expect(practice.mode).toBe('practice');
      expect(practice.caseStatus).toBe('active');
      expect(practice.scoreReport).toBeNull();
      expect(practice.officialResult).toEqual(closed.officialResult);
      expect(practice.activeLineIndex).toBe(0);
    });

    it('clears stage shake on CLEAR_STAGE_SHAKE', () => {
      const shakingState: GameState = {
        ...initialState,
        stageShake: true,
        agentCursor: { ...initialState.agentCursor, isShaking: true },
      };
      const cleared = gameReducer(shakingState, { type: 'CLEAR_STAGE_SHAKE' });
      expect(cleared.stageShake).toBe(false);
      expect(cleared.agentCursor.isShaking).toBe(false);
    });

    it('resets game to initial state on RESET_GAME', () => {
      const modified: GameState = {
        ...initialState,
        caseStatus: 'closed',
        currentInput: 'dirty',
      };
      const reset = gameReducer(modified, { type: 'RESET_GAME' });
      expect(reset.caseStatus).toBe('active');
      expect(reset.currentInput).toBe('');
      expect(reset.activeLineIndex).toBe(0);
    });
  });

  describe('State Immutability Invariant', () => {
    it('never mutates input state or its nested objects', () => {
      const frozenState = Object.freeze({
        ...initialState,
        microState: Object.freeze({ ...initialState.microState }),
        telegrams: Object.freeze([...initialState.telegrams]),
      }) as GameState;

      const next = gameReducer(frozenState, {
        type: 'SET_INPUT',
        payload: 'immutable test',
      });

      expect(next).not.toBe(frozenState);
      expect(next.currentInput).toBe('immutable test');
    });
  });
});
