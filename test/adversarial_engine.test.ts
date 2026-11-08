/**
 * test/adversarial_engine.test.ts
 *
 * Empirical Adversarial Challenge Suite for Milestone 2:
 * Stress-testing OfflineSimulationEngine and CloudVisionConnector across:
 * 1. Complex ambiguous natural language instructions & negation.
 * 2. Edge cases in multi-token heuristic scoring (ties, negative tokens, noise).
 * 3. Rapid state transitions, out-of-order macro-views, and edge cache state hashes.
 * 4. Guardrail evasion attempts (synthetic ID filters, fullwidth unicode, sub-number collisions, DOM sanitization).
 * 5. Malformed LLM outputs and thought note length contract invariants.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  OfflineSimulationEngine,
} from '../src/engine/offline_simulator';
import {
  CloudVisionConnector,
  filterPromptSyntheticIds,
  sanitizeDomForClient,
  assertGoalBlindness,
  buildMultimodalPrompt,
  validateLLMOutput,
  MemoryKVCache,
  MockVisionLLMTransport,
} from '../src/engine/cloud_connector';
import {
  CASE_001_INITIAL_MICRO_STATE,
  CASE_001_MACRO_VIEWS,
  CASE_001_MV03_ELEMENTS,
} from '../src/data/puzzles/case_001';
import { ShinkansenMicroState, LLMDecisionResponse } from '../src/types/engine';

describe('Milestone 2 Adversarial Challenge Suite', () => {
  let offlineEngine: OfflineSimulationEngine;
  let microState: ShinkansenMicroState;

  beforeEach(() => {
    offlineEngine = new OfflineSimulationEngine();
    microState = { ...CASE_001_INITIAL_MICRO_STATE };
  });

  // =========================================================================
  // ATTACK VECTOR 1: Complex Ambiguous Instructions & Negation Semantics
  // =========================================================================
  describe('Vector 1: Ambiguous NLP Instructions & Negation Semantics', () => {
    it('empirically demonstrates lack of negation handling (user says "avoid red button" -> clicks trap #12)', () => {
      // In natural language, "avoid red button" means DO NOT CLICK.
      // But the heuristic matcher scores "red" (30) and "button" (15) for #12 without negative polarity penalty.
      const action = offlineEngine.resolveInstruction('MV-03', microState, 'avoid red button');
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#12');
      expect(action.isTrap).toBe(true);
    });

    it('empirically demonstrates negation on target ("do not click clover" -> clicks target #25)', () => {
      const action = offlineEngine.resolveInstruction('MV-03', microState, 'do not click clover');
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#25');
    });

    it('empirically demonstrates negation on logout trap ("never logout" -> clicks trap #11)', () => {
      const action = offlineEngine.resolveInstruction('MV-03', microState, 'never logout');
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#11');
      expect(action.isTrap).toBe(true);
    });

    it('resolves conflicting targets based on higher weighted tokens ("click clover and logout")', () => {
      // #25 matches "clover" (35)
      // #11 matches "logout" (30)
      const action = offlineEngine.resolveInstruction('MV-03', microState, 'click clover and logout');
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#25'); // Clover (35) > Logout (30)
    });

    it('tolerates embedded distractor noise words without losing target', () => {
      const noisy = 'please agent just click clover at D3 right now thanks';
      const action = offlineEngine.resolveInstruction('MV-03', microState, noisy);
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#25');
      expect(action.gridRef).toBe('D3');
    });

    it('safely returns CONFUSED when conflicting coordinate contradicts glyph ("click clover at B2")', () => {
      // Clover has glyph (35) + label (15) = 50 on #25.
      // B2 has coordinate (50) on #21.
      // Both elements tie at exactly 50 points, so the engine detects the ambiguity and returns CONFUSED!
      const action = offlineEngine.resolveInstruction('MV-03', microState, 'click clover at B2');
      expect(action.action).toBe('CONFUSED');
      expect(action.thought).toContain('Ambiguous match');
    });
  });

  // =========================================================================
  // ATTACK VECTOR 2: Edge Cases in Multi-Token Heuristic Scoring & Ties
  // =========================================================================
  describe('Vector 2: Multi-Token Heuristic Scoring Edge Cases & Ties', () => {
    it('safely returns CONFUSED on multi-element coordinate tie ("click D1")', () => {
      // D1 contains both #11 (logout) and #12 (promo banner) with equal score 50
      const action = offlineEngine.resolveInstruction('MV-03', microState, 'click D1');
      expect(action.action).toBe('CONFUSED');
      expect(action.thought).toContain('Ambiguous match');
    });

    it('safely returns CONFUSED on gray background color tie across 5 buttons ("click gray")', () => {
      // #21, #22, #23, #24, #29 all have gray backgrounds (#F5F5F5 / #D4D4D4)
      const action = offlineEngine.resolveInstruction('MV-03', microState, 'click gray');
      expect(action.action).toBe('CONFUSED');
      expect(action.thought).toContain('Ambiguous match');
    });

    it('safely returns CONFUSED on ambiguous row seat ("click seat in 2nd row")', () => {
      // 2nd row contains #23, #24, #25 all scoring pos (20) + seat (15) = 35
      const action = offlineEngine.resolveInstruction('MV-03', microState, 'click seat in 2nd row');
      expect(action.action).toBe('CONFUSED');
      expect(action.thought).toContain('Ambiguous match');
    });

    it('returns CONFUSED when instruction scores below threshold ("click seat" = 15 < 25)', () => {
      const action = offlineEngine.resolveInstruction('MV-03', microState, 'click seat');
      expect(action.action).toBe('CONFUSED');
      expect(action.thought).toContain('Instruction unclear');
    });

    it('resolves unique fare price at exact confidence threshold ("14520" = 25)', () => {
      const action = offlineEngine.resolveInstruction('MV-03', microState, '14520');
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#22');
    });

    it('handles fullwidth Japanese numerals in offline simulator ("１４５２０")', () => {
      // NFKC normalizes fullwidth １４５２０ to 14520
      const action = offlineEngine.resolveInstruction('MV-03', microState, '１４５２０');
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#22');
    });

    it('handles currency symbol and comma formatting ("¥14,720" -> #24)', () => {
      const action = offlineEngine.resolveInstruction('MV-03', microState, '¥14,720');
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#24');
    });

    it('verifies 60-character limit enforcement parity between offline engine and cloud connector', async () => {
      const overLongInstruction = 'please select the green car clover button at coordinate D3 right now immediately!';
      expect(overLongInstruction.length).toBeGreaterThan(60);

      // Offline engine enforces 60-character limit
      const offlineAction = offlineEngine.resolveInstruction('MV-03', microState, overLongInstruction);
      expect(offlineAction.action).toBe('CONFUSED');
      expect(offlineAction.thought).toContain('exceeds maximum length of 60 characters');

      // Cloud connector DOES enforce 60 character limit
      const connector = new CloudVisionConnector({
        puzzleId: 'case_001',
        macroViews: CASE_001_MACRO_VIEWS,
        transport: new MockVisionLLMTransport(),
      });
      const cloudAction = await connector.resolveInstruction('MV-03', microState, overLongInstruction);
      expect(cloudAction.action).toBe('CONFUSED');
      expect(cloudAction.thought).toContain('exceeds maximum length of 60 characters');
    });
  });

  // =========================================================================
  // ATTACK VECTOR 3: Rapid State Transitions & Macro-View Lifecycle
  // =========================================================================
  describe('Vector 3: Rapid State Transitions & Macro-View Lifecycles', () => {
    it('returns CONFUSED without throwing on invalid macroViewId', () => {
      const action = offlineEngine.resolveInstruction('NON_EXISTENT_VIEW', microState, 'click green car');
      expect(action.action).toBe('CONFUSED');
      expect(action.thought).toContain('No interactive elements available');
    });

    it('returns CONFUSED on macro-view with empty elements list (MV-01)', () => {
      const action = offlineEngine.resolveInstruction('MV-01', microState, 'click green car');
      expect(action.action).toBe('CONFUSED');
      expect(action.thought).toContain('No interactive elements available');
    });

    it('ensures EdgeKVCache correctly isolates keys between rapid state toggles', async () => {
      const mockTransport = new MockVisionLLMTransport();
      const connector = new CloudVisionConnector({
        puzzleId: 'case_001',
        macroViews: CASE_001_MACRO_VIEWS,
        transport: mockTransport,
      });

      const response1: LLMDecisionResponse = {
        action: 'CLICK',
        target_id: 25,
        text_value: null,
        scroll_direction: null,
        thought: 'Selected green car',
      };
      const response2: LLMDecisionResponse = {
        action: 'CLICK',
        target_id: 30,
        text_value: null,
        scroll_direction: null,
        thought: 'Confirmed booking',
      };

      mockTransport.setResponse('confirm booking', response1);

      // Turn 1: greenCarSelected = false
      const state1 = { ...microState, greenCarSelected: false };
      await connector.resolveInstruction('MV-03', state1, 'confirm booking');
      expect(mockTransport.recordedRequests.length).toBe(1);

      // Turn 2: greenCarSelected = true -> different stateHash -> cache miss!
      mockTransport.setResponse('confirm booking', response2);
      const state2 = { ...microState, greenCarSelected: true };
      const action2 = await connector.resolveInstruction('MV-03', state2, 'confirm booking');
      expect(action2.targetId).toBe('#30');
      expect(mockTransport.recordedRequests.length).toBe(2); // Transport called again because state changed!
    });

    it('handles rapid sequential calls without race conditions or memory leaks in cache', async () => {
      const cache = new MemoryKVCache(10);
      for (let i = 0; i < 50; i++) {
        cache.set(`key_${i}`, {
          action: 'CLICK',
          target_id: i,
          text_value: null,
          scroll_direction: null,
          thought: `Thought ${i}`,
        });
      }
      expect(cache.size()).toBe(10); // Clamped to maxEntries
      expect(cache.get('key_0')).toBeNull(); // Oldest evicted
      expect(cache.get('key_49')?.target_id).toBe(49); // Newest present
    });
  });

  // =========================================================================
  // ATTACK VECTOR 4: Guardrail Evasion & Prompt Injection
  // =========================================================================
  describe('Vector 4: Guardrail Evasion & Prompt Injection Attacks', () => {
    it('blocks standard synthetic mark ID injections', () => {
      expect(filterPromptSyntheticIds('click #25', CASE_001_MV03_ELEMENTS).isBlocked).toBe(true);
      expect(filterPromptSyntheticIds('click mark 25', CASE_001_MV03_ELEMENTS).isBlocked).toBe(true);
      expect(filterPromptSyntheticIds('click badge 25', CASE_001_MV03_ELEMENTS).isBlocked).toBe(true);
      expect(filterPromptSyntheticIds('click id 25', CASE_001_MV03_ELEMENTS).isBlocked).toBe(true);
      expect(filterPromptSyntheticIds('click tag 25', CASE_001_MV03_ELEMENTS).isBlocked).toBe(true);
      expect(filterPromptSyntheticIds('click 25', CASE_001_MV03_ELEMENTS).isBlocked).toBe(true);
      expect(filterPromptSyntheticIds('click #025', CASE_001_MV03_ELEMENTS).isBlocked).toBe(true);
    });

    it('verifies Guardrail 3 blocks underscore delimiter evasions ("mark_25" / "som_25")', () => {
      const resultUnderscore = filterPromptSyntheticIds('click mark_25', CASE_001_MV03_ELEMENTS);
      expect(resultUnderscore.isBlocked).toBe(true);
      const resultSom = filterPromptSyntheticIds('click som_25', CASE_001_MV03_ELEMENTS);
      expect(resultSom.isBlocked).toBe(true);
    });

    it('verifies Guardrail 3 blocks fullwidth unicode digit evasions ("click ＃２５" / "click ２５")', () => {
      const resultFullwidth = filterPromptSyntheticIds('click ＃２５', CASE_001_MV03_ELEMENTS);
      expect(resultFullwidth.isBlocked).toBe(true);
      const resultFullwidthStandalone = filterPromptSyntheticIds('click ２５', CASE_001_MV03_ELEMENTS);
      expect(resultFullwidthStandalone.isBlocked).toBe(true);
    });

    it('verifies Guardrail 3 blocks synthetic mark #14 without false negative from fare numerals', () => {
      const result14 = filterPromptSyntheticIds('click #14', CASE_001_MV03_ELEMENTS);
      expect(result14.isBlocked).toBe(true);
    });

    it('permits visible fare numerals ¥14,520 and ¥14,720 without false-positive collision on synthetic ID #14', () => {
      // Element #22 in MV-03 is "△ ¥14,520" (Hikari 515 Reserved Seat).
      // Element #14 is "◀ 条件変更へ戻る".
      // Formatted currency digits are collapsed across commas before word boundary checks,
      // ensuring "14,520" evaluates to "14520" rather than splitting into candidate ID #14.
      const resFare1 = filterPromptSyntheticIds('select ¥14,520', CASE_001_MV03_ELEMENTS);
      expect(resFare1.isBlocked).toBe(false);
      expect(resFare1.flaggedId).toBeUndefined();
      expect(resFare1.filteredInstruction).toBe('select ¥14,520');

      const resFare2 = filterPromptSyntheticIds('select ¥14,720', CASE_001_MV03_ELEMENTS);
      expect(resFare2.isBlocked).toBe(false);
      expect(resFare2.flaggedId).toBeUndefined();
      expect(resFare2.filteredInstruction).toBe('select ¥14,720');
    });

    it('sanitizes client DOM and strips SoM attributes and badges', () => {
      const html = '<button data-som-id="25" class="btn"><span class="som-badge">25</span>Book</button>';
      const cleaned = sanitizeDomForClient(html);
      expect(cleaned).not.toContain('data-som-id');
      expect(cleaned).not.toContain('som-badge');
      expect(cleaned).toBe('<button class="btn">Book</button>');
    });

    it('verifies DOM sanitization cleanly strips unquoted attributes without tag corruption', () => {
      const htmlUnquoted = '<button data-som-id=25 class="btn">Book</button>';
      const cleaned = sanitizeDomForClient(htmlUnquoted);
      expect(cleaned).not.toContain('data-som-id');
      expect(cleaned).toBe('<button class="btn">Book</button>');

      // Verify unquoted attribute at end of tag does not strip closing >
      const htmlUnquotedEnd = '<button data-som-id=25>Book</button>';
      const cleanedEnd = sanitizeDomForClient(htmlUnquotedEnd);
      expect(cleanedEnd).toBe('<button>Book</button>');
    });

    it('enforces assertGoalBlindness against checklist leakage in context JSON', () => {
      const mv03 = CASE_001_MACRO_VIEWS.find((mv) => mv.id === 'MV-03')!;
      const prompt = buildMultimodalPrompt(mv03, microState, 'click green car');

      expect(() => assertGoalBlindness(prompt.contextJson)).not.toThrow();

      // Leakage triggers exception
      expect(() => {
        assertGoalBlindness({ ...prompt.contextJson, exhibits: ['exhibit_a'] });
      }).toThrow('Security Guardrail Violation');
    });
  });

  // =========================================================================
  // ATTACK VECTOR 5: Malformed LLM Responses & Invariant Violations
  // =========================================================================
  describe('Vector 5: Malformed LLM Responses & Thought Invariant Violations', () => {
    it('handles non-JSON raw strings gracefully', () => {
      const res = validateLLMOutput('Internal Server Error: 502 Bad Gateway');
      expect(res.action).toBe('CONFUSED');
      expect(res.target_id).toBeNull();
      expect(res.thought).toContain('could not be parsed as valid JSON');
    });

    it('handles arrays instead of objects without throwing', () => {
      const res = validateLLMOutput([{ action: 'CLICK', target_id: 25 }]);
      expect(res.action).toBe('CONFUSED');
      expect(res.target_id).toBeNull();
    });

    it('handles missing action or invalid action enum', () => {
      const res1 = validateLLMOutput({ target_id: 25, thought: 'hi' });
      expect(res1.action).toBe('CONFUSED');

      const res2 = validateLLMOutput({ action: 'DESTROY', target_id: 25, thought: 'hi' });
      expect(res2.action).toBe('CONFUSED');

      // Lowercase action is not in enum
      const res3 = validateLLMOutput({ action: 'click', target_id: 25, thought: 'hi' });
      expect(res3.action).toBe('CONFUSED');
    });

    it('handles float, negative, and invalid target_id numbers', () => {
      const floatRes = validateLLMOutput({ action: 'CLICK', target_id: 25.5, thought: 'float' });
      expect(floatRes.target_id).toBeNull();

      const negRes = validateLLMOutput({ action: 'CLICK', target_id: -99, thought: 'negative' });
      expect(negRes.target_id).toBe(-99); // Parsed as integer, but connector will fail to find mark -99
    });

    it('clamps thought note length to strictly <= 80 characters in validateLLMOutput', () => {
      const longThought = 'A'.repeat(150);
      const res = validateLLMOutput({ action: 'CLICK', target_id: 25, thought: longThought });
      expect(res.thought.length).toBeLessThanOrEqual(80);
      expect(res.thought.endsWith('...')).toBe(true);
    });

    it('verifies offline fallback thought note satisfies strict <= 80 chars invariant while retaining badge', async () => {
      const mockTransport = new MockVisionLLMTransport();
      mockTransport.setSimulateError(true, 'Simulated gateway timeout');

      const connector = new CloudVisionConnector({
        puzzleId: 'case_001',
        macroViews: CASE_001_MACRO_VIEWS,
        transport: mockTransport,
        fallbackEngine: offlineEngine,
      });

      // Submit an instruction that causes the offline engine to return its standard unclear thought
      const action = await connector.resolveInstruction('MV-03', microState, 'random ungrounded gibberish text');

      expect(action.action).toBe('CONFUSED');
      expect(action.thought).toContain('(Offline Fallback)');
      expect(action.thought.length).toBeLessThanOrEqual(80);
      expect(action.thought.endsWith('(Offline Fallback)')).toBe(true);
    });

    it('recovers with MockVisionLLMTransport and verifies fallback when transport throws', async () => {
      const mockTransport = new MockVisionLLMTransport();
      mockTransport.setSimulateError(true, 'Fatal cloud disconnect');

      const connector = new CloudVisionConnector({
        puzzleId: 'case_001',
        macroViews: CASE_001_MACRO_VIEWS,
        transport: mockTransport,
        fallbackEngine: offlineEngine,
      });

      const action = await connector.resolveInstruction('MV-03', microState, 'click green car');
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#25');
      expect(action.thought).toContain('(Offline Fallback)');
    });
  });
});
