/**
 * test/adversarial_scoring_reducer.test.ts
 *
 * EMPIRICAL ADVERSARIAL STRESS TEST SUITE — MILESTONE 2
 * Focus: Scoring & State Reducer Engines
 *
 * Attack Vectors:
 * 1. Multiplier Math Edge Cases:
 *    - Exact lines 0 to 6, >6 lines used, negative lines used, non-integer inputs.
 *    - Clamping invariants: 1.0x <= M <= 2.0x, 0 <= finalScore <= 200 PTS.
 * 2. Floating Point Drift Verification:
 *    - Demonstration of naive IEEE-754 drift (1.0 + 2 * 0.2 === 1.4000000000000001 !== 1.4).
 *    - Empirical proof that engine eliminates drift: exactly 1.0, 1.2, 1.4, 1.6, 1.8, 2.0.
 *    - Formatting verification: "${multiplier.toFixed(1)}x" never produces trailing drift strings.
 * 3. Trap Contamination Permanence:
 *    - Clicking Trap #12 (Red Promo Banner) permanently contaminates Exhibit D.
 *    - Toggling Checkbox #28 OFF subsequently does NOT un-contaminate Exhibit D.
 *    - Toggling Checkbox #28 ON then OFF permanently contaminates Exhibit D.
 *    - Multiple toggles of #28 back and forth maintain contamination.
 *    - Subsequent legitimate actions (#25, #30) cannot wash or launder contamination.
 * 4. Exhibit Redaction During Active Play:
 *    - Verification across ALL reducer action branches (SET_INPUT, START_EXECUTION, APPLY_AGENT_ACTION lines 1-5,
 *      TOGGLE_GHOST_REPLAY, TOGGLE_SOM_OVERLAY, CLEAR_STAGE_SHAKE).
 *    - Assertion that scoreReport is strictly null throughout active play.
 *    - Assertion that all telegram ledger rows maintain exhibitRedactedStatus: 'SEALED'.
 *    - Full JSON state serialization audit: zero leakage of stamp statuses ('VERIFIED', 'CONTAMINATED', 'MISSED', 'CLEAN').
 *    - Practice mode REOPEN_CASE re-seals dossier and wipes scoreReport back to null.
 * 5. Automatic Case Closure on Line 06 Execution:
 *    - Both unseeded (dispatches 1..6) and pre-seeded (dispatches 3..6) flows.
 *    - Dispatches 1..5 remain active with scoreReport = null.
 *    - Line 06 dispatch atomically triggers caseStatus: 'closed' and populates scoreReport (linesUsed=6, unusedLines=0, M=1.0x).
 *    - Post-closure immutability: subsequent inputs and dispatches are strictly rejected.
 * 6. Reducer Invariance & Adversarial Fuzzing:
 *    - Deeply frozen state objects never mutated in-place.
 *    - Malformed target IDs (#NaN, #foo, empty, out-of-bounds) resolve gracefully without exceptions.
 *    - Thought note truncation strictly <= 80 characters.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateEfficiencyMultiplier,
  calculateFinalScore,
  generateShareableClipping,
  evaluateExhibit,
  evaluateAllExhibits,
} from '../src/engine/scoring';
import {
  gameReducer,
  createInitialGameState,
  reduceShinkansenMicroState,
} from '../src/engine/game_reducer';
import {
  CASE_042_EXHIBITS,
  CASE_042_INITIAL_MICRO_STATE,
} from '../src/data/puzzles/case_042';
import { AgentAction } from '../src/types/engine';

describe('Adversarial Challenge Vector 1: Multiplier Math Edge Cases', () => {
  it('correctly maps 1 to 6 lines used to expected multiplier curve', () => {
    const expected = [
      { linesUsed: 1, expectedUnused: 5, expectedMultiplier: 2.0 },
      { linesUsed: 2, expectedUnused: 4, expectedMultiplier: 1.8 },
      { linesUsed: 3, expectedUnused: 3, expectedMultiplier: 1.6 },
      { linesUsed: 4, expectedUnused: 2, expectedMultiplier: 1.4 },
      { linesUsed: 5, expectedUnused: 1, expectedMultiplier: 1.2 },
      { linesUsed: 6, expectedUnused: 0, expectedMultiplier: 1.0 },
    ];

    for (const { linesUsed, expectedUnused, expectedMultiplier } of expected) {
      const res = calculateEfficiencyMultiplier(linesUsed);
      expect(res.unusedLines).toBe(expectedUnused);
      expect(res.multiplier).toBe(expectedMultiplier);
    }
  });

  it('bounds 0 lines used to max multiplier 2.0x without exceeding caps', () => {
    const res = calculateEfficiencyMultiplier(0);
    expect(res.unusedLines).toBe(6);
    expect(res.multiplier).toBe(2.0); // Capped at 2.0x
  });

  it('bounds >6 lines used to 1.0x multiplier and 0 unused lines', () => {
    const cases = [7, 8, 12, 100, 999999];
    for (const lines of cases) {
      const res = calculateEfficiencyMultiplier(lines);
      expect(res.unusedLines).toBe(0);
      expect(res.multiplier).toBe(1.0);
    }
  });

  it('bounds negative lines used to 0 clamped lines and 2.0x multiplier', () => {
    const cases = [-1, -5, -999];
    for (const lines of cases) {
      const res = calculateEfficiencyMultiplier(lines);
      expect(res.multiplier).toBe(2.0);
      expect(res.unusedLines).toBe(6);
    }
  });

  it('clamps final scores strictly within [0, 200] PTS range for extreme values', () => {
    // Standard ranges
    expect(calculateFinalScore(100, 2.0)).toBe(200);
    expect(calculateFinalScore(100, 1.0)).toBe(100);
    expect(calculateFinalScore(0, 2.0)).toBe(0);
    expect(calculateFinalScore(50, 1.5)).toBe(75);

    // Rounding verification
    // 85 * 1.4 = 119
    expect(calculateFinalScore(85, 1.4)).toBe(119);
    // 85 * 1.6 = 136
    expect(calculateFinalScore(85, 1.6)).toBe(136);
    // 75 * 1.8 = 135
    expect(calculateFinalScore(75, 1.8)).toBe(135);

    // Extreme out-of-bounds inputs
    expect(calculateFinalScore(150, 2.0)).toBe(200); // Exceeds 200 PTS cap
    expect(calculateFinalScore(500, 3.0)).toBe(200);
    expect(calculateFinalScore(-50, 1.4)).toBe(0);   // Below 0 PTS floor
  });
});

describe('Adversarial Challenge Vector 2: Floating Point Drift Verification', () => {
  it('empirically proves that naive JavaScript floating point math introduces drift', () => {
    // 1. Multiplying 0.2 * 3 produces 0.6000000000000001 instead of 0.6
    const bonusBonus = 0.2 * 3;
    expect(bonusBonus === 0.6).toBe(false);
    expect(bonusBonus.toString()).toBe('0.6000000000000001');

    // 2. Iterative addition of 0.2 bonus produces 1.5999999999999999 instead of 1.6
    let iterativeBonus = 1.0;
    for (let i = 0; i < 3; i++) iterativeBonus += 0.2;
    expect(iterativeBonus === 1.6).toBe(false);
    expect(iterativeBonus.toString()).toBe('1.5999999999999999');
  });

  it('empirically proves that scoring engine completely eliminates IEEE float drift', () => {
    // Engine must produce exact clean float values
    for (let lines = 1; lines <= 6; lines++) {
      const { multiplier } = calculateEfficiencyMultiplier(lines);
      const str = multiplier.toString();

      // Must not contain trailing float noise (e.g. .000000000000003 or .999999999999999)
      expect(str).not.toMatch(/\.0{5,}[0-9]+/);
      expect(str).not.toMatch(/\.9{5,}[0-9]+/);

      // Must be an exact multiple of 0.2
      const decPart = Math.round(multiplier * 10);
      expect([10, 12, 14, 16, 18, 20]).toContain(decPart);
    }

    // Specifically verify 4 lines used (where naive math fails)
    const { multiplier: m4 } = calculateEfficiencyMultiplier(4);
    expect(m4).toBe(1.4);
    expect(m4.toString()).toBe('1.4');
    expect(m4 === 1.4).toBe(true);

    // Specifically verify 5 lines used
    const { multiplier: m5 } = calculateEfficiencyMultiplier(5);
    expect(m5).toBe(1.2);
    expect(m5.toString()).toBe('1.2');

    // Specifically verify 3 lines used
    const { multiplier: m3 } = calculateEfficiencyMultiplier(3);
    expect(m3).toBe(1.6);
    expect(m3.toString()).toBe('1.6');

    // Specifically verify 2 lines used
    const { multiplier: m2 } = calculateEfficiencyMultiplier(2);
    expect(m2).toBe(1.8);
    expect(m2.toString()).toBe('1.8');
  });

  it('ensures shareable clipping text formats multipliers to exactly one decimal without drift', () => {
    const mockEvals = evaluateAllExhibits(CASE_042_EXHIBITS, CASE_042_INITIAL_MICRO_STATE);

    for (let lines = 1; lines <= 6; lines++) {
      const { multiplier } = calculateEfficiencyMultiplier(lines);
      const clipping = generateShareableClipping({
        caseNumber: '#042',
        closenessScore: 100,
        multiplier,
        finalScore: calculateFinalScore(100, multiplier),
        linesUsed: lines,
        evaluations: mockEvals,
      });

      // Matches pattern e.g. "× 1.4x =" or "× 2.0x ="
      expect(clipping).toMatch(/× [12]\.[02468]x =/);
      expect(clipping).not.toContain('.00000000000000');
      expect(clipping).not.toContain('.39999999999999');
    }
  });
});

describe('Adversarial Challenge Vector 3: Trap Contamination Permanence', () => {
  it('permanently contaminates Exhibit D when Trap #12 is triggered, even if #28 is subsequently untoggled', () => {
    let state = createInitialGameState({ preSeeded: true });

    // Step 1: Agent clicks Trap #12 (Red Promo Banner)
    const trapAction: AgentAction = {
      action: 'CLICK',
      targetId: '#12',
      gridRef: 'D1',
      thought: 'Clicked promo banner',
      isTrap: true,
    };

    state = gameReducer(state, {
      type: 'APPLY_AGENT_ACTION',
      payload: { action: trapAction, instruction: 'click promo banner' },
    });

    expect(state.microState.insuranceTrapHit).toBe(true);
    expect(state.microState.insuranceCheckboxChecked).toBe(true);
    expect(state.stageShake).toBe(true);

    // Verify Exhibit D is CONTAMINATED at this stage
    const evalDuring = evaluateExhibit(CASE_042_EXHIBITS[3], state.microState, 3);
    expect(evalDuring.status).toBe('CONTAMINATED');
    expect(evalDuring.awardedPoints).toBe(0);

    // Step 2: Player attempts to fix the mistake by untoggling checkbox #28
    const untoggleAction: AgentAction = {
      action: 'CLICK',
      targetId: '#28',
      gridRef: 'B4',
      thought: 'Untoggled insurance checkbox',
    };

    state = gameReducer(state, {
      type: 'APPLY_AGENT_ACTION',
      payload: { action: untoggleAction, instruction: 'uncheck insurance' },
    });

    // Checkbox is now unchecked in the UI
    expect(state.microState.insuranceCheckboxChecked).toBe(false);
    // CRITICAL SECURITY INVARIANT: insuranceTrapHit MUST REMAIN TRUE PERMANENTLY
    expect(state.microState.insuranceTrapHit).toBe(true);

    // Verify Exhibit D CANNOT be cleaned
    const evalAfterUntoggle = evaluateExhibit(CASE_042_EXHIBITS[3], state.microState, 3);
    expect(evalAfterUntoggle.status).toBe('CONTAMINATED');
    expect(evalAfterUntoggle.stampText).toBe('[CONTAMINATED ✗ +0%]');
    expect(evalAfterUntoggle.awardedPoints).toBe(0);

    // Step 3: Player tries to toggle #28 on and off multiple times
    for (let i = 0; i < 4; i++) {
      state = gameReducer(state, {
        type: 'APPLY_AGENT_ACTION',
        payload: { action: untoggleAction, instruction: `toggle ${i}` },
      });
      // Exhibit D MUST REMAIN CONTAMINATED regardless of parity
      const evalLoop = evaluateExhibit(CASE_042_EXHIBITS[3], state.microState, 3);
      expect(evalLoop.status).toBe('CONTAMINATED');
      expect(state.microState.insuranceTrapHit).toBe(true);
    }
  });

  it('permanently contaminates Exhibit D when Checkbox #28 is checked then unchecked without touching #12', () => {
    let state = createInitialGameState({ preSeeded: true });

    // Initial check: Exhibit D is clean
    expect(state.microState.insuranceTrapHit).toBe(false);
    expect(state.microState.insuranceCheckboxChecked).toBe(false);
    const evalInitial = evaluateExhibit(CASE_042_EXHIBITS[3], state.microState, 3);
    expect(evalInitial.status).toBe('CLEAN');
    expect(evalInitial.awardedPoints).toBe(15);

    // 1. Check checkbox #28
    const chkAction: AgentAction = { action: 'CLICK', targetId: '#28', gridRef: 'B4', thought: 'check box' };
    state = gameReducer(state, {
      type: 'APPLY_AGENT_ACTION',
      payload: { action: chkAction, instruction: 'check box' },
    });
    expect(state.microState.insuranceCheckboxChecked).toBe(true);
    expect(state.microState.insuranceTrapHit).toBe(true);

    // 2. Uncheck checkbox #28
    state = gameReducer(state, {
      type: 'APPLY_AGENT_ACTION',
      payload: { action: chkAction, instruction: 'uncheck box' },
    });
    expect(state.microState.insuranceCheckboxChecked).toBe(false);
    // Must remain poisoned
    expect(state.microState.insuranceTrapHit).toBe(true);

    const evalFinal = evaluateExhibit(CASE_042_EXHIBITS[3], state.microState, 3);
    expect(evalFinal.status).toBe('CONTAMINATED');
    expect(evalFinal.awardedPoints).toBe(0);
  });

  it('verifies legitimate actions (#25 Green Car, #30 Confirm) cannot wash trap contamination', () => {
    let state = createInitialGameState({ preSeeded: true });

    // Poison state
    state = gameReducer(state, {
      type: 'APPLY_AGENT_ACTION',
      payload: {
        action: { action: 'CLICK', targetId: '#12', thought: 'banner trap', isTrap: true },
        instruction: 'click promo',
      },
    });

    // Execute winning targets
    state = gameReducer(state, {
      type: 'APPLY_AGENT_ACTION',
      payload: {
        action: { action: 'CLICK', targetId: '#25', thought: 'green car' },
        instruction: 'click green car',
      },
    });

    state = gameReducer(state, {
      type: 'APPLY_AGENT_ACTION',
      payload: {
        action: { action: 'CLICK', targetId: '#30', thought: 'confirm booking' },
        instruction: 'confirm',
      },
    });

    // Close case
    state = gameReducer(state, { type: 'CLOSE_CASE' });

    expect(state.scoreReport).not.toBeNull();
    // Closeness must be exactly 85% (100% - 15% Exhibit D)
    expect(state.scoreReport?.closenessScore).toBe(85);

    const evalD = state.scoreReport?.exhibitEvaluations.find((e) => e.id === 'exhibit_d');
    expect(evalD?.status).toBe('CONTAMINATED');
    expect(evalD?.awardedPoints).toBe(0);
    expect(state.scoreReport?.emojiRow).toBe('🟩🟩🟩🟥🟩');
  });
});

describe('Adversarial Challenge Vector 4: Exhibit Redaction During Active Play', () => {
  it('guarantees scoreReport is strictly null across all active gameplay actions', () => {
    let state = createInitialGameState({ preSeeded: false });
    expect(state.scoreReport).toBeNull();

    // 1. SET_INPUT
    state = gameReducer(state, { type: 'SET_INPUT', payload: 'type something' });
    expect(state.scoreReport).toBeNull();

    // 2. START_EXECUTION
    state = gameReducer(state, { type: 'START_EXECUTION' });
    expect(state.scoreReport).toBeNull();

    // 3. APPLY_AGENT_ACTION across lines 1 through 5
    for (let line = 0; line < 5; line++) {
      state = gameReducer(state, {
        type: 'APPLY_AGENT_ACTION',
        payload: {
          action: { action: 'CLICK', targetId: '#25', thought: `action ${line + 1}` },
          instruction: `line ${line + 1}`,
        },
      });
      // MUST REMAIN NULL
      expect(state.scoreReport).toBeNull();
      expect(state.caseStatus).toBe('active');
    }

    // 4. TOGGLE_GHOST_REPLAY
    state = gameReducer(state, { type: 'TOGGLE_GHOST_REPLAY' });
    expect(state.scoreReport).toBeNull();

    // 5. TOGGLE_SOM_OVERLAY
    state = gameReducer(state, { type: 'TOGGLE_SOM_OVERLAY' });
    expect(state.scoreReport).toBeNull();

    // 6. CLEAR_STAGE_SHAKE
    state = gameReducer(state, { type: 'CLEAR_STAGE_SHAKE' });
    expect(state.scoreReport).toBeNull();
  });

  it('guarantees all submitted telegram lines maintain exhibitRedactedStatus: SEALED during active play', () => {
    let state = createInitialGameState({ preSeeded: false });

    for (let line = 0; line < 5; line++) {
      state = gameReducer(state, {
        type: 'APPLY_AGENT_ACTION',
        payload: {
          action: { action: 'CLICK', targetId: '#25', thought: `thought ${line + 1}` },
          instruction: `dispatch line ${line + 1}`,
        },
      });

      for (let i = 0; i <= line; i++) {
        expect(state.telegrams[i].submitted).toBe(true);
        expect(state.telegrams[i].exhibitRedactedStatus).toBe('SEALED');
      }
      for (let i = line + 1; i < 6; i++) {
        expect(state.telegrams[i].submitted).toBe(false);
        expect(state.telegrams[i].exhibitRedactedStatus).toBe('SEALED');
      }
    }
  });

  it('guarantees serialized GameState contains zero unsealed exhibit stamp leakages during active play', () => {
    let state = createInitialGameState({ preSeeded: true });

    // Execute target action #25 (satisfies Exhibit C)
    state = gameReducer(state, {
      type: 'APPLY_AGENT_ACTION',
      payload: {
        action: { action: 'CLICK', targetId: '#25', thought: 'target 25' },
        instruction: 'click clover',
      },
    });

    const serialized = JSON.stringify(state);

    // Adversarial scan: none of these evaluation strings should appear anywhere in state
    expect(serialized).not.toContain('VERIFIED');
    expect(serialized).not.toContain('CONTAMINATED');
    expect(serialized).not.toContain('MISSED');
    expect(serialized).not.toContain('[VERIFIED');
    expect(serialized).not.toContain('[CLEAN');
    expect(serialized).not.toContain('[MISSED');
    expect(serialized).not.toContain('[CONTAMINATED');
    expect(serialized).not.toContain('awardedPoints');
  });

  it('wipes scoreReport and re-seals dossier when REOPEN_CASE is triggered', () => {
    let state = createInitialGameState({ preSeeded: true });
    state = gameReducer(state, { type: 'CLOSE_CASE' });
    expect(state.caseStatus).toBe('closed');
    expect(state.scoreReport).not.toBeNull();

    // Reopen case file for practice mode
    state = gameReducer(state, { type: 'REOPEN_CASE' });
    expect(state.caseStatus).toBe('active');
    expect(state.scoreReport).toBeNull();

    // Telegram lines remain sealed
    for (const t of state.telegrams) {
      expect(t.exhibitRedactedStatus).toBe('SEALED');
    }
  });
});

describe('Adversarial Challenge Vector 5: Automatic Case Closure on Line 06 Execution', () => {
  it('automatically triggers case closure on 6th dispatch in unseeded mode with 1.0x multiplier', () => {
    let state = createInitialGameState({ preSeeded: false });
    expect(state.activeLineIndex).toBe(0);

    // Dispatches 1 through 5
    for (let i = 0; i < 5; i++) {
      expect(state.caseStatus).toBe('active');
      expect(state.activeLineIndex).toBe(i);
      state = gameReducer(state, {
        type: 'APPLY_AGENT_ACTION',
        payload: {
          action: { action: 'CLICK', targetId: '#25', thought: `turn ${i + 1}` },
          instruction: `instruction ${i + 1}`,
        },
      });
      expect(state.caseStatus).toBe('active');
      expect(state.scoreReport).toBeNull();
    }

    // Dispatch 6 (Line 06: Final Line)
    expect(state.activeLineIndex).toBe(5);
    state = gameReducer(state, {
      type: 'APPLY_AGENT_ACTION',
      payload: {
        action: { action: 'CLICK', targetId: '#30', thought: 'final confirm' },
        instruction: 'confirm at D4',
      },
    });

    // Verification of automatic closure
    expect(state.caseStatus).toBe('closed');
    expect(state.activeLineIndex).toBe(5); // Retained at 5
    expect(state.scoreReport).not.toBeNull();
    expect(state.scoreReport?.linesUsed).toBe(6);
    expect(state.scoreReport?.unusedLines).toBe(0);
    expect(state.scoreReport?.multiplier).toBe(1.0);
    expect(state.scoreReport?.shareableClipping).toContain('(6/6 Telegrams Sent)');
    expect(state.scoreReport?.shareableClipping).toContain('× 1.0x =');
  });

  it('automatically triggers case closure on 6th dispatch in pre-seeded mode', () => {
    let state = createInitialGameState({ preSeeded: true });
    expect(state.activeLineIndex).toBe(2); // Line 03 active

    // Line 03, 04, 05
    for (let i = 2; i < 5; i++) {
      state = gameReducer(state, {
        type: 'APPLY_AGENT_ACTION',
        payload: {
          action: { action: 'CLICK', targetId: '#25', thought: `turn ${i + 1}` },
          instruction: `line ${i + 1}`,
        },
      });
      expect(state.caseStatus).toBe('active');
      expect(state.scoreReport).toBeNull();
    }

    // Line 06
    expect(state.activeLineIndex).toBe(5);
    state = gameReducer(state, {
      type: 'APPLY_AGENT_ACTION',
      payload: {
        action: { action: 'CLICK', targetId: '#30', thought: 'final line 6' },
        instruction: 'final line 6',
      },
    });

    expect(state.caseStatus).toBe('closed');
    expect(state.scoreReport).not.toBeNull();
    expect(state.scoreReport?.linesUsed).toBe(6);
    expect(state.scoreReport?.unusedLines).toBe(0);
    expect(state.scoreReport?.multiplier).toBe(1.0);
  });

  it('strictly freezes game state after Line 06 closure: rejects subsequent inputs and dispatches', () => {
    let state = createInitialGameState({ preSeeded: true });

    // Advance to line 06 closure
    for (let i = 2; i <= 5; i++) {
      state = gameReducer(state, {
        type: 'APPLY_AGENT_ACTION',
        payload: {
          action: { action: 'CLICK', targetId: '#25', thought: `turn ${i + 1}` },
          instruction: `line ${i + 1}`,
        },
      });
    }

    expect(state.caseStatus).toBe('closed');
    const closedSnapshot = { ...state };

    // 1. Attempt SET_INPUT
    const inputAttempt = gameReducer(state, { type: 'SET_INPUT', payload: 'hack the box' });
    expect(inputAttempt).toEqual(closedSnapshot);
    expect(inputAttempt.currentInput).toBe('');

    // 2. Attempt START_EXECUTION
    const startAttempt = gameReducer(state, { type: 'START_EXECUTION' });
    expect(startAttempt.isExecuting).toBe(false);

    // 3. Attempt APPLY_AGENT_ACTION
    const actionAttempt = gameReducer(state, {
      type: 'APPLY_AGENT_ACTION',
      payload: {
        action: { action: 'CLICK', targetId: '#30', thought: 'illegal 7th action' },
        instruction: 'line 7',
      },
    });
    expect(actionAttempt).toEqual(closedSnapshot);

    // 4. Attempt redundant CLOSE_CASE
    const closeAttempt = gameReducer(state, { type: 'CLOSE_CASE' });
    expect(closeAttempt).toEqual(closedSnapshot);
  });
});

describe('Adversarial Challenge Vector 6: Reducer Invariance & Resilient Error Handling', () => {
  it('strictly preserves immutability of deeply frozen GameState', () => {
    const rawState = createInitialGameState({ preSeeded: true });
    // Deep freeze
    Object.freeze(rawState);
    Object.freeze(rawState.microState);
    Object.freeze(rawState.telegrams);
    Object.freeze(rawState.agentCursor);

    // Must not throw mutation error
    const nextState = gameReducer(rawState, {
      type: 'SET_INPUT',
      payload: 'deep freeze test',
    });

    expect(nextState).not.toBe(rawState);
    expect(nextState.currentInput).toBe('deep freeze test');
  });

  it('handles malformed, invalid, or out-of-bounds target IDs gracefully', () => {
    const state = createInitialGameState({ preSeeded: true });

    const malformedActions: AgentAction[] = [
      { action: 'CLICK', targetId: '#999999', thought: 'nonexistent target' },
      { action: 'CLICK', targetId: '#abc_not_a_number', thought: 'string id' },
      { action: 'CLICK', targetId: '', thought: 'empty id' },
      { action: 'CONFUSED', thought: 'agent confused' },
      { action: 'SCROLL', scrollDirection: 'down', thought: 'scrolling down' },
    ];

    for (const act of malformedActions) {
      expect(() => {
        const res = reduceShinkansenMicroState(state.microState, act);
        expect(res.nextState).toBeDefined();
        expect(typeof res.summary).toBe('string');
      }).not.toThrow();

      expect(() => {
        const next = gameReducer(state, {
          type: 'APPLY_AGENT_ACTION',
          payload: { action: act, instruction: 'malformed instruction' },
        });
        expect(next).toBeDefined();
      }).not.toThrow();
    }
  });

  it('enforces strict thought note truncation at <= 80 characters under adversarial spam', () => {
    let state = createInitialGameState({ preSeeded: true });
    const spamThought = 'X'.repeat(300);

    state = gameReducer(state, {
      type: 'APPLY_AGENT_ACTION',
      payload: {
        action: { action: 'CLICK', targetId: '#25', thought: spamThought },
        instruction: 'spam',
      },
    });

    expect(state.agentCursor.thought.length).toBeLessThanOrEqual(80);
    expect(state.agentCursor.thought).toBe('X'.repeat(80));
  });

  it('maintains idempotence on rapid toggle actions', () => {
    let state = createInitialGameState({ preSeeded: true });

    // Ghost replay toggles
    for (let i = 0; i < 10; i++) {
      state = gameReducer(state, { type: 'TOGGLE_GHOST_REPLAY' });
      expect(state.ghostReplayActive).toBe(i % 2 === 0);
    }
    expect(state.ghostReplayActive).toBe(false);

    // SoM overlay toggles
    for (let i = 0; i < 10; i++) {
      state = gameReducer(state, { type: 'TOGGLE_SOM_OVERLAY' });
      expect(state.somOverlayActive).toBe(i % 2 === 0);
    }
    expect(state.somOverlayActive).toBe(false);
  });
});
