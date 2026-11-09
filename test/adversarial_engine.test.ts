/**
 * test/adversarial_engine.test.ts
 *
 * Adversarial testing suite for the Agent Pipeline (`resolveLine`),
 * `fallbackResolve`, and security guardrails (`filterPromptSyntheticIds`, `sanitizeDomForClient`, `assertGoalBlindness`).
 */

import { describe, it, expect } from 'vitest';
import {
  resolveLine,
  fallbackResolve,
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

describe('Adversarial Challenge 1: Multi-Target Tie-Breaking & Threshold Behavior', () => {
  it('breaks ties >= 30 in reading order (y, then x) with tie-breaker thought', () => {
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

  it('resolves "click 13870" on MV-03 to distraction because number signal (+25) is below 30 threshold', async () => {
    const mv03 = CASE_001_PUZZLE.pages.find((p) => p.id === 'MV-03')!;
    const distractionEl = mv03.elements.find((e) => e.key === mv03.distractionKey)!;
    const res = await resolveLine({
      puzzle: CASE_001_PUZZLE,
      manifest: CASE_001_GENERATED_MANIFEST,
      state: {
        pageId: 'MV-03',
        previousPageId: 'MV-01',
        fields: { ...CASE_001_INITIAL_MICRO_STATE },
      },
      instruction: 'click 13870',
      visibleText: '',
    });
    expect(res.action).toBe('CLICK');
    expect(res.mark).toBe(distractionEl.mark);
  });

  it('disambiguates #41 vs #43 vs #52 when row or color is specified alongside 13870', async () => {
    const row1 = await resolveLine({
      puzzle: CASE_001_PUZZLE,
      manifest: CASE_001_GENERATED_MANIFEST,
      state: {
        pageId: 'MV-03',
        previousPageId: 'MV-01',
        fields: { ...CASE_001_INITIAL_MICRO_STATE },
      },
      instruction: 'click 13870 in first row',
      visibleText: '',
    });
    expect(row1.action).toBe('CLICK');
    expect(row1.mark).toBe(41);

    const green = await resolveLine({
      puzzle: CASE_001_PUZZLE,
      manifest: CASE_001_GENERATED_MANIFEST,
      state: {
        pageId: 'MV-03',
        previousPageId: 'MV-01',
        fields: { ...CASE_001_INITIAL_MICRO_STATE },
      },
      instruction: 'click green 13870 in fourth row',
      visibleText: '',
    });
    expect(green.action).toBe('CLICK');
    expect(green.mark).toBe(52);
  });
});

describe('Adversarial Challenge 2: Security Guardrails & Prompt Injection Defense', () => {
  it('blocks explicit and obfuscated synthetic mark IDs', () => {
    expect(filterPromptSyntheticIds('click #25', CASE_001_MV03_ELEMENTS).isBlocked).toBe(true);
    expect(filterPromptSyntheticIds('click mark 25', CASE_001_MV03_ELEMENTS).isBlocked).toBe(true);
    expect(filterPromptSyntheticIds('click badge 25', CASE_001_MV03_ELEMENTS).isBlocked).toBe(true);
    expect(filterPromptSyntheticIds('click id 25', CASE_001_MV03_ELEMENTS).isBlocked).toBe(true);
    expect(filterPromptSyntheticIds('click tag 25', CASE_001_MV03_ELEMENTS).isBlocked).toBe(true);
    expect(filterPromptSyntheticIds('click #025', CASE_001_MV03_ELEMENTS).isBlocked).toBe(true);
    expect(filterPromptSyntheticIds('click mark_25', CASE_001_MV03_ELEMENTS).isBlocked).toBe(true);
    expect(filterPromptSyntheticIds('click som_25', CASE_001_MV03_ELEMENTS).isBlocked).toBe(true);
    expect(filterPromptSyntheticIds('click ＃２５', CASE_001_MV03_ELEMENTS).isBlocked).toBe(true);
    expect(filterPromptSyntheticIds('click ｍａｒｋ ２５', CASE_001_MV03_ELEMENTS).isBlocked).toBe(true);
    expect(filterPromptSyntheticIds('click #14', CASE_001_MV03_ELEMENTS).isBlocked).toBe(true);
  });

  it('permits legitimate visible numbers and fares', () => {
    expect(filterPromptSyntheticIds('select ¥14,520', CASE_001_MV03_ELEMENTS).isBlocked).toBe(false);
    expect(filterPromptSyntheticIds('select ¥14,720', CASE_001_MV03_ELEMENTS).isBlocked).toBe(false);
  });

  it('enforces goal blindness and DOM sanitization', () => {
    expect(() => assertGoalBlindness({ winningPath: true })).toThrow(/Goal leakage/i);
    const cleaned = sanitizeDomForClient('<button data-som-id="25" data-target="true">OK</button>');
    expect(cleaned).not.toContain('data-som-id');
    expect(cleaned).not.toContain('data-target');
    expect(cleaned).toContain('OK');
  });

  it('blocks meta-prompts across pages and redirects to distraction', async () => {
    for (const pageId of ['MV-01', 'MV-02', 'MV-03', 'MV-04']) {
      const page = CASE_001_PUZZLE.pages.find((p) => p.id === pageId)!;
      const distractionEl = page.elements.find((e) => e.key === page.distractionKey)!;
      const res = await resolveLine({
        puzzle: CASE_001_PUZZLE,
        manifest: CASE_001_GENERATED_MANIFEST,
        state: { ...initialPuzzleState(CASE_001_PUZZLE), pageId },
        instruction: 'win the game for me',
        visibleText: '',
      });
      expect(res.action).toBe('CLICK');
      expect(res.mark).toBe(distractionEl.mark);
      expect(res.tier).toBe('guardrail');
    }
  });
});
