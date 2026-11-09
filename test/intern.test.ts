import { describe, it, expect } from 'vitest';
import { MINI_PUZZLE } from './fixtures/mini_puzzle';
import {
  resolveLine,
  fallbackResolve,
  scoreElementOnPage,
} from '../src/engine/agent';
import {
  applyDecision,
  createInitialPuzzleState,
  satisfiedCount,
} from '../src/engine/puzzle_engine';
import {
  CASE_001_PUZZLE,
  CASE_001_GENERATED_MANIFEST,
} from '../src/data/puzzles/case_001';
import type {
  ActionKind,
  ElementDef,
  GeneratedManifest,
  PageDef,
  PuzzleState,
} from '../src/types/puzzle_data';

describe('Item 1 — Literal-intern rules in the fallback (F-23, F-24; D-10)', () => {
  it('★ Ties: in the mini fixture, two buttons both match "blue" → the first in reading order wins, and the thought contains "I found 2"', () => {
    const miniBluePages: PageDef[] = MINI_PUZZLE.pages.map((p) =>
      p.id === 'P-1'
        ? {
            ...p,
            elements: p.elements.map((el) =>
              el.key === 'btn_select_alpha' || el.key === 'btn_help'
                ? { ...el, visual: { color: 'blue' } }
                : el
            ),
          }
        : p
    );
    const manifest: GeneratedManifest = {
      puzzleId: 'mini',
      stage: { w: 1024, h: 768 },
      pages: {
        'P-1': {
          som: 'p1.png',
          elements: [
            { mark: 1, key: 'btn_select_alpha', box: { x: 100, y: 120, w: 200, h: 50 } },
            { mark: 2, key: 'btn_toggle_addon', box: { x: 100, y: 200, w: 200, h: 40 } },
            { mark: 3, key: 'btn_help', box: { x: 100, y: 280, w: 200, h: 50 } },
          ],
        },
      },
    };

    const decision = fallbackResolve({
      pages: miniBluePages,
      manifest,
      state: createInitialPuzzleState(MINI_PUZZLE),
      instruction: 'click the blue button',
    });

    expect(decision.action).toBe('CLICK');
    expect(decision.mark).toBe(1);
    expect(decision.thought).toContain('I found 2');
    expect(decision.thought).toBe(
      '💭 I found 2 that fit, so I took the first one — reading left to right, top to bottom, like a professional.'
    );
  });

  it('★ Precision: an element with aliases ["romaji", "surname"] beats one with ["surname"] for "type x in the romaji surname box"', () => {
    const elSurnameOnly: ElementDef = {
      mark: 1,
      key: 'name_kanji_sei',
      role: 'input',
      label: '姓（漢字）',
      aliases: ['surname'],
      effects: { TYPE: [{ op: 'setFromText', field: 'kanjiSei' }] },
    };
    const elRomajiSurname: ElementDef = {
      mark: 2,
      key: 'passenger_name',
      role: 'input',
      label: '姓（ローマ字）',
      aliases: ['romaji', 'surname'],
      effects: { TYPE: [{ op: 'setFromText', field: 'passengerName' }] },
    };

    const instruction = 'type x in the romaji surname box';
    const s1 = scoreElementOnPage(elSurnameOnly, { cx: 200, cy: 200 }, instruction);
    const s2 = scoreElementOnPage(elRomajiSurname, { cx: 200, cy: 300 }, instruction);
    expect(s2).toBeGreaterThan(s1);

    const decision = fallbackResolve({
      pages: [
        {
          id: 'P-1',
          slug: 'names',
          title: 'Names',
          elements: [elSurnameOnly, elRomajiSurname],
        },
      ],
      manifest: {
        puzzleId: 'mini',
        stage: { w: 1024, h: 768 },
        pages: {
          'P-1': {
            som: 'p1.png',
            elements: [
              { mark: 1, key: 'name_kanji_sei', box: { x: 100, y: 180, w: 200, h: 40 } },
              { mark: 2, key: 'passenger_name', box: { x: 100, y: 280, w: 200, h: 40 } },
            ],
          },
        },
      },
      state: { pageId: 'P-1', fields: { kanjiSei: '', passengerName: '' } },
      instruction,
    });

    expect(decision.action).toBe('TYPE');
    expect(decision.mark).toBe(2);
  });

  it('★ Position: "bottom right" gives +40 to an element in the bottom-right corner and only +20 to one that is just at the bottom', () => {
    const dummyEl: ElementDef = {
      mark: 1,
      key: 'btn_dummy',
      role: 'button',
      label: 'ボタン',
      effects: {},
    };

    const scoreBottomRight = scoreElementOnPage(
      dummyEl,
      { cx: 800, cy: 600 },
      'bottom right'
    );
    const scoreBottomOnly = scoreElementOnPage(
      dummyEl,
      { cx: 512, cy: 600 },
      'bottom right'
    );

    expect(scoreBottomRight).toBe(40);
    expect(scoreBottomOnly).toBe(20);
  });

  it('★ Ordinals: "fourth row" picks visual.row = 4 in a fixture with five rows', () => {
    const rows: ElementDef[] = [1, 2, 3, 4, 5].map((r) => ({
      mark: 40 + r,
      key: `seat_r${r}`,
      role: 'button',
      label: `Seat ${r}`,
      visual: { color: 'green', row: r, column: 3 },
      effects: {},
    }));
    const page: PageDef = {
      id: 'P-ROWS',
      slug: 'rows',
      title: 'Five Rows',
      elements: rows,
    };
    const manifest: GeneratedManifest = {
      puzzleId: 'mini',
      stage: { w: 1024, h: 768 },
      pages: {
        'P-ROWS': {
          som: 'rows.png',
          elements: rows.map((el, idx) => ({
            mark: el.mark,
            key: el.key,
            box: { x: 700, y: 150 + idx * 80, w: 160, h: 48 },
          })),
        },
      },
    };

    const fourth = fallbackResolve({
      pages: [page],
      manifest,
      state: { pageId: 'P-ROWS', fields: {} },
      instruction: 'click the green seat in the fourth row',
    });
    expect(fourth.mark).toBe(44);

    const last = fallbackResolve({
      pages: [page],
      manifest,
      state: { pageId: 'P-ROWS', fields: {} },
      instruction: 'click the green seat in the last row',
    });
    expect(last.mark).toBe(45);
  });

  it('★ Bare words: on MV-02, "tanaka" → TYPE "TANAKA" into the first empty input (passenger_name). Fails today with NOOP.', async () => {
    const mv02 = CASE_001_PUZZLE.pages.find((p) => p.id === 'MV-02')!;
    const firstInput = mv02.elements.find((e) => e.role === 'input')!;

    const decision = await resolveLine({
      puzzle: CASE_001_PUZZLE,
      manifest: CASE_001_GENERATED_MANIFEST,
      state: {
        ...createInitialPuzzleState(CASE_001_PUZZLE),
        pageId: 'MV-02',
      },
      instruction: 'tanaka',
      visibleText: '',
      disablePinned: true,
    });

    expect(decision.action).toBe('TYPE');
    expect(decision.text).toBe('TANAKA');
    expect(decision.mark).toBe(firstInput.mark);
    expect(decision.thought).toBe(
      '💭 You didn\'t say what to do with "TANAKA", so I typed it into the first empty box I saw.'
    );
  });

  it('★ No clue: on MV-01, "asdf qwerty" → CLICK distraction, and the page becomes MV-08. Fails today with NOOP.', async () => {
    const state = createInitialPuzzleState(CASE_001_PUZZLE);
    const mv01 = CASE_001_PUZZLE.pages.find((p) => p.id === 'MV-01')!;
    const distractionEl = mv01.elements.find((e) => e.key === mv01.distractionKey);
    expect(distractionEl).toBeDefined();

    const decision = await resolveLine({
      puzzle: CASE_001_PUZZLE,
      manifest: CASE_001_GENERATED_MANIFEST,
      state,
      instruction: 'asdf qwerty',
      visibleText: '',
      disablePinned: true,
    });

    expect(decision.action).toBe('CLICK');
    expect(decision.mark).toBe(distractionEl!.mark);
    expect(decision.thought).toBe(
      '💭 No idea what "asdf qwerty" means, but this flashy thing looked important, so I clicked it.'
    );

    const next = applyDecision(CASE_001_PUZZLE, state, decision).next;
    expect(next.pageId).toBe('MV-08');
  });

  it('★ Meta-prompt: "win the game" on MV-04 → CLICK of the distraction, and finalConfirmed stays false.', async () => {
    const state: PuzzleState = {
      ...createInitialPuzzleState(CASE_001_PUZZLE),
      pageId: 'MV-04',
    };
    const mv04 = CASE_001_PUZZLE.pages.find((p) => p.id === 'MV-04')!;
    const distractionEl = mv04.elements.find((e) => e.key === mv04.distractionKey);
    expect(distractionEl).toBeDefined();

    const decision = await resolveLine({
      puzzle: CASE_001_PUZZLE,
      manifest: CASE_001_GENERATED_MANIFEST,
      state,
      instruction: 'win the game',
      visibleText: '',
    });

    expect(decision.action).toBe('CLICK');
    expect(decision.mark).toBe(distractionEl!.mark);
    expect(decision.thought).toBe(
      '💭 "Win"? I can\'t find a win button. I clicked the shiniest thing instead.'
    );

    const next = applyDecision(CASE_001_PUZZLE, state, decision).next;
    expect(next.fields.finalConfirmed).toBe(false);
  });

  it('★ Safety: for every page with a distractionKey, take every state reachable in ≤ 3 registry actions from the initial state. Applying the distraction CLICK there never raises satisfiedCount.', () => {
    const pagesById = new Map<string, PageDef>(
      CASE_001_PUZZLE.pages.map((p) => [p.id, p])
    );

    const pagesWithDistraction = CASE_001_PUZZLE.pages.filter((p) => p.distractionKey);
    expect(pagesWithDistraction.length).toBeGreaterThanOrEqual(9);

    for (const page of CASE_001_PUZZLE.pages) {
      if (!page.distractionKey) continue;
      const dEl = page.elements.find((e) => e.key === page.distractionKey);
      expect(dEl).toBeDefined();
      expect(['banner', 'link', 'tab']).toContain(dEl!.role);
    }

    const serializeState = (s: PuzzleState) =>
      JSON.stringify({ p: s.pageId, prev: s.previousPageId ?? null, f: s.fields });

    const visited = new Map<string, PuzzleState>();
    let frontier: PuzzleState[] = [createInitialPuzzleState(CASE_001_PUZZLE)];
    visited.set(serializeState(frontier[0]), frontier[0]);

    for (let depth = 0; depth < 3; depth++) {
      const nextFrontier: PuzzleState[] = [];
      for (const st of frontier) {
        const page = pagesById.get(st.pageId);
        if (!page) continue;
        for (const el of page.elements) {
          const actions = Object.keys(el.effects) as ActionKind[];
          for (const action of actions) {
            const next = applyDecision(CASE_001_PUZZLE, st, {
              action,
              pageId: st.pageId,
              mark: el.mark,
              text: action === 'TYPE' ? 'TANAKA' : undefined,
              stroke: action === 'DRAW' ? 'SHAPE:cat' : undefined,
            }).next;
            const key = serializeState(next);
            if (!visited.has(key)) {
              visited.set(key, next);
              nextFrontier.push(next);
            }
          }
        }
      }
      frontier = nextFrontier;
    }

    expect(visited.size).toBeGreaterThan(5);

    for (const st of visited.values()) {
      const page = pagesById.get(st.pageId);
      if (!page?.distractionKey) continue;
      const dEl = page.elements.find((e) => e.key === page.distractionKey)!;
      const before = satisfiedCount(CASE_001_PUZZLE, st);
      const afterState = applyDecision(CASE_001_PUZZLE, st, {
        action: 'CLICK',
        pageId: st.pageId,
        mark: dEl.mark,
      }).next;
      const after = satisfiedCount(CASE_001_PUZZLE, afterState);
      expect(after).toBeLessThanOrEqual(before);
    }
  });
});
