/**
 * test/stress_boundary_conditions.test.ts
 *
 * Boundary Condition Stress-Testing of resolveLine, fallbackResolve & Guardrails.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveLine,
  fallbackResolve,
  filterPromptSyntheticIds,
  sanitizeDomForClient,
  assertGoalBlindness,
} from '../src/engine/agent';
import {
  CASE_001_PUZZLE,
  CASE_001_GENERATED_MANIFEST,
  CASE_001_INITIAL_MICRO_STATE,
  CASE_001_MV03_ELEMENTS,
} from '../src/data/puzzles/case_001';
import type { FieldValue, PuzzleState } from '../src/types/puzzle_data';
import { generateStateHash } from '../src/utils/text_normalizer';

function makeState(pageId: string, fields: Record<string, FieldValue> = CASE_001_INITIAL_MICRO_STATE): PuzzleState {
  return {
    pageId,
    fields: { ...fields },
  };
}

describe('Milestone 2 Iteration 2: Empirical Boundary Stress Testing', () => {
  let microState: Record<string, FieldValue>;

  beforeEach(() => {
    microState = { ...CASE_001_INITIAL_MICRO_STATE };
  });

  // =========================================================================
  // VECTOR 1: Agent Pipeline Input Boundaries
  // =========================================================================
  describe('Vector 1: Agent Input & Length Boundaries', () => {
    it('handles empty, whitespace, and newline inputs gracefully', async () => {
      const inputs = ['', ' ', '   ', '\t\n\r', ' \n \t '];
      for (const input of inputs) {
        const action = await resolveLine({
          puzzle: CASE_001_PUZZLE,
          manifest: CASE_001_GENERATED_MANIFEST,
          state: makeState('MV-03', microState),
          instruction: input,
        });
        expect(action.action).toBe('NOOP');
        expect(action.thought).toBe('💭 I have no idea what that means, so I poked the page title. Describe what to click?');
      }
    });

    it('enforces strict 60-character boundary parity', async () => {
      // 59 characters: should be evaluated normally
      const input59 = 'click green car button at D3 please right now for shinkanse';
      expect(input59.length).toBe(59);
      const action59 = await resolveLine({
        puzzle: CASE_001_PUZZLE,
        manifest: CASE_001_GENERATED_MANIFEST,
        state: makeState('MV-03', microState),
        instruction: input59,
      });
      expect(action59.action).toBe('CLICK');
      expect(action59.mark).toBe(25);

      // Exactly 60 characters: should be evaluated normally
      const input60 = 'click green car button at D3 please right now for shinkansen';
      expect(input60.length).toBe(60);
      const action60 = await resolveLine({
        puzzle: CASE_001_PUZZLE,
        manifest: CASE_001_GENERATED_MANIFEST,
        state: makeState('MV-03', microState),
        instruction: input60,
      });
      expect(action60.action).toBe('CLICK');
      expect(action60.mark).toBe(25);

      // Exactly 61 characters: must return NOOP
      const input61 = 'click green car button at D3 please right now for shinkansen!';
      expect(input61.length).toBe(61);
      const action61 = await resolveLine({
        puzzle: CASE_001_PUZZLE,
        manifest: CASE_001_GENERATED_MANIFEST,
        state: makeState('MV-03', microState),
        instruction: input61,
      });
      expect(action61.action).toBe('NOOP');
      expect(action61.thought).toBe('💭 I have no idea what that means, so I poked the page title. Describe what to click?');

      // 61 chars with trailing spaces: exceeds length limit
      const padded61 = 'click green car button at D3' + ' '.repeat(33); // 28 + 33 = 61
      expect(padded61.length).toBe(61);
      const actionPadded = await resolveLine({
        puzzle: CASE_001_PUZZLE,
        manifest: CASE_001_GENERATED_MANIFEST,
        state: makeState('MV-03', microState),
        instruction: padded61,
      });
      expect(actionPadded.action).toBe('NOOP');
      expect(actionPadded.thought).toBe('💭 I have no idea what that means, so I poked the page title. Describe what to click?');
    });

    it('resists ReDoS and handles massive inputs (10,000 characters) instantaneously', async () => {
      const massiveInput = 'click '.repeat(1666) + 'clover';
      expect(massiveInput.length).toBeGreaterThan(10000);
      const t0 = performance.now();
      const action = await resolveLine({
        puzzle: CASE_001_PUZZLE,
        manifest: CASE_001_GENERATED_MANIFEST,
        state: makeState('MV-03', microState),
        instruction: massiveInput,
      });
      const elapsed = performance.now() - t0;

      expect(elapsed).toBeLessThan(50);
      expect(action.action).toBe('NOOP');
      expect(action.thought).toBe('💭 I have no idea what that means, so I poked the page title. Describe what to click?');
    });

    it('handles non-existent macroView IDs and empty element views without crashing', async () => {
      const actionMissing = await resolveLine({
        puzzle: CASE_001_PUZZLE,
        manifest: CASE_001_GENERATED_MANIFEST,
        state: makeState('MV-NONEXISTENT', microState),
        instruction: 'click clover',
      });
      expect(actionMissing.action).toBe('NOOP');
      expect(actionMissing.thought).toBe('💭 I have no idea what that means, so I poked the page title. Describe what to click?');

      const actionEmpty = fallbackResolve({
        pages: [{ id: 'MV-EMPTY', slug: 'empty', title: 'Empty View', elements: [] }],
        manifest: CASE_001_GENERATED_MANIFEST,
        state: makeState('MV-EMPTY', microState),
        instruction: 'click clover',
      });
      expect(actionEmpty.action).toBe('NOOP');
      expect(actionEmpty.thought).toBe('💭 I have no idea what that means, so I poked the page title. Describe what to click?');
    });

    it('handles multi-byte unicode, Japanese Kanji/Hiragana, and special punctuation', async () => {
      const actionKanji = await resolveLine({
        puzzle: CASE_001_PUZZLE,
        manifest: CASE_001_GENERATED_MANIFEST,
        state: makeState('MV-03', microState),
        instruction: '緑の座席 13870 特割',
      });
      expect(actionKanji.action).toBe('CLICK');
      expect(actionKanji.mark).toBe(25);

      const actionEmoji = await resolveLine({
        puzzle: CASE_001_PUZZLE,
        manifest: CASE_001_GENERATED_MANIFEST,
        state: makeState('MV-03', microState),
        instruction: '🍀 D3',
      });
      expect(actionEmoji.action).toBe('CLICK');
      expect(actionEmoji.mark).toBe(25);
    });
  });

  // =========================================================================
  // VECTOR 2: Fallback Multi-Token Scoring & Tie Boundaries
  // =========================================================================
  describe('Vector 2: Multi-Token Scoring & Tie Boundaries', () => {
    it('returns NOOP when instruction scores below confidence threshold (30)', async () => {
      const action = await resolveLine({
        puzzle: CASE_001_PUZZLE,
        manifest: CASE_001_GENERATED_MANIFEST,
        state: makeState('MV-03', microState),
        instruction: 'completely unrelated query',
      });
      expect(action.action).toBe('NOOP');
      expect(action.thought).toBe('💭 I have no idea what that means, so I poked the page title. Describe what to click?');
    });

    it('returns NOOP for ambiguous fare matches (¥13,870)', async () => {
      const actionFare = await resolveLine({
        puzzle: CASE_001_PUZZLE,
        manifest: CASE_001_GENERATED_MANIFEST,
        state: makeState('MV-03', microState),
        instruction: 'select ticket 13870',
      });
      expect(actionFare.action).toBe('NOOP');
      expect(actionFare.thought).toBe('💭 I have no idea what that means, so I poked the page title. Describe what to click?');

      const actionFareComma = await resolveLine({
        puzzle: CASE_001_PUZZLE,
        manifest: CASE_001_GENERATED_MANIFEST,
        state: makeState('MV-03', microState),
        instruction: 'select ticket 13,870',
      });
      expect(actionFareComma.action).toBe('NOOP');
      expect(actionFareComma.thought).toBe('💭 I have no idea what that means, so I poked the page title. Describe what to click?');
    });

    it('breaks ties cleanly when additional row or train disambiguation is provided', async () => {
      const actionHikari = await resolveLine({
        puzzle: CASE_001_PUZZLE,
        manifest: CASE_001_GENERATED_MANIFEST,
        state: makeState('MV-03', microState),
        instruction: 'ticket 13870 in row 1',
      });
      expect(actionHikari.action).toBe('CLICK');
      expect(actionHikari.mark).toBe(21);

      const actionNozomi = await resolveLine({
        puzzle: CASE_001_PUZZLE,
        manifest: CASE_001_GENERATED_MANIFEST,
        state: makeState('MV-03', microState),
        instruction: 'nozomi free seat 13870',
      });
      expect(actionNozomi.action).toBe('CLICK');
      expect(actionNozomi.mark).toBe(23);

      const actionGreen = await resolveLine({
        puzzle: CASE_001_PUZZLE,
        manifest: CASE_001_GENERATED_MANIFEST,
        state: makeState('MV-03', microState),
        instruction: 'ticket 13870 with clover',
      });
      expect(actionGreen.action).toBe('CLICK');
      expect(actionGreen.mark).toBe(25);
    });
  });

  // =========================================================================
  // VECTOR 3: Cloud Tier Boundary Validation & Goal Blindness
  // =========================================================================
  describe('Vector 3: Cloud Tier Boundary Validation', () => {
    it('rejects instructions exceeding 60 characters before reaching cloud tier', async () => {
      let cloudCalled = false;
      const action = await resolveLine({
        puzzle: CASE_001_PUZZLE,
        manifest: CASE_001_GENERATED_MANIFEST,
        state: makeState('MV-03', microState),
        instruction: 'A'.repeat(61),
        cloudResolver: async () => {
          cloudCalled = true;
          return { action: 'CLICK', pageId: 'MV-03', mark: 25, thought: 'ok', tier: 'cloud' };
        },
      });

      expect(cloudCalled).toBe(false);
      expect(action.action).toBe('NOOP');
      expect(action.thought).toBe('💭 I have no idea what that means, so I poked the page title. Describe what to click?');
    });

    it('rejects empty and whitespace instructions before reaching cloud tier', async () => {
      let cloudCalled = false;
      const action = await resolveLine({
        puzzle: CASE_001_PUZZLE,
        manifest: CASE_001_GENERATED_MANIFEST,
        state: makeState('MV-03', microState),
        instruction: '   ',
        cloudResolver: async () => {
          cloudCalled = true;
          return { action: 'CLICK', pageId: 'MV-03', mark: 25, thought: 'ok', tier: 'cloud' };
        },
      });
      expect(cloudCalled).toBe(false);
      expect(action.action).toBe('NOOP');
      expect(action.thought).toBe('💭 I have no idea what that means, so I poked the page title. Describe what to click?');
    });

    it('rejects non-existent macro-view without querying cloud tier', async () => {
      let cloudCalled = false;
      const action = await resolveLine({
        puzzle: CASE_001_PUZZLE,
        manifest: CASE_001_GENERATED_MANIFEST,
        state: makeState('MV-999', microState),
        instruction: 'click button',
        cloudResolver: async () => {
          cloudCalled = true;
          return { action: 'CLICK', pageId: 'MV-999', mark: 25, thought: 'ok', tier: 'cloud' };
        },
      });
      expect(cloudCalled).toBe(false);
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

      expect(() => assertGoalBlindness({ isTarget: true })).toThrow('Security Guardrail Violation');
      expect(() => assertGoalBlindness({ isTrap: true })).toThrow('Security Guardrail Violation');

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
      const res24 = filterPromptSyntheticIds('click Nozomi 24', CASE_001_MV03_ELEMENTS);
      expect(res24.isBlocked).toBe(false);

      const resPrice = filterPromptSyntheticIds('select 13870 fare', CASE_001_MV03_ELEMENTS);
      expect(resPrice.isBlocked).toBe(false);

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

      expect(sanitized).toContain('<button class="btn">Click</button>');
      expect(sanitized).toContain('<button>Confirm</button>');
      expect(sanitized).toContain('<div>Clean Content</div>');
    });
  });

  // =========================================================================
  // VECTOR 5: Cloud Failure Recovery & State Hash Determinism
  // =========================================================================
  describe('Vector 5: Cloud Failure Recovery & State Hash Determinism', () => {
    it('safely recovers when cloudResolver throws non-Error objects (string, null, primitive)', async () => {
      const throwingResolvers = [
        async () => { throw 'String error failure'; },
        async () => { throw 500; },
        async () => { throw null; },
        async () => { throw undefined; },
      ];

      for (const cloudResolver of throwingResolvers) {
        const action = await resolveLine({
          puzzle: CASE_001_PUZZLE,
          manifest: CASE_001_GENERATED_MANIFEST,
          state: makeState('MV-03', microState),
          instruction: 'click green car',
          cloudResolver,
        });
        expect(action.action).toBe('CLICK');
        expect(action.mark).toBe(25);
        expect(action.tier).toBe('fallback');
        expect(action.cloudFailed).toBe(true);
      }
    });

    it('produces identical state hashes for identical micro-states and distinct hashes on change', () => {
      const hash1 = generateStateHash('MV-03', microState as any);
      const hash2 = generateStateHash('MV-03', { ...microState } as any);
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(8);

      const modHash = generateStateHash('MV-03', { ...microState, greenCarSelected: true } as any);
      expect(modHash).not.toBe(hash1);
    });
  });
});
