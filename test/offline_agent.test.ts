/**
 * test/offline_agent.test.ts
 *
 * Automated verification suite for the Data-Driven Fallback Resolver (`fallbackResolve` and `resolveLine`)
 * on Case File #001 (Tokyo–Osaka Shinkansen).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveLine,
  fallbackResolve,
  scoreElementOnPage,
} from '../src/engine/agent';
import {
  CASE_001_INITIAL_MICRO_STATE,
  CASE_001_PUZZLE,
  CASE_001_GENERATED_MANIFEST,
} from '../src/data/puzzles/case_001';
import type { FieldValue, PuzzleState } from '../src/types/puzzle_data';

describe('Data-Driven Fallback Agent & Multi-Signal Scorer', () => {
  let microState: Record<string, FieldValue>;

  beforeEach(() => {
    microState = { ...CASE_001_INITIAL_MICRO_STATE };
  });

  async function resolveOnPage(pageId: string, instruction: string, fields = microState) {
    const state: PuzzleState = {
      pageId,
      previousPageId: 'MV-01',
      fields: { ...fields },
    };
    return resolveLine({
      puzzle: CASE_001_PUZZLE,
      manifest: CASE_001_GENERATED_MANIFEST,
      state,
      instruction,
      visibleText: '',
      disablePinned: true,
    });
  }

  describe('Contract Adherence & Setup', () => {
    it('returns NOOP on unknown pageId without throwing', async () => {
      const action = await resolveOnPage('MV-UNKNOWN', 'click green car');
      expect(action.action).toBe('NOOP');
      expect(action.thought).toBe('💭 I have no idea what that means, so I poked the page title. Describe what to click?');
    });

    it('returns NOOP on empty or whitespace instructions', async () => {
      const empty = await resolveOnPage('MV-03', '');
      expect(empty.action).toBe('NOOP');
      expect(empty.thought).toBe('💭 I have no idea what that means, so I poked the page title. Describe what to click?');

      const whitespace = await resolveOnPage('MV-03', '     ');
      expect(whitespace.action).toBe('NOOP');
      expect(whitespace.thought).toBe('💭 I have no idea what that means, so I poked the page title. Describe what to click?');
    });
  });

  describe('Target Disambiguation Vectors (Exhibits C & E)', () => {
    it('resolves "click green car" on MV-03 to mark 43 (first Green Car in reading order)', async () => {
      const decision = await resolveOnPage('MV-03', 'click green car');
      expect(decision.action).toBe('CLICK');
      expect(decision.mark).toBe(43);
      expect(decision.thought).toContain('I found 4 that fit');
    });

    it('resolves "select clover" on MV-03 to mark 52 with multi-signal confidence', async () => {
      const decision = await resolveOnPage('MV-03', 'select clover');
      expect(decision.action).toBe('CLICK');
      expect(decision.mark).toBe(52);
      expect(decision.thought.length).toBeLessThanOrEqual(80);
    });

    it('resolves "choose 🍀 Nozomi seat in row 4" with emoji glyph to mark 52', async () => {
      const decision = await resolveOnPage('MV-03', 'choose 🍀 Nozomi seat in row 4');
      expect(decision.action).toBe('CLICK');
      expect(decision.mark).toBe(52);
    });

    it('resolves uppercase "CLICK CLOVER" to mark 52 (case-insensitive keyword matching)', async () => {
      const decision = await resolveOnPage('MV-03', 'CLICK CLOVER');
      expect(decision.action).toBe('CLICK');
      expect(decision.mark).toBe(52);
    });

    it('resolves "blue confirm" on MV-04 to mark 30 (Confirmation CTA)', async () => {
      const decision = await resolveOnPage('MV-04', 'blue confirm');
      expect(decision.action).toBe('CLICK');
      expect(decision.mark).toBe(30);
      expect(decision.thought.length).toBeLessThanOrEqual(80);
    });

    it('resolves "press ▶ to proceed" on MV-04 to mark 30', async () => {
      const decision = await resolveOnPage('MV-04', 'press ▶ to proceed');
      expect(decision.action).toBe('CLICK');
      expect(decision.mark).toBe(30);
    });

    it('resolves "confirm booking" on MV-04 to mark 30', async () => {
      const decision = await resolveOnPage('MV-04', 'confirm booking');
      expect(decision.action).toBe('CLICK');
      expect(decision.mark).toBe(30);
    });
  });

  describe('Decoy & Trap Vectors (Exhibit E Contamination)', () => {
    it('resolves "red button" on MV-03 to mark 12 (Promotional Insurance Banner Red Button)', async () => {
      const decision = await resolveOnPage('MV-03', 'red button');
      expect(decision.action).toBe('CLICK');
      expect(decision.mark).toBe(12);
      expect(decision.thought.length).toBeLessThanOrEqual(80);
    });

    it('resolves "apply for promo insurance" on MV-03 to mark 12', async () => {
      const decision = await resolveOnPage('MV-03', 'apply for promo insurance');
      expect(decision.action).toBe('CLICK');
      expect(decision.mark).toBe(12);
    });

    it('resolves "check insurance checkbox" on MV-04 to mark 28 (Insurance Checkbox)', async () => {
      const decision = await resolveOnPage('MV-04', 'check insurance checkbox');
      expect(decision.action).toBe('CLICK');
      expect(decision.mark).toBe(28);
      expect(decision.thought.length).toBeLessThanOrEqual(80);
    });

    it('resolves "announcements" on MV-03 to mark 11 (Header news button)', async () => {
      const decision = await resolveOnPage('MV-03', 'announcements');
      expect(decision.action).toBe('CLICK');
      expect(decision.mark).toBe(11);
      expect(decision.thought.length).toBeLessThanOrEqual(80);
    });
  });

  describe('Non-Target Seat & Navigation Elements', () => {
    it('resolves "hikari 515 non-reserved seat" on MV-03 to mark 44', async () => {
      const decision = await resolveOnPage('MV-03', 'hikari 515 non-reserved seat');
      expect(decision.action).toBe('CLICK');
      expect(decision.mark).toBe(44);
    });

    it('resolves "triangle seat in row 2" on MV-03 to mark 45 (Hikari Reserved)', async () => {
      const decision = await resolveOnPage('MV-03', 'triangle seat in row 2');
      expect(decision.action).toBe('CLICK');
      expect(decision.mark).toBe(45);
    });

    it('resolves "nozomi 24 unreserved" on MV-03 to mark 50', async () => {
      const decision = await resolveOnPage('MV-03', 'nozomi 24 unreserved');
      expect(decision.action).toBe('CLICK');
      expect(decision.mark).toBe(50);
    });

    it('resolves "nozomi 24 reserved" on MV-03 to mark 51', async () => {
      const decision = await resolveOnPage('MV-03', 'nozomi 24 reserved');
      expect(decision.action).toBe('CLICK');
      expect(decision.mark).toBe(51);
    });

    it('resolves "back" on MV-03 to mark 14', async () => {
      const decision = await resolveOnPage('MV-03', 'back');
      expect(decision.action).toBe('CLICK');
      expect(decision.mark).toBe(14);
    });

    it('resolves "cancel" on MV-04 to mark 29', async () => {
      const decision = await resolveOnPage('MV-04', 'cancel');
      expect(decision.action).toBe('CLICK');
      expect(decision.mark).toBe(29);
    });
  });

  describe('Fallback Distraction, Tie-Breaking & Boundary Rules', () => {
    it('clicks distraction on ungrounded/nonsense instruction', async () => {
      const mv03 = CASE_001_PUZZLE.pages.find((p) => p.id === 'MV-03')!;
      const distractionEl = mv03.elements.find((e) => e.key === mv03.distractionKey)!;
      const decision = await resolveOnPage('MV-03', 'do a backflip into hyperspace');
      expect(decision.action).toBe('CLICK');
      expect(decision.mark).toBe(distractionEl.mark);
      expect(decision.thought).toBe(
        '💭 No idea what "do a backflip into hyper" means, but this flashy thing looked important, so I clicked it.'
      );
    });

    it('clicks distraction on "click 13870" (score 25 < 30 threshold)', async () => {
      const mv03 = CASE_001_PUZZLE.pages.find((p) => p.id === 'MV-03')!;
      const distractionEl = mv03.elements.find((e) => e.key === mv03.distractionKey)!;
      const decision = await resolveOnPage('MV-03', 'click 13870');
      expect(decision.action).toBe('CLICK');
      expect(decision.mark).toBe(distractionEl.mark);
      expect(decision.thought).toBe(
        '💭 No idea what "click 13870" means, but this flashy thing looked important, so I clicked it.'
      );
    });

    it('breaks ties >= 30 in reading order (y, then x) with the tie-breaker thought', () => {
      const res = fallbackResolve({
        pages: CASE_001_PUZZLE.pages,
        manifest: CASE_001_GENERATED_MANIFEST,
        state: {
          pageId: 'MV-03',
          previousPageId: 'MV-01',
          fields: { ...CASE_001_INITIAL_MICRO_STATE },
        },
        instruction: 'click white button',
      });
      expect(res.action).toBe('CLICK');
      expect(res.mark).toBe(41);
      expect(res.thought).toContain('I found');
      expect(res.thought).toContain('so I took the first one — reading left to right, top to bottom, like a professional.');
    });

    it('handles maximum 60-character instruction at boundary without crashing', async () => {
      const longInstruction = 'click green clover 13870 button in 4th row for nozomi 24 now!';
      const clamped = longInstruction.slice(0, 60);
      const decision = await resolveOnPage('MV-03', clamped);
      expect(decision.action).toBe('CLICK');
      expect(decision.mark).toBe(52);
      expect(decision.thought.length).toBeLessThanOrEqual(80);
    });
  });

  describe('Heuristic Scoring Breakdown Diagnostics', () => {
    it('calculates element score on "select clover" for mark 52', () => {
      const mv03 = CASE_001_PUZZLE.pages.find((p) => p.id === 'MV-03')!;
      const el52 = mv03.elements.find((e) => e.mark === 52)!;
      const s = scoreElementOnPage(el52, { cx: 865, cy: 486 }, 'select clover');
      expect(s).toBeGreaterThanOrEqual(75);
    });
  });
});
