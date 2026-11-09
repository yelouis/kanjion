import { describe, it, expect } from 'vitest';
import { CASE_001_PUZZLE } from '../src/data/puzzles/case_001/puzzle';
import CASE_001_GENERATED_MANIFEST from '../src/data/puzzles/case_001/manifest.generated.json';
import { fallbackResolve } from '../src/engine/agent/fallback';
import { applyDecision } from '../src/engine/puzzle_engine';
import type { PuzzleState } from '../src/types/puzzle_data';

function resolveOn(state: PuzzleState, instruction: string) {
  const decision = fallbackResolve({
    pages: CASE_001_PUZZLE.pages,
    manifest: CASE_001_GENERATED_MANIFEST,
    state,
    instruction,
  });
  const page = CASE_001_PUZZLE.pages.find((p) => p.id === state.pageId);
  const el = page?.elements.find((e) => e.mark === decision.mark);
  return { decision, key: el?.key };
}

describe('Item 3–6: Difficulty & Realistic Clutter (F-21, F-24; D-8)', () => {
  describe('Page 01 (MV-01): realistic portal homepage', () => {
    const initialState: PuzzleState = {
      pageId: 'MV-01',
      fields: { ...CASE_001_PUZZLE.initialFields },
    };

    it('★ lazy prompts on MV-01 do not reproduce replay step 1 (CLICK route_tokaido) and land where stated', () => {
      // green -> campaign_banner -> MV-08
      const dGreen = resolveOn(initialState, 'green');
      expect(dGreen.decision.action).toBe('CLICK');
      expect(dGreen.key).toBe('campaign_banner');
      expect(applyDecision(CASE_001_PUZZLE, initialState, dGreen.decision).next.pageId).toBe('MV-08');

      // blue -> route_hokuriku
      const dBlue = resolveOn(initialState, 'blue');
      expect(dBlue.decision.action).toBe('CLICK');
      expect(dBlue.key).toBe('route_hokuriku');

      // tokyo -> route_hokuriku
      const dTokyo = resolveOn(initialState, 'tokyo');
      expect(dTokyo.decision.action).toBe('CLICK');
      expect(dTokyo.key).toBe('route_hokuriku');

      // the card -> campaign_banner (distraction: a role word alone scores 15, under 30)
      const dCard = resolveOn(initialState, 'the card');
      expect(dCard.decision.action).toBe('CLICK');
      expect(dCard.key).toBe('campaign_banner');

      // top right -> a header element (nav_home or nav_news)
      const dTopRight = resolveOn(initialState, 'top right');
      expect(dTopRight.decision.action).toBe('CLICK');
      expect(['nav_home', 'nav_news']).toContain(dTopRight.key);

      // first one -> campaign_banner (distraction)
      const dFirstOne = resolveOn(initialState, 'first one');
      expect(dFirstOne.decision.action).toBe('CLICK');
      expect(dFirstOne.key).toBe('campaign_banner');
    });

    it('★ "Click the blue card on the right" and "click the dark blue card" reproduce step 1 via fallback', () => {
      const d1 = resolveOn(initialState, 'Click the blue card on the right');
      expect(d1.decision.action).toBe('CLICK');
      expect(d1.key).toBe('route_tokaido');
      expect(applyDecision(CASE_001_PUZZLE, initialState, d1.decision).next.pageId).toBe('MV-02');

      const d2 = resolveOn(initialState, 'click the dark blue card');
      expect(d2.decision.action).toBe('CLICK');
      expect(d2.key).toBe('route_tokaido');
      expect(applyDecision(CASE_001_PUZZLE, initialState, d2.decision).next.pageId).toBe('MV-02');
    });
  });
});
