import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MINI_PUZZLE } from './fixtures/mini_puzzle';
import {
  applyDecision,
  evaluateExhibits,
  elementsOnPage,
  createInitialPuzzleState,
} from '../src/engine/puzzle_engine';
import { CASE_001_PUZZLE } from '../src/data/puzzles/case_001/puzzle';
import { Sandbox } from '../src/data/puzzles/case_001/Sandbox';
import { filterPromptSyntheticIds } from '../src/engine/agent';

describe('Item 6 — Puzzle as Data (★ Falsifying Tests)', () => {
  it('★ runs mini fixture end-to-end: navigate, set, toggle, $previous, resetFields, and all 3 stamp states', () => {
    let state = createInitialPuzzleState(MINI_PUZZLE);
    expect(state.pageId).toBe('P-1');
    expect(state.previousPageId).toBeNull();

    // 1. Initial evaluation: both exhibits MISSED
    const initialEvals = evaluateExhibits(MINI_PUZZLE, state);
    expect(initialEvals.map((e) => e.status)).toEqual(['MISSED', 'MISSED']);
    expect(initialEvals.map((e) => e.stampText)).toEqual([
      '[MISSED ✗ +0%]',
      '[MISSED ✗ +0%]',
    ]);

    // 2. Toggle addonEnabled on P-1 (mark 2)
    state = applyDecision(MINI_PUZZLE, state, {
      pageId: state.pageId,
      mark: 2,
      action: 'CLICK',
    }).next;
    expect(state.fields.addonEnabled).toBe(true);

    // 3. Navigate to P-HELP (mark 3) and back via $previous (mark 6)
    state = applyDecision(MINI_PUZZLE, state, {
      pageId: state.pageId,
      mark: 3,
      action: 'CLICK',
    }).next;
    expect(state.pageId).toBe('P-HELP');
    expect(state.previousPageId).toBe('P-1');

    state = applyDecision(MINI_PUZZLE, state, {
      pageId: state.pageId,
      mark: 6,
      action: 'CLICK',
    }).next;
    expect(state.pageId).toBe('P-1');

    // 4. Select Alpha (mark 1) -> sets selectedItem='alpha' and navigates to P-2
    state = applyDecision(MINI_PUZZLE, state, {
      pageId: state.pageId,
      mark: 1,
      action: 'CLICK',
    }).next;
    expect(state.pageId).toBe('P-2');
    expect(state.fields.selectedItem).toBe('alpha');

    // 5. Confirm with addonEnabled=true -> Exhibit A VERIFIED, Exhibit B CONTAMINATED
    const contaminatedState = applyDecision(MINI_PUZZLE, state, {
      pageId: state.pageId,
      mark: 4,
      action: 'CLICK',
    }).next;
    const contamEvals = evaluateExhibits(MINI_PUZZLE, contaminatedState);
    expect(contamEvals[0].status).toBe('VERIFIED');
    expect(contamEvals[0].stampText).toBe('[VERIFIED ✓ +50%]');
    expect(contamEvals[1].status).toBe('CONTAMINATED');
    expect(contamEvals[1].stampText).toBe('[CONTAMINATED ✗ +0%]');
    expect(contamEvals[1].contaminatedNote).toBe('Extra add-on was attached');

    // 6. resetFields via mark 5 -> back to initialFields and P-1
    state = applyDecision(MINI_PUZZLE, contaminatedState, {
      pageId: contaminatedState.pageId,
      mark: 5,
      action: 'CLICK',
    }).next;
    expect(state.pageId).toBe('P-1');
    expect(state.fields).toEqual(MINI_PUZZLE.initialFields);

    // 7. Select Alpha and Confirm without addon -> both VERIFIED
    state = applyDecision(MINI_PUZZLE, state, {
      pageId: state.pageId,
      mark: 1,
      action: 'CLICK',
    }).next;
    state = applyDecision(MINI_PUZZLE, state, {
      pageId: state.pageId,
      mark: 4,
      action: 'CLICK',
    }).next;
    const verifiedEvals = evaluateExhibits(MINI_PUZZLE, state);
    expect(verifiedEvals.map((e) => e.status)).toEqual(['VERIFIED', 'VERIFIED']);
    expect(verifiedEvals.map((e) => e.stampText)).toEqual([
      '[VERIFIED ✓ +50%]',
      '[VERIFIED ✓ +50%]',
    ]);
  });

  it('★ every Case #001 page renders exactly one [data-el] node per registry element and none outside', () => {
    expect(CASE_001_PUZZLE.pages).toHaveLength(10);

    for (const page of CASE_001_PUZZLE.pages) {
      const state = {
        pageId: page.id,
        previousPageId: 'MV-01',
        fields: { ...CASE_001_PUZZLE.initialFields },
      };
      const { container } = render(React.createElement(Sandbox, { state }));
      const nodes = Array.from(container.querySelectorAll('[data-el]'));
      const renderedKeys = nodes.map((n) => n.getAttribute('data-el'));
      const expectedKeys = page.elements.map((el) => el.key);

      expect(renderedKeys.sort()).toEqual([...expectedKeys].sort());
      for (const key of expectedKeys) {
        expect(container.querySelectorAll(`[data-el="${key}"]`)).toHaveLength(1);
      }
      cleanup();
    }
  });

  it('★ F-4 mark-ID guardrail passes on every page via the registry (#17 on MV-02 -> blocked)', () => {
    for (const page of CASE_001_PUZZLE.pages) {
      const elems = elementsOnPage(CASE_001_PUZZLE, page.id);
      expect(elems.length).toBeGreaterThan(0);
      for (const el of elems) {
        const res = filterPromptSyntheticIds(`click #${el.mark}`, elems);
        expect(res.isBlocked).toBe(true);
      }
    }
  });

  it('★ MV-07 and MV-08 are reachable and recoverable via applyDecision', () => {
    // Advance to MV-04
    let state = createInitialPuzzleState(CASE_001_PUZZLE);
    state = applyDecision(CASE_001_PUZZLE, state, { pageId: 'MV-01', mark: 1, action: 'CLICK' }).next;
    state = applyDecision(CASE_001_PUZZLE, state, {
      pageId: 'MV-02',
      mark: 17,
      action: 'TYPE',
      text: 'TANAKA',
    }).next;
    state = applyDecision(CASE_001_PUZZLE, state, { pageId: 'MV-03', mark: 52, action: 'CLICK' }).next;
    expect(state.pageId).toBe('MV-04');
    const mv04FieldsBefore = { ...state.fields };

    // On MV-04, CLICK 29 -> MV-07; then CLICK 72 -> MV-04 with fields unchanged
    state = applyDecision(CASE_001_PUZZLE, state, { pageId: 'MV-04', mark: 29, action: 'CLICK' }).next;
    expect(state.pageId).toBe('MV-07');
    state = applyDecision(CASE_001_PUZZLE, state, { pageId: 'MV-07', mark: 72, action: 'CLICK' }).next;
    expect(state.pageId).toBe('MV-04');
    expect(state.fields).toEqual(mv04FieldsBefore);

    // CLICK 11 -> MV-08; then CLICK 81 -> back to the page you came from (MV-04)
    state = applyDecision(CASE_001_PUZZLE, state, { pageId: 'MV-04', mark: 11, action: 'CLICK' }).next;
    expect(state.pageId).toBe('MV-08');
    expect(state.previousPageId).toBe('MV-04');
    state = applyDecision(CASE_001_PUZZLE, state, { pageId: 'MV-08', mark: 81, action: 'CLICK' }).next;
    expect(state.pageId).toBe('MV-04');
  });
});

