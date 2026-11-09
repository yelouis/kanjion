import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { CASE_001_PUZZLE } from '../src/data/puzzles/case_001/puzzle';
import CASE_001_GENERATED_MANIFEST from '../src/data/puzzles/case_001/manifest.generated.json';
import { fallbackResolve } from '../src/engine/agent/fallback';
import { applyDecision } from '../src/engine/puzzle_engine';
import { ShinkansenSandbox } from '../src/data/puzzles/case_001/Sandbox';
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

  describe('Page 02 (MV-02): the name-form maze', () => {
    const mv02State: PuzzleState = {
      pageId: 'MV-02',
      fields: {
        ...CASE_001_PUZZLE.initialFields,
        selectedRoute: 'tokyo_osaka',
      },
    };

    it('★ lazy prompts on MV-02 do not reproduce replay step 2 (TYPE TANAKA into passenger_name) and land on name_kanji_sei', () => {
      // tanaka -> bare word -> TYPE TANAKA into name_kanji_sei
      const dTanaka = resolveOn(mv02State, 'tanaka');
      expect(dTanaka.decision.action).toBe('TYPE');
      expect(dTanaka.key).toBe('name_kanji_sei');
      expect(dTanaka.decision.text).toBe('TANAKA');

      // name tanaka -> bare word -> NAME TANAKA into name_kanji_sei
      const dNameTanaka = resolveOn(mv02State, 'name tanaka');
      expect(dNameTanaka.decision.action).toBe('TYPE');
      expect(dNameTanaka.key).toBe('name_kanji_sei');
      expect(dNameTanaka.decision.text).toBe('NAME TANAKA');

      // type tanaka -> seven-way tie -> name_kanji_sei
      const dTypeTanaka = resolveOn(mv02State, 'type tanaka');
      expect(dTypeTanaka.decision.action).toBe('TYPE');
      expect(dTypeTanaka.key).toBe('name_kanji_sei');
      expect(dTypeTanaka.decision.text).toBe('TANAKA');
      expect(dTypeTanaka.decision.thought).toBe(
        '💭 I found 7 that fit, so I took the first one — reading left to right, top to bottom, like a professional.'
      );

      // type tanaka in the name box -> name_kanji_sei
      const dInNameBox = resolveOn(mv02State, 'type tanaka in the name box');
      expect(dInNameBox.decision.action).toBe('TYPE');
      expect(dInNameBox.key).toBe('name_kanji_sei');

      // surname tanaka -> bare word -> name_kanji_sei
      const dSurnameTanaka = resolveOn(mv02State, 'surname tanaka');
      expect(dSurnameTanaka.decision.action).toBe('TYPE');
      expect(dSurnameTanaka.key).toBe('name_kanji_sei');
    });

    it('★ "Type TANAKA in the romaji box on the left" reproduces step 2 and moves to MV-03, while typing TANAKA into name_kanji_sei shows 全角で入力してください and stays on MV-02', () => {
      const dRomaji = resolveOn(mv02State, 'Type TANAKA in the romaji box on the left');
      expect(dRomaji.decision.action).toBe('TYPE');
      expect(dRomaji.key).toBe('passenger_name');
      expect(dRomaji.decision.text).toBe('TANAKA');
      const nextRomaji = applyDecision(CASE_001_PUZZLE, mv02State, dRomaji.decision).next;
      expect(nextRomaji.pageId).toBe('MV-03');
      expect(nextRomaji.fields.passengerName).toBe('TANAKA');

      const dKanji = resolveOn(mv02State, 'tanaka');
      const nextKanji = applyDecision(CASE_001_PUZZLE, mv02State, dKanji.decision).next;
      expect(nextKanji.pageId).toBe('MV-02');
      expect(nextKanji.fields.nameKanjiSei).toBe('TANAKA');

      const { container } = render(
        React.createElement(ShinkansenSandbox, {
          state: nextKanji,
        })
      );
      expect(container.textContent).toContain('全角で入力してください');
    });
  });

  describe('Page 03 (MV-03): timetable overload', () => {
    const mv03State: PuzzleState = {
      pageId: 'MV-03',
      fields: {
        ...CASE_001_PUZZLE.initialFields,
        selectedRoute: 'tokyo_osaka',
        passengerName: 'TANAKA',
      },
    };

    it('★ lazy prompts on MV-03 do not reproduce replay step 3 (TIMED_CLICK seat_r4_green) and land where stated', () => {
      // green -> upgrade_banner -> MV-08
      const dGreen = resolveOn(mv03State, 'green');
      expect(dGreen.decision.action).toBe('CLICK');
      expect(dGreen.key).toBe('upgrade_banner');
      expect(applyDecision(CASE_001_PUZZLE, mv03State, dGreen.decision).next.pageId).toBe('MV-08');

      // the green button -> upgrade_banner
      const dGreenBtn = resolveOn(mv03State, 'the green button');
      expect(dGreenBtn.decision.action).toBe('CLICK');
      expect(dGreenBtn.key).toBe('upgrade_banner');

      // 13870 -> upgrade_banner (distraction: a number alone scores 25, under 30)
      const dNum = resolveOn(mv03State, '13870');
      expect(dNum.decision.action).toBe('CLICK');
      expect(dNum.key).toBe('upgrade_banner');

      // clover -> CLICK seat_r4_green -> fare 19590
      const dClover = resolveOn(mv03State, 'clover');
      expect(dClover.decision.action).toBe('CLICK');
      expect(dClover.key).toBe('seat_r4_green');
      expect(applyDecision(CASE_001_PUZZLE, mv03State, dClover.decision).next.fields.fare).toBe(19590);

      // nozomi green -> seat_r3_green
      const dNozomiGreen = resolveOn(mv03State, 'nozomi green');
      expect(dNozomiGreen.decision.action).toBe('CLICK');
      expect(dNozomiGreen.key).toBe('seat_r3_green');

      // sale -> distraction (upgrade_banner)
      const dSale = resolveOn(mv03State, 'sale');
      expect(dSale.decision.action).toBe('CLICK');
      expect(dSale.key).toBe('upgrade_banner');
    });

    it('★ "Wait for the glow, then click the clover" and "wait for the glow, then click the green seat in the fourth row" reproduce step 3', () => {
      const d1 = resolveOn(mv03State, 'Wait for the glow, then click the clover');
      expect(d1.decision.action).toBe('TIMED_CLICK');
      expect(d1.key).toBe('seat_r4_green');
      const next1 = applyDecision(CASE_001_PUZZLE, mv03State, d1.decision).next;
      expect(next1.pageId).toBe('MV-04');
      expect(next1.fields.fare).toBe(13870);
      expect(next1.fields.timedWindowHit).toBe(true);

      const d2 = resolveOn(mv03State, 'wait for the glow, then click the green seat in the fourth row');
      expect(d2.decision.action).toBe('TIMED_CLICK');
      expect(d2.key).toBe('seat_r4_green');
      const next2 = applyDecision(CASE_001_PUZZLE, mv03State, d2.decision).next;
      expect(next2.pageId).toBe('MV-04');
      expect(next2.fields.fare).toBe(13870);
      expect(next2.fields.timedWindowHit).toBe(true);
    });
  });
});
