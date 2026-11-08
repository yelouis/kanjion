/**
 * test/stress_boundary_conditions.test.ts
 *
 * Empirical Adversarial Challenger Stress Test Suite for Milestone 2 Iteration 2:
 * Boundary Condition Stress-Testing of OfflineSimulationEngine & CloudVisionConnector.
 *
 * Test Vectors:
 * Vector 1: OfflineSimulationEngine Boundary Conditions (length, whitespace, multi-byte, ReDoS resistance)
 * Vector 2: Offline Simulation Multi-Token Scoring & Tie-Breaking Boundaries
 * Vector 3: CloudVisionConnector Boundary Validation (lengths, macro-view validation, goal blindness)
 * Vector 4: Guardrail Evasion Stress Harness (synthetic IDs, sub-numbers, delimiters, DOM sanitization)
 * Vector 5: Cloud Connector Transport Error Recovery & Fallback Thought Invariant Harness
 * Vector 6: EdgeKVCache & State Hash Determinism Under Boundary Mutations
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
  validateLLMOutput,
  MemoryKVCache,
  MockVisionLLMTransport,
  VisionLLMTransport,
} from '../src/engine/cloud_connector';
import {
  CASE_001_INITIAL_MICRO_STATE,
  CASE_001_MACRO_VIEWS,
  CASE_001_MV03_ELEMENTS,
} from '../src/data/puzzles/case_001';
import {
  LLMDecisionResponse,
} from '../src/types/engine';
import type { FieldValue } from '../src/types/puzzle_data';
import { generateStateHash } from '../src/utils/text_normalizer';

describe('Milestone 2 Iteration 2: Empirical Boundary Stress Testing', () => {
  let offlineEngine: OfflineSimulationEngine;
  let microState: Record<string, FieldValue>;

  beforeEach(() => {
    offlineEngine = new OfflineSimulationEngine();
    microState = { ...CASE_001_INITIAL_MICRO_STATE };
  });

  // =========================================================================
  // VECTOR 1: OfflineSimulationEngine Input Boundaries
  // =========================================================================
  describe('Vector 1: Offline Engine Input & Length Boundaries', () => {
    it('handles empty, whitespace, and newline inputs gracefully', () => {
      const inputs = ['', ' ', '   ', '\t\n\r', ' \n \t '];
      for (const input of inputs) {
        const action = offlineEngine.resolveInstruction('MV-03', microState, input);
        expect(action.action).toBe('NOOP');
        expect(action.thought).toBe('💭 I have no idea what that means, so I poked the page title. Describe what to click?');
      }
    });

    it('enforces strict 60-character boundary parity', () => {
      // 59 characters: should be evaluated normally
      const input59 = 'click green car button at D3 please agent for the shinkanse';
      expect(input59.length).toBe(59);
      const action59 = offlineEngine.resolveInstruction('MV-03', microState, input59);
      expect(action59.action).toBe('CLICK');
      expect(action59.targetId).toBe('#25');

      // Exactly 60 characters: should be evaluated normally
      const input60 = 'click green car button at D3 please agent for the shinkansen';
      expect(input60.length).toBe(60);
      const action60 = offlineEngine.resolveInstruction('MV-03', microState, input60);
      expect(action60.action).toBe('CLICK');
      expect(action60.targetId).toBe('#25');

      // Exactly 61 characters: must return NOOP
      const input61 = 'click green car button at D3 please agent for the shinkansen!';
      expect(input61.length).toBe(61);
      const action61 = offlineEngine.resolveInstruction('MV-03', microState, input61);
      expect(action61.action).toBe('NOOP');
      expect(action61.thought).toBe('💭 I have no idea what that means, so I poked the page title. Describe what to click?');

      // 55 chars with 6 trailing spaces (length = 61): exceeds length limit
      const inputSpaces = 'click green car button at D3                          ';
      expect(inputSpaces.length).toBe(54); // safe
      const inputSpaces61 = 'click green car button at D3                           ';
      expect(inputSpaces61.length).toBe(55);
      const padded61 = 'click green car button at D3' + ' '.repeat(33); // 28 + 33 = 61
      expect(padded61.length).toBe(61);
      const actionPadded = offlineEngine.resolveInstruction('MV-03', microState, padded61);
      expect(actionPadded.action).toBe('NOOP');
      expect(actionPadded.thought).toBe('💭 I have no idea what that means, so I poked the page title. Describe what to click?');
    });

    it('resists ReDoS and handles massive inputs (10,000 characters) instantaneously', () => {
      const massiveInput = 'click '.repeat(1666) + 'clover';
      expect(massiveInput.length).toBeGreaterThan(10000);
      const t0 = performance.now();
      const action = offlineEngine.resolveInstruction('MV-03', microState, massiveInput);
      const elapsed = performance.now() - t0;

      expect(elapsed).toBeLessThan(50); // Instantaneous rejection (< 50ms)
      expect(action.action).toBe('NOOP');
      expect(action.thought).toBe('💭 I have no idea what that means, so I poked the page title. Describe what to click?');
    });

    it('handles non-existent macroView IDs and empty element views without crashing', () => {
      const actionMissing = offlineEngine.resolveInstruction('MV-NONEXISTENT', microState, 'click clover');
      expect(actionMissing.action).toBe('NOOP');
      expect(actionMissing.thought).toBe('💭 I have no idea what that means, so I poked the page title. Describe what to click?');

      const emptyViewEngine = new OfflineSimulationEngine([
        {
          id: 'MV-EMPTY',
          name: 'Empty View',
          simulatedUrl: 'sandbox://empty',
          elements: [],
        },
      ]);
      const actionEmpty = emptyViewEngine.resolveInstruction('MV-EMPTY', microState, 'click clover');
      expect(actionEmpty.action).toBe('NOOP');
      expect(actionEmpty.thought).toBe('💭 I have no idea what that means, so I poked the page title. Describe what to click?');
    });

    it('handles multi-byte unicode, Japanese Kanji/Hiragana, and special punctuation', () => {
      // Japanese kanji green car instruction
      const actionKanji = offlineEngine.resolveInstruction('MV-03', microState, '緑の座席 13870 特割');
      expect(actionKanji.action).toBe('CLICK');
      expect(actionKanji.targetId).toBe('#25');

      // Japanese confirmation button
      const actionConfirm = offlineEngine.resolveInstruction('MV-03', microState, '確定する ボタン 青');
      expect(actionConfirm.action).toBe('CLICK');
      expect(actionConfirm.targetId).toBe('#30');

      // Emoji clover
      const actionEmoji = offlineEngine.resolveInstruction('MV-03', microState, '🍀 D3');
      expect(actionEmoji.action).toBe('CLICK');
      expect(actionEmoji.targetId).toBe('#25');
    });
  });

  // =========================================================================
  // VECTOR 2: Offline Simulation Multi-Token Scoring & Tie Boundaries
  // =========================================================================
  describe('Vector 2: Multi-Token Scoring & Tie Boundaries', () => {
    it('returns NOOP when instruction scores below confidence threshold (25)', () => {
      // Instruction matching only a generic non-existent or low-weight keyword
      const action = offlineEngine.resolveInstruction('MV-03', microState, 'completely unrelated query');
      expect(action.action).toBe('NOOP');
      expect(action.thought).toBe('💭 I have no idea what that means, so I poked the page title. Describe what to click?');
    });

    it('returns NOOP for ambiguous fare matches (¥13,870)', () => {
      // 13870 matches Hikari Free Seat (#21) and Nozomi Free Seat (#23) equally
      const actionFare = offlineEngine.resolveInstruction('MV-03', microState, 'select ticket 13870');
      expect(actionFare.action).toBe('NOOP');
      expect(actionFare.thought).toBe('💭 I have no idea what that means, so I poked the page title. Describe what to click?');

      // With comma: 13,870
      const actionFareComma = offlineEngine.resolveInstruction('MV-03', microState, 'select ticket 13,870');
      expect(actionFareComma.action).toBe('NOOP');
      expect(actionFareComma.thought).toBe('💭 I have no idea what that means, so I poked the page title. Describe what to click?');
    });

    it('breaks ties cleanly when additional coordinate or train disambiguation is provided', () => {
      // Disambiguate with coordinate B2
      const actionHikari = offlineEngine.resolveInstruction('MV-03', microState, 'ticket 13870 at B2');
      expect(actionHikari.action).toBe('CLICK');
      expect(actionHikari.targetId).toBe('#21');

      // Disambiguate with coordinate B3
      const actionNozomi = offlineEngine.resolveInstruction('MV-03', microState, 'ticket 13870 at B3');
      expect(actionNozomi.action).toBe('CLICK');
      expect(actionNozomi.targetId).toBe('#23');

      // Disambiguate with clover / green car (D3)
      const actionGreen = offlineEngine.resolveInstruction('MV-03', microState, 'ticket 13870 with clover');
      expect(actionGreen.action).toBe('CLICK');
      expect(actionGreen.targetId).toBe('#25');
    });
  });

  // =========================================================================
  // VECTOR 3: CloudVisionConnector Boundary Validation & Goal Blindness
  // =========================================================================
  describe('Vector 3: CloudVisionConnector Boundary Validation', () => {
    it('rejects instructions exceeding 60 characters before reaching LLM transport', async () => {
      let transportCalled = false;
      const mockTransport: VisionLLMTransport = {
        async requestDecision(): Promise<LLMDecisionResponse> {
          transportCalled = true;
          return { action: 'CLICK', target_id: 25, thought: 'ok', text_value: null, scroll_direction: null };
        },
      };

      const connector = new CloudVisionConnector({
        puzzleId: 'case_001',
        macroViews: CASE_001_MACRO_VIEWS,
        transport: mockTransport,
      });

      const longInstruction = 'A'.repeat(61);
      const action = await connector.resolveInstruction('MV-03', microState, longInstruction);

      expect(transportCalled).toBe(false); // Transport was never queried
      expect(action.action).toBe('NOOP');
      expect(action.thought).toBe('💭 I have no idea what that means, so I poked the page title. Describe what to click?');
    });

    it('rejects empty and whitespace instructions before reaching LLM transport', async () => {
      let transportCalled = false;
      const mockTransport: VisionLLMTransport = {
        async requestDecision(): Promise<LLMDecisionResponse> {
          transportCalled = true;
          return { action: 'CLICK', target_id: 25, thought: 'ok', text_value: null, scroll_direction: null };
        },
      };

      const connector = new CloudVisionConnector({
        puzzleId: 'case_001',
        macroViews: CASE_001_MACRO_VIEWS,
        transport: mockTransport,
      });

      const action = await connector.resolveInstruction('MV-03', microState, '   ');
      expect(transportCalled).toBe(false);
      expect(action.action).toBe('NOOP');
      expect(action.thought).toBe('💭 I have no idea what that means, so I poked the page title. Describe what to click?');
    });

    it('rejects non-existent macro-view without querying LLM transport', async () => {
      let transportCalled = false;
      const mockTransport: VisionLLMTransport = {
        async requestDecision(): Promise<LLMDecisionResponse> {
          transportCalled = true;
          return { action: 'CLICK', target_id: 25, thought: 'ok', text_value: null, scroll_direction: null };
        },
      };

      const connector = new CloudVisionConnector({
        puzzleId: 'case_001',
        macroViews: CASE_001_MACRO_VIEWS,
        transport: mockTransport,
      });

      const action = await connector.resolveInstruction('MV-999', microState, 'click button');
      expect(transportCalled).toBe(false);
      expect(action.action).toBe('NOOP');
      expect(action.thought).toBe('💭 I have no idea what that means, so I poked the page title. Describe what to click?');
    });

    it('strictly enforces assertGoalBlindness against all prohibited goal keys', () => {
      const prohibitedPatterns = [
        'exhibit_a',
        'exhibit_b',
        'exhibit_c',
        'exhibit_d',
        'exhibit_e',
        'winningPath',
        'targetWaypoint',
        'rubberStamp',
      ];

      for (const pattern of prohibitedPatterns) {
        const dirtyContext = {
          macroViewId: 'MV-03',
          microState: { ...microState },
          leak: pattern,
        };
        expect(() => assertGoalBlindness(dirtyContext)).toThrow('Security Guardrail Violation');
      }

      // Also verify isTarget: true and isTrap: true leaks
      expect(() => assertGoalBlindness({ isTarget: true })).toThrow('Security Guardrail Violation');
      expect(() => assertGoalBlindness({ isTrap: true })).toThrow('Security Guardrail Violation');

      // Clean context passes without error
      const cleanContext = {
        macroViewId: 'MV-03',
        microState: { ...microState },
        visibleMarks: [{ markId: 25, role: 'button' }],
      };
      expect(() => assertGoalBlindness(cleanContext)).not.toThrow();
    });
  });

  // =========================================================================
  // VECTOR 4: Guardrail Evasion Stress Harness
  // =========================================================================
  describe('Vector 4: Guardrail Evasion & Sanitization Stress Harness', () => {
    it('blocks various synthetic ID delimiter formats', () => {
      const evasionAttempts = [
        'click #25',
        'click # 25',
        'click #025',
        'click mark 25',
        'click mark_25',
        'click mark-25',
        'click som_25',
        'click som-25',
        'click badge 25',
        'click badge#25',
        'click id 25',
        'click tag 25',
      ];

      for (const prompt of evasionAttempts) {
        const result = filterPromptSyntheticIds(prompt, CASE_001_MV03_ELEMENTS);
        expect(result.isBlocked).toBe(true);
      }
    });

    it('blocks fullwidth unicode variations of synthetic IDs', () => {
      const fullwidthAttempts = [
        'click ＃２５',
        'click ｍａｒｋ２５',
        'click ＃ ２５',
      ];

      for (const prompt of fullwidthAttempts) {
        const result = filterPromptSyntheticIds(prompt, CASE_001_MV03_ELEMENTS);
        expect(result.isBlocked).toBe(true);
      }
    });

    it('allows legitimate visible unformatted numbers and prices through without false positive blockage', () => {
      // 24 is visible as "Nozomi 24"
      const res24 = filterPromptSyntheticIds('click Nozomi 24', CASE_001_MV03_ELEMENTS);
      expect(res24.isBlocked).toBe(false);

      // 13870 is visible as ticket price
      const resPrice = filterPromptSyntheticIds('select 13870 fare', CASE_001_MV03_ELEMENTS);
      expect(resPrice.isBlocked).toBe(false);

      // 515 is visible as "Hikari 515"
      const res515 = filterPromptSyntheticIds('board Hikari 515', CASE_001_MV03_ELEMENTS);
      expect(res515.isBlocked).toBe(false);
    });

    it('permits comma-formatted prices containing synthetic ID substrings ("¥14,520" and "¥14,720") without false-positive blockage', () => {
      const resFare14520 = filterPromptSyntheticIds('select ¥14,520', CASE_001_MV03_ELEMENTS);
      expect(resFare14520.isBlocked).toBe(false);
      expect(resFare14520.flaggedId).toBeUndefined();
      expect(resFare14520.filteredInstruction).toBe('select ¥14,520');

      const resFare14720 = filterPromptSyntheticIds('select ¥14,720', CASE_001_MV03_ELEMENTS);
      expect(resFare14720.isBlocked).toBe(false);
      expect(resFare14720.flaggedId).toBeUndefined();
      expect(resFare14720.filteredInstruction).toBe('select ¥14,720');
    });

    it('prevents sub-number false negatives on #14 colliding with ¥14,520 or ¥14,720', () => {
      const res14 = filterPromptSyntheticIds('click mark #14', CASE_001_MV03_ELEMENTS);
      expect(res14.isBlocked).toBe(true);

      const res14Hash = filterPromptSyntheticIds('click #14', CASE_001_MV03_ELEMENTS);
      expect(res14Hash.isBlocked).toBe(true);
    });

    it('sanitizes DOM HTML with unquoted, single-quoted, and multi-attribute patterns', () => {
      const rawHtml = [
        '<button data-som-id=25 class="btn">Click</button>',
        "<button data-som-id='25' class='btn'>Click</button>",
        '<button som-id=25 data-target=green_car data-is-trap=false>Confirm</button>',
        '<div class="wrapper" data-element-id=99><span class="som-badge">99</span>Content</div>',
        '<!-- som-id: 25 target element --><div>Clean Content</div>',
      ].join('\n');

      const sanitized = sanitizeDomForClient(rawHtml);

      expect(sanitized).not.toContain('data-som-id');
      expect(sanitized).not.toContain('som-id');
      expect(sanitized).not.toContain('data-element-id');
      expect(sanitized).not.toContain('data-target');
      expect(sanitized).not.toContain('data-is-trap');
      expect(sanitized).not.toContain('som-badge');
      expect(sanitized).not.toContain('<!--');

      // Valid tag structure remains intact
      expect(sanitized).toContain('<button class="btn">Click</button>');
      expect(sanitized).toContain('<button>Confirm</button>');
      expect(sanitized).toContain('<div>Clean Content</div>');
    });
  });

  // =========================================================================
  // VECTOR 5: Fallback Recovery & Thought Note Invariant Harness
  // =========================================================================
  describe('Vector 5: Fallback Recovery & Thought Note Invariants', () => {
    it('guarantees fallback thought length <= 80 across various fallback thought lengths', async () => {
      const mockTransport = new MockVisionLLMTransport();
      mockTransport.setSimulateError(true, 'Cloud vision timeout 504');

      // Test with custom engines returning thoughts of various lengths
      const testLengths = [10, 40, 60, 61, 62, 70, 80, 120];

      for (const len of testLengths) {
        const dummyThought = 'X'.repeat(len);
        const dummyFallback: any = {
          resolveInstruction: () => ({
            action: 'CLICK',
            targetId: '#25',
            thought: dummyThought,
          }),
        };

        const connector = new CloudVisionConnector({
          puzzleId: 'case_001',
          macroViews: CASE_001_MACRO_VIEWS,
          transport: mockTransport,
          fallbackEngine: dummyFallback,
        });

        const action = await connector.resolveInstruction('MV-03', microState, 'click clover');
        expect(action.action).toBe('CLICK');
        expect(action.thought.length).toBeLessThanOrEqual(80);
        expect(action.thought.endsWith('(Offline Fallback)')).toBe(true);
      }
    });

    it('safely recovers when transport throws non-Error objects (string, null, primitive)', async () => {
      const throwingTransports = [
        { requestDecision: async () => { throw 'String error failure'; } },
        { requestDecision: async () => { throw 500; } },
        { requestDecision: async () => { throw null; } },
        { requestDecision: async () => { throw undefined; } },
      ];

      for (const transport of throwingTransports) {
        const connector = new CloudVisionConnector({
          puzzleId: 'case_001',
          macroViews: CASE_001_MACRO_VIEWS,
          transport: transport as VisionLLMTransport,
          fallbackEngine: offlineEngine,
        });

        const action = await connector.resolveInstruction('MV-03', microState, 'click green car');
        expect(action.action).toBe('CLICK');
        expect(action.targetId).toBe('#25');
        expect(action.thought).toContain('(Offline Fallback)');
        expect(action.thought.length).toBeLessThanOrEqual(80);
      }
    });

    it('clamps raw LLM thoughts in validateLLMOutput strictly to <= 80 chars with ellipsis', () => {
      const thoughtsToTest = [
        { input: 'Short thought', expectedLength: 13, endsWith: 'Short thought' },
        { input: 'A'.repeat(80), expectedLength: 80, endsWith: 'A' },
        { input: 'B'.repeat(81), expectedLength: 80, endsWith: '...' },
        { input: 'C'.repeat(500), expectedLength: 80, endsWith: '...' },
      ];

      for (const tc of thoughtsToTest) {
        const validated = validateLLMOutput({
          action: 'CLICK',
          target_id: 25,
          thought: tc.input,
        });
        expect(validated.thought.length).toBeLessThanOrEqual(80);
        expect(validated.thought.endsWith(tc.endsWith.slice(-3))).toBe(true);
      }
    });
  });

  // =========================================================================
  // VECTOR 6: EdgeKVCache & State Hash Determinism
  // =========================================================================
  describe('Vector 6: EdgeKVCache & State Hash Determinism', () => {
    it('produces identical state hashes for identical micro-states', () => {
      const hash1 = generateStateHash('MV-03', microState as any);
      const hash2 = generateStateHash('MV-03', { ...microState } as any);
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(8);
    });

    it('produces distinct state hashes when critical state attributes change', () => {
      const baseHash = generateStateHash('MV-03', microState as any);

      const modifiedStates = [
        { ...microState, greenCarSelected: true },
        { ...microState, insuranceTrapHit: true },
        { ...microState, insuranceCheckboxChecked: true },
        { ...microState, finalConfirmed: true },
        { ...microState, seatClass: 'green_car' },
        { ...microState, fare: 13870 },
      ];

      for (const mod of modifiedStates) {
        const modHash = generateStateHash('MV-03', mod as any);
        expect(modHash).not.toBe(baseHash);
      }
    });

    it('caches LLM decisions and serves subsequent identical requests from EdgeKVCache', async () => {
      let callCount = 0;
      const countingTransport: VisionLLMTransport = {
        async requestDecision(): Promise<LLMDecisionResponse> {
          callCount++;
          return {
            action: 'CLICK',
            target_id: 25,
            thought: 'Target clicked by LLM',
            text_value: null,
            scroll_direction: null,
          };
        },
      };

      const cache = new MemoryKVCache();
      const connector = new CloudVisionConnector({
        puzzleId: 'case_001',
        macroViews: CASE_001_MACRO_VIEWS,
        transport: countingTransport,
        cache,
      });

      // Request 1: Cache miss, transport called
      const action1 = await connector.resolveInstruction('MV-03', microState, 'click green car');
      expect(callCount).toBe(1);
      expect(action1.action).toBe('CLICK');
      expect(action1.targetId).toBe('#25');

      // Request 2: Cache hit, transport NOT called again
      const action2 = await connector.resolveInstruction('MV-03', microState, 'click green car');
      expect(callCount).toBe(1); // Still 1!
      expect(action2.action).toBe('CLICK');
      expect(action2.targetId).toBe('#25');

      // Request 3: Different micro-state causes cache miss, transport called
      const alteredState = { ...microState, greenCarSelected: true };
      const action3 = await connector.resolveInstruction('MV-03', alteredState, 'click green car');
      expect(callCount).toBe(2); // Increased to 2!
      expect(action3.action).toBe('CLICK');
    });
  });
});