describe('Item 7 — Real Flash-Sale Timing & Add-On Trap (★ Falsifying Tests)', () => {
  it('★ F-11 (D-4=A): CLICK 52 -> fare 19590 and C MISSED; TIMED_CLICK 52 -> fare 13870 and C VERIFIED', () => {
    let mv03State = createInitialPuzzleState(CASE_001_PUZZLE);
    mv03State = applyDecision(CASE_001_PUZZLE, mv03State, { pageId: 'MV-01', mark: 1, action: 'CLICK' }).next;
    mv03State = applyDecision(CASE_001_PUZZLE, mv03State, {
      pageId: 'MV-02',
      mark: 17,
      action: 'TYPE',
      text: 'TANAKA',
    }).next;

    // Plain CLICK 52 -> fare 19590, timedWindowHit false, Exhibit C MISSED
    const plainNext = applyDecision(CASE_001_PUZZLE, mv03State, {
      pageId: 'MV-03',
      mark: 52,
      action: 'CLICK',
    }).next;
    expect(plainNext.fields.fare).toBe(19590);
    expect(plainNext.fields.timedWindowHit).toBe(false);
    const plainEvals = evaluateExhibits(CASE_001_PUZZLE, plainNext);
    expect(plainEvals.find((e) => e.id === 'C')?.status).toBe('MISSED');

    // TIMED_CLICK 52 -> fare 13870, timedWindowHit true, Exhibit C VERIFIED
    const timedNext = applyDecision(CASE_001_PUZZLE, mv03State, {
      pageId: 'MV-03',
      mark: 52,
      action: 'TIMED_CLICK',
    }).next;
    expect(timedNext.fields.fare).toBe(13870);
    expect(timedNext.fields.timedWindowHit).toBe(true);
    const timedEvals = evaluateExhibits(CASE_001_PUZZLE, timedNext);
    expect(timedEvals.find((e) => e.id === 'C')?.status).toBe('VERIFIED');
  });

  it('★ D-5=A: confirm with insurance attached -> E CONTAMINATED with note; uncheck (CLICK 28) before confirming -> E VERIFIED', () => {
    let state = createInitialPuzzleState(CASE_001_PUZZLE);
    state = applyDecision(CASE_001_PUZZLE, state, { pageId: 'MV-01', mark: 1, action: 'CLICK' }).next;
    state = applyDecision(CASE_001_PUZZLE, state, { pageId: 'MV-02', mark: 17, action: 'TYPE', text: 'TANAKA' }).next;
    state = applyDecision(CASE_001_PUZZLE, state, { pageId: 'MV-03', mark: 52, action: 'TIMED_CLICK' }).next;

    // Attach insurance via CLICK 28, then confirm via CLICK 30
    const withIns = applyDecision(CASE_001_PUZZLE, state, { pageId: 'MV-04', mark: 28, action: 'CLICK' }).next;
    expect(withIns.fields.insuranceAttached).toBe(true);
    const confirmedWithIns = applyDecision(CASE_001_PUZZLE, withIns, {
      pageId: 'MV-04',
      mark: 30,
      action: 'CLICK',
    }).next;

    const evalsContam = evaluateExhibits(CASE_001_PUZZLE, confirmedWithIns);
    const evalEContam = evalsContam.find((e) => e.id === 'E')!;
    expect(evalEContam.status).toBe('CONTAMINATED');
    expect(evalEContam.contaminatedNote).toBe('¥2,400 travel insurance was attached');

    // Uncheck insurance via CLICK 28 before confirming -> E VERIFIED
    const unchecked = applyDecision(CASE_001_PUZZLE, withIns, { pageId: 'MV-04', mark: 28, action: 'CLICK' }).next;
    expect(unchecked.fields.insuranceAttached).toBe(false);
    const confirmedClean = applyDecision(CASE_001_PUZZLE, unchecked, {
      pageId: 'MV-04',
      mark: 30,
      action: 'CLICK',
    }).next;

    const evalsClean = evaluateExhibits(CASE_001_PUZZLE, confirmedClean);
    const evalEClean = evalsClean.find((e) => e.id === 'E')!;
    expect(evalEClean.status).toBe('VERIFIED');
  });

  it('★ with a fake clock, waitForColumnNot(2) never resolves while currentColumn() === 2, and waitForColumn(2) always resolves when currentColumn() === 2', async () => {
    const { currentColumn, waitForColumn, waitForColumnNot } = await import('../src/engine/flash_clock');
    const { vi } = await import('vitest');
    vi.useFakeTimers();
    try {
      // Advance to column 2 (period 950ms -> [1900, 2850) is column 2)
      vi.setSystemTime(new Date(1950));
      const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => Date.now());
      expect(currentColumn()).toBe(2);

      // Plain CLICK choreography awaits waitForColumnNot(2): while at 1950ms (col 2), must wait until col != 2
      let plainClickedCol: number | null = null;
      const plainPromise = waitForColumnNot(2).then(() => {
        plainClickedCol = currentColumn();
      });
      await vi.advanceTimersByTimeAsync(100);
      expect(plainClickedCol).toBeNull();
      await vi.advanceTimersByTimeAsync(900); // now at 2950ms -> col 0
      await plainPromise;
      expect(plainClickedCol).not.toBe(2);

      // TIMED_CLICK choreography awaits waitForColumn(2): while at col 0, must wait until col === 2
      expect(currentColumn()).toBe(0);
      let timedClickedCol: number | null = null;
      const timedPromise = waitForColumn(2).then(() => {
        timedClickedCol = currentColumn();
      });
      await vi.advanceTimersByTimeAsync(500);
      expect(timedClickedCol).toBeNull();
      await vi.advanceTimersByTimeAsync(1500); // reaches col 2
      await timedPromise;
      expect(timedClickedCol).toBe(2);

      nowSpy.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });
});
