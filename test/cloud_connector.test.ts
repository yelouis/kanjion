/**
 * test/cloud_connector.test.ts
 *
 * Automated verification suite for CloudVisionConnector:
 * - Multimodal prompt generator with Set-of-Mark macro-view & micro-state JSON
 * - Schema validation and parser resiliency
 * - Edge key-value cache layer (puzzle_id, state_hash, normalized_instruction)
 * - Three security guardrails (goal blindness, DOM sanitization, synthetic ID filtering)
 * - Pluggable transports (Mock & HTTP) with fallback to OfflineSimulationEngine
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CloudVisionConnector,
  AGENT_ACTION_JSON_SCHEMA,
  sanitizeMicroStateForLLM,
  sanitizeVisibleMarks,
  assertGoalBlindness,
  sanitizeDomForClient,
  filterPromptSyntheticIds,
  buildMultimodalPrompt,
  validateLLMOutput,
  MemoryKVCache,
  MockVisionLLMTransport,
  HttpVisionLLMTransport,
} from '../src/engine/cloud_connector';
import { OfflineSimulationEngine } from '../src/engine/offline_simulator';
import {
  CASE_001_INITIAL_MICRO_STATE,
  CASE_001_MACRO_VIEWS,
  CASE_001_MV03_ELEMENTS,
} from '../src/data/puzzles/case_001';
import { ShinkansenMicroState, LLMDecisionResponse } from '../src/types/engine';
import { generateStateHash, generateCacheKey } from '../src/utils/text_normalizer';

describe('Cloud Vision LLM Connector & Security Guardrails', () => {
  let microState: ShinkansenMicroState;
  let mockTransport: MockVisionLLMTransport;
  let offlineEngine: OfflineSimulationEngine;
  let connector: CloudVisionConnector;

  beforeEach(() => {
    microState = { ...CASE_001_INITIAL_MICRO_STATE };
    mockTransport = new MockVisionLLMTransport();
    offlineEngine = new OfflineSimulationEngine();
    connector = new CloudVisionConnector({
      puzzleId: 'case_001',
      macroViews: CASE_001_MACRO_VIEWS,
      transport: mockTransport,
      fallbackEngine: offlineEngine,
    });
  });

  describe('JSON Schema & Output Validator Resiliency', () => {
    it('defines AGENT_ACTION_JSON_SCHEMA with required fields and action enum', () => {
      expect(AGENT_ACTION_JSON_SCHEMA.type).toBe('object');
      expect(AGENT_ACTION_JSON_SCHEMA.required).toEqual(['action', 'target_id', 'thought']);
      expect(AGENT_ACTION_JSON_SCHEMA.properties.action.enum).toEqual([
        'CLICK',
        'TYPE',
        'SCROLL',
        'CONFUSED',
      ]);
    });

    it('validates a clean object payload', () => {
      const input = {
        action: 'CLICK',
        target_id: 25,
        thought: 'Selected green car discount fare.',
      };
      const result = validateLLMOutput(input);
      expect(result.action).toBe('CLICK');
      expect(result.target_id).toBe(25);
      expect(result.thought).toBe('Selected green car discount fare.');
    });

    it('extracts and parses markdown code fence wrapped JSON', () => {
      const raw = '```json\n{\n  "action": "CLICK",\n  "target_id": 30,\n  "thought": "Confirming order."\n}\n```';
      const result = validateLLMOutput(raw);
      expect(result.action).toBe('CLICK');
      expect(result.target_id).toBe(30);
      expect(result.thought).toBe('Confirming order.');
    });

    it('gracefully handles malformed JSON without throwing', () => {
      const raw = 'Sorry, as an AI I cannot execute this instruction.';
      const result = validateLLMOutput(raw);
      expect(result.action).toBe('CONFUSED');
      expect(result.target_id).toBeNull();
      expect(result.thought).toContain('could not be parsed as valid JSON');
    });

    it('clamps thought string to a maximum of 80 characters', () => {
      const longThought = 'A'.repeat(120);
      const input = {
        action: 'CLICK',
        target_id: 25,
        thought: longThought,
      };
      const result = validateLLMOutput(input);
      expect(result.thought.length).toBeLessThanOrEqual(80);
      expect(result.thought.endsWith('...')).toBe(true);
    });

    it('coerces string target_id to number', () => {
      const input = {
        action: 'CLICK',
        target_id: '25',
        thought: 'Target 25 clicked',
      };
      const result = validateLLMOutput(input);
      expect(result.target_id).toBe(25);
    });
  });

  describe('Edge Key-Value Cache Subsystem', () => {
    let cache: MemoryKVCache;

    beforeEach(() => {
      cache = new MemoryKVCache(3);
    });

    it('stores and retrieves cached LLM responses', () => {
      const sample: LLMDecisionResponse = {
        action: 'CLICK',
        target_id: 25,
        text_value: null,
        scroll_direction: null,
        thought: 'Cached green car click',
      };
      cache.set('case_001:hash1:click green car', sample);
      expect(cache.has('case_001:hash1:click green car')).toBe(true);
      expect(cache.get('case_001:hash1:click green car')).toEqual(sample);
    });

    it('returns null for non-existent or expired keys', () => {
      expect(cache.get('non_existent')).toBeNull();
      expect(cache.has('non_existent')).toBe(false);
    });

    it('evicts oldest keys when maxEntries limit is exceeded', () => {
      const dummy: LLMDecisionResponse = {
        action: 'CLICK',
        target_id: 1,
        text_value: null,
        scroll_direction: null,
        thought: 'test',
      };
      cache.set('k1', dummy);
      cache.set('k2', dummy);
      cache.set('k3', dummy);
      expect(cache.size()).toBe(3);

      cache.set('k4', dummy);
      expect(cache.size()).toBe(3);
      expect(cache.get('k1')).toBeNull(); // oldest evicted
      expect(cache.get('k4')).toEqual(dummy);
    });

    it('differentiates cache keys across different state hashes', () => {
      const state1 = { ...microState, greenCarSelected: false };
      const state2 = { ...microState, greenCarSelected: true };

      const hash1 = generateStateHash('MV-03', state1 as unknown as Record<string, unknown>);
      const hash2 = generateStateHash('MV-03', state2 as unknown as Record<string, unknown>);

      expect(hash1).not.toBe(hash2);

      const key1 = generateCacheKey('case_001', hash1, 'confirm booking');
      const key2 = generateCacheKey('case_001', hash2, 'confirm booking');
      expect(key1).not.toBe(key2);
    });

    it('avoids invoking transport when edge cache hits', async () => {
      const cachedDecision: LLMDecisionResponse = {
        action: 'CLICK',
        target_id: 25,
        text_value: null,
        scroll_direction: null,
        thought: 'Hit from edge cache',
      };
      mockTransport.setResponse('click green car', cachedDecision);

      // Turn 1: Cache Miss -> transport called
      const action1 = await connector.resolveInstruction('MV-03', microState, 'click green car');
      expect(action1.targetId).toBe('#25');
      expect(mockTransport.recordedRequests.length).toBe(1);

      // Turn 2: Cache Hit -> transport NOT called again
      const action2 = await connector.resolveInstruction('MV-03', microState, 'click green car');
      expect(action2.targetId).toBe('#25');
      expect(mockTransport.recordedRequests.length).toBe(1); // Still 1!
    });
  });

  describe('Security Guardrail 1: Goal Blindness', () => {
    it('sanitizes micro-state by omitting exhibits and replay checkpoints', () => {
      const sanitized = sanitizeMicroStateForLLM(microState);
      expect(sanitized).not.toHaveProperty('exhibits');
      expect(sanitized).not.toHaveProperty('targetWaypoints');
      expect(sanitized).not.toHaveProperty('ghostReplay');
      expect(sanitized).toHaveProperty('macroViewId', 'MV-01');
      expect(sanitized).toHaveProperty('fare', 0);
    });

    it('sanitizes visible marks by stripping isTarget and isTrap flags', () => {
      const sanitizedMarks = sanitizeVisibleMarks(CASE_001_MV03_ELEMENTS);
      expect(sanitizedMarks.length).toBe(11);
      for (const mark of sanitizedMarks) {
        expect(mark).not.toHaveProperty('isTarget');
        expect(mark).not.toHaveProperty('isTrap');
        expect(mark).toHaveProperty('id');
        expect(mark).toHaveProperty('somId');
        expect(mark).toHaveProperty('region');
      }
    });

    it('throws in assertGoalBlindness if forbidden checklist patterns are present', () => {
      expect(() => {
        assertGoalBlindness({ checklist: ['exhibit_a', 'exhibit_c'] });
      }).toThrow('Security Guardrail Violation: Goal leakage detected in prompt');

      expect(() => {
        assertGoalBlindness({ element: { isTarget: true } });
      }).toThrow('Security Guardrail Violation: Goal leakage detected in prompt');
    });

    it('buildMultimodalPrompt generates prompt bundle without goal leakage', () => {
      const mv03 = CASE_001_MACRO_VIEWS.find((mv) => mv.id === 'MV-03')!;
      const bundle = buildMultimodalPrompt(mv03, microState, 'click green car');

      expect(bundle.systemPrompt).toContain('You are an autonomous web navigation agent');
      expect(bundle.userPrompt).toContain('USER INSTRUCTION: "click green car"');
      expect(bundle.contextJson.microState).toBeDefined();

      // Assert complete goal blindness across serialized context
      expect(() => assertGoalBlindness(bundle.contextJson)).not.toThrow();
    });
  });

  describe('Security Guardrail 2: Client DOM Sanitization', () => {
    it('strips som-id and data-som-id attributes from DOM markup', () => {
      const rawHtml = '<button data-som-id="25" som-id="#25" class="btn">Select Green Car</button>';
      const sanitized = sanitizeDomForClient(rawHtml);
      expect(sanitized).not.toContain('data-som-id');
      expect(sanitized).not.toContain('som-id');
      expect(sanitized).toContain('<button class="btn">Select Green Car</button>');
    });

    it('strips data-target and data-is-trap attributes', () => {
      const rawHtml = '<button data-target="true" data-is-trap="false">Confirm</button>';
      const sanitized = sanitizeDomForClient(rawHtml);
      expect(sanitized).not.toContain('data-target');
      expect(sanitized).not.toContain('data-is-trap');
    });

    it('strips som badge overlay tags and html comments with mark references', () => {
      const rawHtml = '<div><!-- SoM #25 Target --><span class="som-badge">25</span><button>OK</button></div>';
      const sanitized = sanitizeDomForClient(rawHtml);
      expect(sanitized).not.toContain('<!-- SoM #25 Target -->');
      expect(sanitized).not.toContain('<span class="som-badge">25</span>');
      expect(sanitized).toContain('<div><button>OK</button></div>');
    });
  });

  describe('Security Guardrail 3: Synthetic ID Prompt Filtering', () => {
    it('blocks explicit synthetic mark references ("click #25", "click mark 25")', () => {
      const res1 = filterPromptSyntheticIds('click #25', CASE_001_MV03_ELEMENTS);
      expect(res1.isBlocked).toBe(true);
      expect(res1.flaggedId).toBe(25);
      expect(res1.reason).toContain('references synthetic mark ID #25');

      const res2 = filterPromptSyntheticIds('click mark 25', CASE_001_MV03_ELEMENTS);
      expect(res2.isBlocked).toBe(true);
      expect(res2.flaggedId).toBe(25);
    });

    it('allows bare numbers while blocking explicit synthetic ID syntax ("click 25" vs "click #25")', () => {
      const res = filterPromptSyntheticIds('click 25', CASE_001_MV03_ELEMENTS);
      expect(res.isBlocked).toBe(false);

      const resExplicit = filterPromptSyntheticIds('click #25', []);
      expect(resExplicit.isBlocked).toBe(true);
      expect(resExplicit.flaggedId).toBe(25);
    });

    it('permits numbers that appear visibly in on-screen element text ("click Nozomi 24")', () => {
      // 24 appears in "のぞみ 24号"
      const res = filterPromptSyntheticIds('click Nozomi 24', CASE_001_MV03_ELEMENTS);
      expect(res.isBlocked).toBe(false);
    });

    it('permits price numerals ("select 13870")', () => {
      const res = filterPromptSyntheticIds('select 13870', CASE_001_MV03_ELEMENTS);
      expect(res.isBlocked).toBe(false);
    });

    it('permits visible comma-formatted currency amounts without colliding with element IDs ("select ¥14,520", "select ¥14,720")', () => {
      // Element #14 exists in MV-03 ("◀ 条件変更へ戻る"), while #22 is "△ ¥14,520" and #24 is "◯ ¥14,720".
      // Formatted prices must not split at commas to falsely flag #14 as synthetic ID.
      const res1 = filterPromptSyntheticIds('select ¥14,520', CASE_001_MV03_ELEMENTS);
      expect(res1.isBlocked).toBe(false);
      expect(res1.filteredInstruction).toBe('select ¥14,520');

      const res2 = filterPromptSyntheticIds('select ¥14,720', CASE_001_MV03_ELEMENTS);
      expect(res2.isBlocked).toBe(false);
      expect(res2.filteredInstruction).toBe('select ¥14,720');

      const res3 = filterPromptSyntheticIds('14,520', CASE_001_MV03_ELEMENTS);
      expect(res3.isBlocked).toBe(false);

      const res4 = filterPromptSyntheticIds('select ¥2,400', CASE_001_MV03_ELEMENTS);
      expect(res4.isBlocked).toBe(false);

      const resMultiComma = filterPromptSyntheticIds('select ¥1,000,000', CASE_001_MV03_ELEMENTS);
      expect(resMultiComma.isBlocked).toBe(false);

      const resFullwidth = filterPromptSyntheticIds('select ¥１４，５２０', CASE_001_MV03_ELEMENTS);
      expect(resFullwidth.isBlocked).toBe(false);
    });

    it('still blocks synthetic element #14 when targeted explicitly ("click #14", "click mark 14", "click #14, then #25")', () => {
      const resExplicit = filterPromptSyntheticIds('click #14', CASE_001_MV03_ELEMENTS);
      expect(resExplicit.isBlocked).toBe(true);
      expect(resExplicit.flaggedId).toBe(14);

      const resStandalone = filterPromptSyntheticIds('click mark 14', CASE_001_MV03_ELEMENTS);
      expect(resStandalone.isBlocked).toBe(true);
      expect(resStandalone.flaggedId).toBe(14);

      const resDelimiter = filterPromptSyntheticIds('click #14, then #25', CASE_001_MV03_ELEMENTS);
      expect(resDelimiter.isBlocked).toBe(true);
      expect(resDelimiter.flaggedId).toBe(14);
    });

    it('connector returns immediate NOOP on synthetic ID attempt without calling LLM', async () => {
      const action = await connector.resolveInstruction('MV-03', microState, 'click #25');
      expect(action.action).toBe('NOOP');
      expect(action.thought).toBe("💭 I don't see numbers like that on the page — describe the thing instead.");
      expect(mockTransport.recordedRequests.length).toBe(0); // LLM never called!
    });

    it('blocks URL-encoded synthetic mark references ("%2325", "mark%2025", "badge%20%2325")', () => {
      const urlEncodedVectors = [
        { input: 'click %2325', expectedId: 25 },
        { input: 'click mark%2025', expectedId: 25 },
        { input: 'click badge%20%2325', expectedId: 25 },
        { input: 'click %23%32%35', expectedId: 25 },
        { input: '%2325', expectedId: 25 },
        { input: 'click%20%2325', expectedId: 25 },
        { input: 'click%20mark%2025', expectedId: 25 },
        { input: 'click som%5F25', expectedId: 25 },
      ];

      for (const vector of urlEncodedVectors) {
        const res = filterPromptSyntheticIds(vector.input, CASE_001_MV03_ELEMENTS);
        expect(res.isBlocked).toBe(true);
        expect(res.flaggedId).toBe(vector.expectedId);
      }
    });

    it('blocks zero-width and invisible control characters embedded within digits and mark tokens', () => {
      const zeroWidthVectors = [
        { input: 'click #2\u200B5', expectedId: 25, label: 'hash with embedded zero-width space' },
        { input: 'click #\u200B25', expectedId: 25, label: 'leading zero-width space after hash' },
        { input: 'click mark\u200B25', expectedId: 25, label: 'zero-width space in mark token' },
        { input: 'click #2\u200C5', expectedId: 25, label: 'zero-width non-joiner U+200C' },
        { input: 'click #2\u200D5', expectedId: 25, label: 'zero-width joiner U+200D' },
        { input: 'click #2\uFEFF5', expectedId: 25, label: 'byte order mark U+FEFF' },
        { input: 'click #2\u200B\u200C\u200D5', expectedId: 25, label: 'multiple concatenated zero-width chars' },
      ];

      for (const vector of zeroWidthVectors) {
        const res = filterPromptSyntheticIds(vector.input, CASE_001_MV03_ELEMENTS);
        expect(res.isBlocked).toBe(true);
        expect(res.flaggedId).toBe(vector.expectedId);
      }
    });

    it('handles malformed URL escapes gracefully without throwing exceptions and preserves legitimate text', () => {
      // Malformed escapes must not throw URIError (e.g. decodeURIComponent malformed)
      expect(() => filterPromptSyntheticIds('select 50% discount', CASE_001_MV03_ELEMENTS)).not.toThrow();
      expect(() => filterPromptSyntheticIds('get +20% bonus', CASE_001_MV03_ELEMENTS)).not.toThrow();
      expect(() => filterPromptSyntheticIds('click %ZZ25', CASE_001_MV03_ELEMENTS)).not.toThrow();
      expect(() => filterPromptSyntheticIds('click %E0%A4%A', CASE_001_MV03_ELEMENTS)).not.toThrow();
      expect(() => filterPromptSyntheticIds('click %2', CASE_001_MV03_ELEMENTS)).not.toThrow();
      expect(() => filterPromptSyntheticIds('click %', CASE_001_MV03_ELEMENTS)).not.toThrow();

      // Legitimate percent usage must NOT be blocked
      expect(filterPromptSyntheticIds('select 50% discount', CASE_001_MV03_ELEMENTS).isBlocked).toBe(false);
      expect(filterPromptSyntheticIds('get +20% bonus', CASE_001_MV03_ELEMENTS).isBlocked).toBe(false);
      expect(filterPromptSyntheticIds('click %ZZ25', CASE_001_MV03_ELEMENTS).isBlocked).toBe(false);
      expect(filterPromptSyntheticIds('click %E0%A4%A', CASE_001_MV03_ELEMENTS).isBlocked).toBe(false);
      expect(filterPromptSyntheticIds('click %2', CASE_001_MV03_ELEMENTS).isBlocked).toBe(false);
      expect(filterPromptSyntheticIds('click %', CASE_001_MV03_ELEMENTS).isBlocked).toBe(false);

      // Malformed escapes combined with synthetic mark ID must still be blocked
      const resMalformedWithMark = filterPromptSyntheticIds('click %E0%A4%A #25', CASE_001_MV03_ELEMENTS);
      expect(resMalformedWithMark.isBlocked).toBe(true);
      expect(resMalformedWithMark.flaggedId).toBe(25);

      const resTrailingPercentWithMark = filterPromptSyntheticIds('click % #25', CASE_001_MV03_ELEMENTS);
      expect(resTrailingPercentWithMark.isBlocked).toBe(true);
      expect(resTrailingPercentWithMark.flaggedId).toBe(25);
    });

    it('connector blocks URL-encoded and zero-width evasion attacks before invoking multimodal LLM transport', async () => {
      const evasionInputs = [
        'click %2325',
        'click mark%2025',
        'click #2\u200B5',
        'click mark\u200B25',
      ];

      for (const input of evasionInputs) {
        mockTransport.recordedRequests = [];
        const action = await connector.resolveInstruction('MV-03', microState, input);
        expect(action.action).toBe('NOOP');
        expect(action.thought).toBe("💭 I don't see numbers like that on the page — describe the thing instead.");
        expect(mockTransport.recordedRequests.length).toBe(0); // LLM transport never called!
      }
    });
  });

  describe('Pluggable Transports & Offline Fallback', () => {
    it('dispatches instruction to MockVisionLLMTransport and maps result to AgentAction', async () => {
      mockTransport.setResponse('click green car', {
        action: 'CLICK',
        target_id: 25,
        text_value: null,
        scroll_direction: null,
        thought: 'Selected Nozomi 24 green car discount seat',
      });

      const action = await connector.resolveInstruction('MV-03', microState, 'click green car');
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#25');
      expect(action.gridRef).toBe('D3');
      expect(action.targetCoordinate).toEqual({ x: 885, y: 468 });
      expect(action.thought).toBe('Selected Nozomi 24 green car discount seat');
    });

    it('falls back to OfflineSimulationEngine on transport network failure', async () => {
      mockTransport.setSimulateError(true, 'Connection refused to LLM gateway');

      const action = await connector.resolveInstruction('MV-03', microState, 'click green car');
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#25');
      expect(action.thought).toContain('(Offline Fallback)');
    });

    it('returns NOOP if transport fails and no fallback engine configured', async () => {
      const bareConnector = new CloudVisionConnector({
        puzzleId: 'case_001',
        macroViews: CASE_001_MACRO_VIEWS,
        transport: mockTransport,
      });
      mockTransport.setSimulateError(true, 'Fatal cloud timeout');

      const action = await bareConnector.resolveInstruction('MV-03', microState, 'click green car');
      expect(action.action).toBe('NOOP');
      expect(action.thought).toBe('💭 I have no idea what that means, so I poked the page title. Describe what to click?');
    });

    it('executes HttpVisionLLMTransport with custom fetch mock', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          action: 'CLICK',
          target_id: 30,
          thought: 'Confirmed via HTTP gateway',
        }),
      });

      const httpTransport = new HttpVisionLLMTransport({
        endpointUrl: 'https://api.instruct.game/v1/decision',
        apiKey: 'test-api-key',
        customFetch: mockFetch as unknown as typeof fetch,
      });

      const response = await httpTransport.requestDecision({
        puzzleId: 'case_001',
        macroViewId: 'MV-03',
        instruction: 'confirm booking',
        normalizedInstruction: 'confirm booking',
        microState,
      });

      expect(response.action).toBe('CLICK');
      expect(response.target_id).toBe(30);
      expect(response.thought).toBe('Confirmed via HTTP gateway');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
