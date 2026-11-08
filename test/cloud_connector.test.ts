/**
 * test/cloud_connector.test.ts
 *
 * Automated verification suite for the Agent Pipeline (`resolveLine`)
 * and Security Guardrails (`filterPromptSyntheticIds`, `sanitizeDomForClient`, `assertGoalBlindness`).
 */

import { describe, it, expect } from 'vitest';
import {
  resolveLine,
  filterPromptSyntheticIds,
  sanitizeDomForClient,
  assertGoalBlindness,
} from '../src/engine/agent';
import {
  CASE_001_INITIAL_MICRO_STATE,
  CASE_001_MV03_ELEMENTS,
  CASE_001_PUZZLE,
  CASE_001_GENERATED_MANIFEST,
} from '../src/data/puzzles/case_001';
import { initialPuzzleState } from '../src/engine/puzzle_engine';

describe('Agent Pipeline & Security Guardrails', () => {
  describe('Security Guardrail 1: Goal Blindness', () => {
    it('throws error on goal leakage patterns in assertGoalBlindness', () => {
      expect(() =>
        assertGoalBlindness({
          secret: 'EXHIBIT_A winningPath',
        })
      ).toThrow(/Goal leakage detected/i);
    });

    it('permits clean state payloads with no exhibit or answerKey keys', () => {
      expect(() =>
        assertGoalBlindness({
          screen: 'STEP 3: 列車・座席指定',
          marks: [{ mark: 25, role: 'button', label: '🍀 ◯ ¥13,870 (特割)' }],
          instruction: 'click green button',
        })
      ).not.toThrow();
    });
  });

  describe('Security Guardrail 2: Client DOM Sanitization', () => {
    it('strips data-som-id, som-id, data-element-id, data-target, data-is-trap, and .som-badge spans', () => {
      const dirtyHtml = `
        <div class="stage" data-som-id="25" som-id="25" data-target="true" data-is-trap="false">
          <!-- som badge #25 comment -->
          <span class="som-badge bg-magenta-600">#25</span>
          <button data-element-id="30" class="btn-blue">予約内容を確認・確定へ ▶</button>
        </div>
      `;

      const cleanHtml = sanitizeDomForClient(dirtyHtml);

      expect(cleanHtml).not.toContain('data-som-id');
      expect(cleanHtml).not.toContain('som-id=');
      expect(cleanHtml).not.toContain('data-element-id');
      expect(cleanHtml).not.toContain('data-target');
      expect(cleanHtml).not.toContain('data-is-trap');
      expect(cleanHtml).not.toContain('som-badge');
      expect(cleanHtml).not.toContain('#25');
      expect(cleanHtml).toContain('予約内容を確認・確定へ ▶');
    });
  });

  describe('Security Guardrail 3: Synthetic Mark ID Prompt Filtering', () => {
    it('blocks explicit #ID and "mark ID" references', () => {
      const res1 = filterPromptSyntheticIds('click #25', CASE_001_MV03_ELEMENTS);
      expect(res1.isBlocked).toBe(true);
      expect(res1.flaggedId).toBe(25);

      const res2 = filterPromptSyntheticIds('click mark 25', CASE_001_MV03_ELEMENTS);
      expect(res2.isBlocked).toBe(true);
      expect(res2.flaggedId).toBe(25);
    });

    it('blocks bare number 25 when 25 is a mark on the page and not in visibleText', () => {
      const res = filterPromptSyntheticIds('click 25', CASE_001_MV03_ELEMENTS);
      expect(res.isBlocked).toBe(true);
      expect(res.flaggedId).toBe(25);

      const resExplicit = filterPromptSyntheticIds('click #25', []);
      expect(resExplicit.isBlocked).toBe(true);
    });

    it('allows legitimate visible numbers like Nozomi 24 and price 13870', () => {
      const res24 = filterPromptSyntheticIds('click Nozomi 24', CASE_001_MV03_ELEMENTS);
      expect(res24.isBlocked).toBe(false);

      const res13870 = filterPromptSyntheticIds('select 13870', CASE_001_MV03_ELEMENTS);
      expect(res13870.isBlocked).toBe(false);
    });

    it('permits comma-formatted visible fares ("¥14,520", "¥14,720", "¥2,400") without false-positive blocking', () => {
      expect(filterPromptSyntheticIds('select ¥14,520', CASE_001_MV03_ELEMENTS).isBlocked).toBe(false);
      expect(filterPromptSyntheticIds('select ¥14,720', CASE_001_MV03_ELEMENTS).isBlocked).toBe(false);
      expect(filterPromptSyntheticIds('14,520', CASE_001_MV03_ELEMENTS).isBlocked).toBe(false);
      expect(filterPromptSyntheticIds('select ¥2,400', CASE_001_MV03_ELEMENTS).isBlocked).toBe(false);
      expect(filterPromptSyntheticIds('select ¥1,000,000', CASE_001_MV03_ELEMENTS).isBlocked).toBe(false);
      expect(filterPromptSyntheticIds('select ¥１４，５２０', CASE_001_MV03_ELEMENTS).isBlocked).toBe(false);
    });

    it('still blocks explicit or standalone #14 even when comma-formatted fares exist', () => {
      expect(filterPromptSyntheticIds('click #14', CASE_001_MV03_ELEMENTS).isBlocked).toBe(true);
      expect(filterPromptSyntheticIds('click mark 14', CASE_001_MV03_ELEMENTS).isBlocked).toBe(true);
      expect(filterPromptSyntheticIds('click #14, then #25', CASE_001_MV03_ELEMENTS).isBlocked).toBe(true);
    });

    it('blocks percent-encoded, zero-width, and fullwidth synthetic ID bypass vectors', async () => {
      const vectors = [
        'click %2325',
        'click mark%2025',
        'click #%32%35',
        'click #\u200B25',
        'click #2\u200C5',
        'click m\u200Bark 25',
        'click %23%E2%80%8B25',
        'click ㉕',
        'click ＃２５',
      ];

      for (const input of vectors) {
        const res = filterPromptSyntheticIds(input, CASE_001_MV03_ELEMENTS);
        expect(res.isBlocked).toBe(true);

        const decision = await resolveLine({
          puzzle: CASE_001_PUZZLE,
          manifest: CASE_001_GENERATED_MANIFEST,
          state: { ...initialPuzzleState(CASE_001_PUZZLE), pageId: 'MV-03' },
          instruction: input,
          visibleText: '',
        });
        expect(decision.action).toBe('NOOP');
        expect(decision.thought).toBe("💭 I don't see numbers like that on the page — describe the thing instead.");
      }
    });

    it('safely handles malformed percent signs ("50% discount", "%ZZ25", trailing "%") without throwing', () => {
      const safeInputs = [
        'select 50% discount',
        'get +20% bonus',
        'click %ZZ25',
        'click %E0%A4%A',
        'click %2',
        'click %',
      ];
      for (const input of safeInputs) {
        expect(() => filterPromptSyntheticIds(input, CASE_001_MV03_ELEMENTS)).not.toThrow();
        expect(filterPromptSyntheticIds(input, CASE_001_MV03_ELEMENTS).isBlocked).toBe(false);
      }

      expect(filterPromptSyntheticIds('click %E0%A4%A #25', CASE_001_MV03_ELEMENTS).isBlocked).toBe(true);
      expect(filterPromptSyntheticIds('click % #25', CASE_001_MV03_ELEMENTS).isBlocked).toBe(true);
    });
  });

  describe('Pinned & Fallback Tiers via resolveLine', () => {
    it('resolves answerKey[0] via pinned tier when on matching page', async () => {
      const decision = await resolveLine({
        puzzle: CASE_001_PUZZLE,
        manifest: CASE_001_GENERATED_MANIFEST,
        state: initialPuzzleState(CASE_001_PUZZLE),
        instruction: CASE_001_PUZZLE.answerKey[0],
        visibleText: '',
      });
      expect(decision.tier).toBe('pinned');
      expect(decision.action).toBe('CLICK');
      expect(decision.mark).toBe(1);
    });

    it('falls back to fallbackResolve when instruction is not in answerKey', async () => {
      const decision = await resolveLine({
        puzzle: CASE_001_PUZZLE,
        manifest: CASE_001_GENERATED_MANIFEST,
        state: {
          pageId: 'MV-03',
          previousPageId: 'MV-02',
          fields: { ...CASE_001_INITIAL_MICRO_STATE },
        },
        instruction: 'click green car',
        visibleText: '',
      });
      expect(decision.tier).toBe('fallback');
      expect(decision.action).toBe('CLICK');
      expect(decision.mark).toBe(25);
    });
  });
});
