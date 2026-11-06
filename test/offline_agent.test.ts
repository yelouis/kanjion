/**
 * test/offline_agent.test.ts
 *
 * Automated verification suite for the Standalone Offline Simulation Engine
 * and Multi-Token Heuristic Matcher on Case File #042 (Tokyo–Osaka Shinkansen).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  OfflineSimulationEngine,
  DEFAULT_WEIGHTS,
  CONFIDENCE_THRESHOLD,
} from '../src/engine/offline_simulator';
import { CASE_042_INITIAL_MICRO_STATE, CASE_042_MACRO_VIEWS } from '../src/data/puzzles/case_042';
import { ShinkansenMicroState } from '../src/types/engine';

describe('Offline Simulation Engine & Multi-Token Heuristic Matcher', () => {
  let engine: OfflineSimulationEngine;
  let microState: ShinkansenMicroState;

  beforeEach(() => {
    engine = new OfflineSimulationEngine();
    microState = { ...CASE_042_INITIAL_MICRO_STATE };
  });

  describe('Contract Adherence & Setup', () => {
    it('implements AgentExecutionConnector with custom weights and threshold', () => {
      expect(CONFIDENCE_THRESHOLD).toBe(25);
      const customEngine = new OfflineSimulationEngine(CASE_042_MACRO_VIEWS, DEFAULT_WEIGHTS, 30);
      expect(customEngine).toBeInstanceOf(OfflineSimulationEngine);
      expect(typeof customEngine.resolveInstruction).toBe('function');
    });

    it('returns CONFUSED on unknown macroViewId without throwing', () => {
      const action = engine.resolveInstruction('MV-UNKNOWN', microState, 'click green car');
      expect(action.action).toBe('CONFUSED');
      expect(action.thought).toContain('No interactive elements available');
      expect(action.thought.length).toBeLessThanOrEqual(80);
    });

    it('returns CONFUSED on empty or whitespace instructions', () => {
      const empty = engine.resolveInstruction('MV-03', microState, '');
      expect(empty.action).toBe('CONFUSED');
      expect(empty.thought).toContain('Empty instruction');

      const whitespace = engine.resolveInstruction('MV-03', microState, '     ');
      expect(whitespace.action).toBe('CONFUSED');
      expect(whitespace.thought).toContain('Empty instruction');
    });
  });

  describe('Target Disambiguation Vectors (Exhibits C & E)', () => {
    it('resolves "click green car" to #25 (Nozomi 24 Green Car, D3)', () => {
      const action = engine.resolveInstruction('MV-03', microState, 'click green car');
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#25');
      expect(action.gridRef).toBe('D3');
      expect(action.targetCoordinate).toEqual({ x: 885, y: 468 });
      expect(action.isTrap).toBe(false);
      expect(action.thought).toBe('📌 FIELD NOTE: Clicked [🍀 ◯ ¥13,870] at D3');
      expect(action.thought.length).toBeLessThanOrEqual(80);
    });

    it('resolves "select clover at D3" to #25 with maximum multi-token confidence', () => {
      const action = engine.resolveInstruction('MV-03', microState, 'select clover at D3');
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#25');
      expect(action.gridRef).toBe('D3');
      expect(action.targetCoordinate?.x).toBe(885);
      expect(action.targetCoordinate?.y).toBe(468);
      expect(action.thought.length).toBeLessThanOrEqual(80);
    });

    it('resolves "choose 🍀 Nozomi seat in row 2" with emoji glyph to #25', () => {
      const action = engine.resolveInstruction('MV-03', microState, 'choose 🍀 Nozomi seat in row 2');
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#25');
      expect(action.gridRef).toBe('D3');
    });

    it('resolves uppercase "CLICK CLOVER" to #25 (case-insensitive keyword matching)', () => {
      const action = engine.resolveInstruction('MV-03', microState, 'CLICK CLOVER');
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#25');
      expect(action.gridRef).toBe('D3');
    });

    it('resolves "blue confirm at D4" to #30 (Confirmation CTA)', () => {
      const action = engine.resolveInstruction('MV-03', microState, 'blue confirm at D4');
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#30');
      expect(action.gridRef).toBe('D4');
      expect(action.targetCoordinate).toEqual({ x: 905, y: 720 });
      expect(action.isTrap).toBe(false);
      expect(action.thought).toBe('📌 FIELD NOTE: Clicked [予約内容を確認・確定へ ▶] at D4');
      expect(action.thought.length).toBeLessThanOrEqual(80);
    });

    it('resolves "press ▶ to proceed" to #30', () => {
      const action = engine.resolveInstruction('MV-03', microState, 'press ▶ to proceed');
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#30');
      expect(action.gridRef).toBe('D4');
    });

    it('resolves "confirm booking" to #30', () => {
      const action = engine.resolveInstruction('MV-03', microState, 'confirm booking');
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#30');
      expect(action.gridRef).toBe('D4');
    });
  });

  describe('Decoy & Trap Vectors (Exhibit D Contamination)', () => {
    it('resolves "red button" to #12 (Promotional Insurance Banner Red Button)', () => {
      const action = engine.resolveInstruction('MV-03', microState, 'red button');
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#12');
      expect(action.gridRef).toBe('D1');
      expect(action.targetCoordinate).toEqual({ x: 887, y: 109 });
      expect(action.isTrap).toBe(true);
      expect(action.thought).toBe('📌 FIELD NOTE: Clicked [今すぐ申し込む] at D1');
      expect(action.thought.length).toBeLessThanOrEqual(80);
    });

    it('resolves "apply for promo insurance" to #12', () => {
      const action = engine.resolveInstruction('MV-03', microState, 'apply for promo insurance');
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#12');
      expect(action.gridRef).toBe('D1');
      expect(action.isTrap).toBe(true);
    });

    it('resolves "check insurance" to #28 (Insurance Checkbox, B4)', () => {
      const action = engine.resolveInstruction('MV-03', microState, 'check insurance');
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#28');
      expect(action.gridRef).toBe('B4');
      expect(action.targetCoordinate).toEqual({ x: 400, y: 718 });
      expect(action.isTrap).toBe(true);
      expect(action.thought).toBe('📌 FIELD NOTE: Checked [旅行キャンセル保険を追加] at B4');
      expect(action.thought.length).toBeLessThanOrEqual(80);
    });

    it('handles insurance toggle note when already checked', () => {
      const checkedState: ShinkansenMicroState = {
        ...microState,
        insuranceCheckboxChecked: true,
      };
      const action = engine.resolveInstruction('MV-03', checkedState, 'check insurance');
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#28');
      expect(action.thought).toBe('📌 FIELD NOTE: Unchecked [旅行キャンセル保険を追加] at B4');
    });

    it('resolves "logout" to #11 (Header logout trap)', () => {
      const action = engine.resolveInstruction('MV-03', microState, 'logout');
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#11');
      expect(action.gridRef).toBe('D1');
      expect(action.isTrap).toBe(true);
      expect(action.thought).toBe('📌 FIELD NOTE: Clicked [ログアウト] at D1');
      expect(action.thought.length).toBeLessThanOrEqual(80);
    });
  });

  describe('Non-Target Seat & Navigation Elements', () => {
    it('resolves "hikari 515 non-reserved seat" to #21 (B2)', () => {
      const action = engine.resolveInstruction('MV-03', microState, 'hikari 515 non-reserved seat');
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#21');
      expect(action.gridRef).toBe('B2');
      expect(action.targetCoordinate).toEqual({ x: 425, y: 276 });
      expect(action.thought).toContain('ひかり自由席');
    });

    it('resolves "triangle seat at C2" to #22 (Hikari Reserved, C2)', () => {
      const action = engine.resolveInstruction('MV-03', microState, 'triangle seat at C2');
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#22');
      expect(action.gridRef).toBe('C2');
      expect(action.targetCoordinate).toEqual({ x: 635, y: 276 });
      expect(action.thought).toContain('ひかり指定席');
    });

    it('resolves "nozomi 24 unreserved at B3" to #23 (B3)', () => {
      const action = engine.resolveInstruction('MV-03', microState, 'nozomi 24 unreserved at B3');
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#23');
      expect(action.gridRef).toBe('B3');
      expect(action.targetCoordinate).toEqual({ x: 425, y: 466 });
      expect(action.thought).toContain('のぞみ自由席');
    });

    it('resolves "nozomi 24 reserved at C3" to #24 (C3)', () => {
      const action = engine.resolveInstruction('MV-03', microState, 'nozomi 24 reserved at C3');
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#24');
      expect(action.gridRef).toBe('C3');
      expect(action.targetCoordinate).toEqual({ x: 635, y: 466 });
      expect(action.thought).toContain('のぞみ指定席');
    });

    it('resolves "back to search conditions" to #14 (A2)', () => {
      const action = engine.resolveInstruction('MV-03', microState, 'back to search conditions');
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#14');
      expect(action.gridRef).toBe('A2');
      expect(action.targetCoordinate).toEqual({ x: 128, y: 244 });
      expect(action.thought).toContain('条件変更へ戻る');
    });

    it('resolves "cancel reservation" to #29 (C4)', () => {
      const action = engine.resolveInstruction('MV-03', microState, 'cancel reservation');
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#29');
      expect(action.gridRef).toBe('C4');
      expect(action.targetCoordinate).toEqual({ x: 705, y: 720 });
      expect(action.thought).toContain('予約を取消');
    });
  });

  describe('Fallback Confusion & Recovery Rules', () => {
    it('returns CONFUSED on ungrounded/nonsense instruction', () => {
      const action = engine.resolveInstruction('MV-03', microState, 'do a backflip into hyperspace');
      expect(action.action).toBe('CONFUSED');
      expect(action.thought).toContain('Instruction unclear');
      expect(action.targetId).toBeUndefined();
      expect(action.thought.length).toBeLessThanOrEqual(80);
    });

    it('returns CONFUSED on multi-target collision tie ("click 13870")', () => {
      // 13870 appears in #21, #23, and #25 with equal weight 25
      const action = engine.resolveInstruction('MV-03', microState, 'click 13870');
      expect(action.action).toBe('CONFUSED');
      expect(action.thought).toContain('Ambiguous match between Hikari & Nozomi fares');
      expect(action.thought.length).toBeLessThanOrEqual(80);
    });

    it('handles maximum 60-character instruction at boundary without crashing', () => {
      const longInstruction = 'click green clover 13870 button in 2nd row for nozomi 24 now!';
      const clamped = longInstruction.slice(0, 60);
      const action = engine.resolveInstruction('MV-03', microState, clamped);
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#25');
      expect(action.thought.length).toBeLessThanOrEqual(80);
    });
  });

  describe('Heuristic Scoring Breakdown Diagnostics', () => {
    it('calculates score breakdowns for all elements on "select clover at D3"', () => {
      const mv03 = CASE_042_MACRO_VIEWS.find((mv) => mv.id === 'MV-03')!;
      const scores = engine.scoreElements(mv03.elements, 'select clover at D3', microState);
      expect(scores.length).toBe(11);

      const targetScore = scores.find((s) => s.element.id === 25)!;
      expect(targetScore.breakdown.coord).toBe(50);
      expect(targetScore.breakdown.glyph).toBe(35);
      expect(targetScore.totalScore).toBeGreaterThanOrEqual(85);
    });
  });
});
